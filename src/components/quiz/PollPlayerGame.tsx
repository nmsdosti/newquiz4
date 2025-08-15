import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import UserMenu from "@/components/ui/user-menu";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";
import Logo from "@/components/ui/logo";

interface Question {
  id: string;
  text: string;
  options: {
    id: string;
    text: string;
  }[];
}

const PollPlayerGame = () => {
  const { sessionId, playerId } = useParams<{
    sessionId: string;
    playerId: string;
  }>();
  const { toast } = useToast();
  const [pollSession, setPollSession] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [pollEnded, setPollEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [waitingForNextQuestion, setWaitingForNextQuestion] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const channelRef = useRef<any>(null);
  const dbSubscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (sessionId && playerId) {
      console.log(
        "[PLAYER] Initializing with sessionId:",
        sessionId,
        "playerId:",
        playerId,
      );
      initializePlayer();
    }

    return () => {
      cleanup();
    };
  }, [sessionId, playerId]);

  const cleanup = () => {
    console.log("[PLAYER] Cleaning up subscriptions");
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (dbSubscriptionRef.current) {
      supabase.removeChannel(dbSubscriptionRef.current);
      dbSubscriptionRef.current = null;
    }
  };

  const initializePlayer = async () => {
    try {
      setLoading(true);
      console.log("[PLAYER] Fetching poll session data");

      // Get the poll session
      const { data: sessionData, error: sessionError } = await supabase
        .from("poll_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error("Poll session not found");

      setPollSession(sessionData);
      console.log("[PLAYER] Poll session loaded:", sessionData);

      // Get the players who have joined
      const { data: playersData, error: playersError } = await supabase
        .from("poll_players")
        .select("*")
        .eq("session_id", sessionId);

      if (playersError) {
        console.warn("[PLAYER] Error loading players:", playersError);
      } else {
        setPlayers(playersData || []);
        console.log("[PLAYER] Players loaded:", playersData?.length || 0);
      }

      // If the poll is completed, show the end screen
      if (sessionData.status === "completed") {
        console.log("[PLAYER] Poll is already completed");
        setPollEnded(true);
        return;
      }

      // If the poll is active and has a current question
      if (
        sessionData.status === "active" &&
        sessionData.current_question_index !== null
      ) {
        console.log(
          "[PLAYER] Poll is active, loading question:",
          sessionData.current_question_index,
        );
        await loadCurrentQuestion(
          sessionData.quiz_id,
          sessionData.current_question_index,
        );
        await checkIfAnswered(sessionData.current_question_index);
      }

      // Set up subscriptions BEFORE checking for active questions
      // This ensures we don't miss the first question broadcast
      setupSubscriptions();

      // Additional check: If poll is waiting but we should load the first question
      // This handles the case where the poll just started but we haven't received the broadcast yet
      if (
        sessionData.status === "waiting" &&
        sessionData.current_question_index === 0
      ) {
        console.log("[PLAYER] Poll just started, loading first question");
        await loadCurrentQuestion(sessionData.quiz_id, 0);
        await checkIfAnswered(0);
      }
    } catch (error: any) {
      console.error("[PLAYER] Error initializing:", error);
      toast({
        title: "Error loading poll",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupSubscriptions = () => {
    console.log("[PLAYER] Setting up subscriptions for session:", sessionId);

    // Set up database subscription for poll session changes
    dbSubscriptionRef.current = supabase
      .channel("poll_session_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "poll_sessions",
          filter: `id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log("[PLAYER] Database change received:", payload);
          const updatedSession = payload.new;
          setPollSession(updatedSession);

          // If the poll has ended
          if (updatedSession.status === "completed") {
            console.log("[PLAYER] Poll ended via database update");
            setPollEnded(true);
            return;
          }

          // If the poll just started and has a current question
          if (
            updatedSession.status === "active" &&
            updatedSession.current_question_index !== null
          ) {
            console.log(
              "[PLAYER] Poll started via database update, loading question:",
              updatedSession.current_question_index,
            );
            await loadCurrentQuestion(
              updatedSession.quiz_id,
              updatedSession.current_question_index,
            );
            await checkIfAnswered(updatedSession.current_question_index);
          }
        },
      )
      .subscribe();

    // Set up broadcast subscription for real-time question updates
    const broadcastChannel = `poll_${sessionId}_sync`;
    console.log("[PLAYER] Subscribing to broadcast channel:", broadcastChannel);

    channelRef.current = supabase
      .channel(broadcastChannel)
      .on("broadcast", { event: "question_started" }, (payload) => {
        console.log("[PLAYER] Question broadcast received:", payload);
        const { question_index, question, session_status } = payload.payload;

        if (question_index !== null && question) {
          console.log("[PLAYER] Processing broadcast question:", {
            question_index,
            question_id: question.id,
            question_text: question.text,
            options_count: question.options?.length || 0,
            session_status,
          });

          // Set the question immediately
          setCurrentQuestion({
            id: question.id,
            text: question.text,
            options: question.options || [],
          });

          // Reset answer state
          setAnswerSubmitted(false);
          setSelectedOption(null);
          setWaitingForNextQuestion(false);

          // Update poll session state
          setPollSession((prev) => ({
            ...prev,
            status: session_status || "active",
            current_question_index: question_index,
          }));

          console.log("[PLAYER] Question set successfully from broadcast");
        } else {
          console.warn("[PLAYER] Invalid broadcast payload:", payload.payload);
        }
      })
      .on("broadcast", { event: "poll_ended" }, (payload) => {
        console.log("[PLAYER] Poll ended broadcast received:", payload);
        setPollEnded(true);
      })
      .subscribe((status) => {
        console.log("[PLAYER] Broadcast subscription status:", status);
      });
  };

  const loadCurrentQuestion = async (quizId: string, questionIndex: number) => {
    try {
      console.log(
        "[PLAYER] Loading question for quiz:",
        quizId,
        "index:",
        questionIndex,
      );

      // Get all questions for this quiz
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("id", { ascending: true });

      if (questionsError) throw questionsError;
      if (!questionsData || questionIndex >= questionsData.length) {
        console.warn("[PLAYER] Question not found for index:", questionIndex);
        return;
      }

      const question = questionsData[questionIndex];
      console.log("[PLAYER] Question found:", question);

      // Get options for this question
      const { data: optionsData, error: optionsError } = await supabase
        .from("options")
        .select("id, text")
        .eq("question_id", question.id);

      if (optionsError) throw optionsError;
      console.log("[PLAYER] Options loaded:", optionsData?.length || 0);

      setCurrentQuestion({
        id: question.id,
        text: question.text,
        options: optionsData || [],
      });

      setWaitingForNextQuestion(false);
    } catch (error: any) {
      console.error("[PLAYER] Error loading question:", error);
      toast({
        title: "Error loading question",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const checkIfAnswered = async (questionIndex: number) => {
    try {
      console.log(
        "[PLAYER] Checking if already answered question:",
        questionIndex,
      );

      const { data, error } = await supabase
        .from("poll_answers")
        .select("*")
        .eq("session_id", sessionId)
        .eq("player_id", playerId)
        .eq("question_index", questionIndex)
        .single();

      if (!error && data) {
        console.log("[PLAYER] Already answered this question:", data);
        setAnswerSubmitted(true);
        setSelectedOption(data.option_id);
        setWaitingForNextQuestion(true);
      } else {
        console.log("[PLAYER] No previous answer found");
        setAnswerSubmitted(false);
        setSelectedOption(null);
        setWaitingForNextQuestion(false);
      }
    } catch (error) {
      console.log(
        "[PLAYER] Error checking answer, assuming not answered:",
        error,
      );
      setAnswerSubmitted(false);
      setSelectedOption(null);
      setWaitingForNextQuestion(false);
    }
  };

  const submitAnswer = async (optionId: string) => {
    if (answerSubmitted || !currentQuestion) {
      console.log("[PLAYER] Cannot submit - already submitted or no question");
      return;
    }

    try {
      console.log("[PLAYER] Submitting answer:", optionId);
      setAnswerSubmitted(true);
      setSelectedOption(optionId);

      const { error } = await supabase.from("poll_answers").insert({
        session_id: sessionId,
        player_id: playerId,
        question_id: currentQuestion.id,
        question_index: pollSession.current_question_index,
        option_id: optionId,
      });

      if (error) throw error;

      console.log("[PLAYER] Answer submitted successfully");
      toast({
        title: "Response submitted",
        description: "Thank you for your response!",
      });

      setWaitingForNextQuestion(true);
    } catch (error: any) {
      console.error("[PLAYER] Error submitting answer:", error);
      toast({
        title: "Error submitting response",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      setAnswerSubmitted(false);
      setSelectedOption(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-gray-100 border-t-navy animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-4 rounded-full bg-navy/20 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (pollEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#4F46E5] to-[#4F46E5] text-white flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
        <div className="fixed top-4 left-4 z-50">
          <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
        </div>
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/50 mb-4">
              <CheckCircle className="h-10 w-10 text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Poll Completed!</h1>
            <p className="text-lg opacity-90">Thank you for participating</p>
          </div>

          <Button
            onClick={() => (window.location.href = "/")}
            className="bg-white text-blue-600 hover:bg-white/90 text-lg px-8 py-6 h-auto w-full"
          >
            Join Another Poll
          </Button>
        </Card>
      </div>
    );
  }

  if (!pollSession || (pollSession.status === "waiting" && !currentQuestion)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#4F46E5] to-[#7C3AED] text-white flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Waiting for poll to start</h1>
          <p className="text-xl mb-8">The host will start the poll soon</p>

          {/* Player Count */}
          <div className="mb-4">
            <p className="text-lg font-semibold mb-2">
              {players.length} {players.length === 1 ? "player" : "players"}{" "}
              joined
            </p>
          </div>

          <p className="text-sm mb-4 opacity-75">
            Status: {pollSession?.status || "connecting"}
          </p>

          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-white/30 border-t-white animate-spin mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full bg-white/20 animate-pulse" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (waitingForNextQuestion || answerSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#4F46E5] to-[#7C3AED] text-white flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
          </div>
          <div className="mb-6">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-500/20 mb-4">
              <CheckCircle className="h-10 w-10 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Response Submitted!</h1>
            <p className="text-xl mb-8">Waiting for the next question</p>
          </div>

          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-white/30 border-t-white animate-spin mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full bg-white/20 animate-pulse" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Show the question if we have one
  if (currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-600 to-purple-600 text-white flex flex-col">
        <div className="p-4 flex justify-between items-center">
          <div className="text-lg font-bold">Poll Question</div>
          <div className="flex items-center gap-2">
            <span>
              Question {(pollSession?.current_question_index || 0) + 1}
            </span>
          </div>
        </div>

        <div className="flex justify-center mb-2">
          <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h1 className="text-2xl md:text-3xl font-bold mb-8 text-center">
            {currentQuestion.text}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-8">
            {currentQuestion.options.map((option, index) => {
              const colors = [
                "bg-blue-500 hover:bg-blue-600",
                "bg-green-500 hover:bg-green-600",
                "bg-yellow-500 hover:bg-yellow-600",
                "bg-red-500 hover:bg-red-600",
              ];
              return (
                <Button
                  key={option.id}
                  onClick={() => submitAnswer(option.id)}
                  disabled={answerSubmitted}
                  className={`${colors[index]} text-white text-lg p-8 h-auto rounded-xl ${selectedOption === option.id ? "ring-4 ring-white" : ""} ${answerSubmitted ? "opacity-50" : ""}`}
                >
                  <span className="break-words whitespace-normal">
                    {option.text}
                  </span>
                </Button>
              );
            })}
          </div>

          <p className="text-center text-white/80 text-sm">
            Select your response above
          </p>
        </div>
      </div>
    );
  }

  // Fallback - should not reach here with proper logic above
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#4F46E5] to-[#7C3AED] text-white flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-50">
        <UserMenu />
      </div>
      <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Connecting...</h1>
        <p className="text-xl mb-8">Please wait</p>
        <p className="text-sm mb-4 opacity-75">
          Debug: Poll Status: {pollSession?.status || "unknown"} | Has Question:{" "}
          {currentQuestion ? "yes" : "no"}
        </p>

        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-white/30 border-t-white animate-spin mx-auto" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 rounded-full bg-white/20 animate-pulse" />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PollPlayerGame;
