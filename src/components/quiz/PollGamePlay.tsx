import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, Users, BarChart3 } from "lucide-react";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../auth/VercelAuthProvider";
import { useToast } from "@/components/ui/use-toast";
import UserMenu from "@/components/ui/user-menu";
import Logo from "@/components/ui/logo";

interface Question {
  id: string;
  text: string;
  options: {
    id: string;
    text: string;
  }[];
}

const PollGamePlay = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pollSession, setPollSession] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [answerStats, setAnswerStats] = useState<{ [key: string]: number }>({});
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pollEnded, setPollEnded] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (sessionId) {
      initializePoll();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (sessionId && currentQuestionIndex >= 0) {
      const cleanup = subscribeToAnswers();
      return cleanup;
    }
  }, [sessionId, currentQuestionIndex]);

  const initializePoll = async () => {
    try {
      setLoading(true);
      console.log("[HOST] Initializing poll for session:", sessionId);

      // Get the poll session
      const { data: sessionData, error: sessionError } = await supabase
        .from("poll_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error("Poll session not found");

      // Check if the current user is the host
      if (sessionData.host_id !== user?.id) {
        toast({
          title: "Access denied",
          description: "You are not the host of this poll",
          variant: "destructive",
        });
        navigate("/host");
        return;
      }

      setPollSession(sessionData);
      console.log("[HOST] Poll session loaded:", sessionData);

      // Get the quiz details
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", sessionData.quiz_id)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);

      // Get all questions for this quiz
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", sessionData.quiz_id)
        .order("id", { ascending: true });

      if (questionsError) throw questionsError;

      // For each question, get its options
      const questionsWithOptions = await Promise.all(
        (questionsData || []).map(async (question) => {
          const { data: optionsData, error: optionsError } = await supabase
            .from("options")
            .select("id, text")
            .eq("question_id", question.id);

          if (optionsError) throw optionsError;

          return {
            ...question,
            options: optionsData || [],
          };
        }),
      );

      setQuestions(questionsWithOptions);
      console.log("[HOST] Questions loaded:", questionsWithOptions.length);

      // Get the players who have joined
      const { data: playersData, error: playersError } = await supabase
        .from("poll_players")
        .select("*")
        .eq("session_id", sessionId);

      if (playersError) throw playersError;
      setPlayers(playersData || []);
      console.log("[HOST] Players loaded:", playersData?.length || 0);

      // If the poll is already in progress, get the current question index
      if (sessionData.current_question_index !== null) {
        setCurrentQuestionIndex(sessionData.current_question_index);
        await refreshAnswerStats(sessionData.current_question_index);
      }

      // Set up broadcast channel
      setupBroadcastChannel();
    } catch (error: any) {
      console.error("[HOST] Error initializing poll:", error);
      toast({
        title: "Error loading poll",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      navigate("/host");
    } finally {
      setLoading(false);
    }
  };

  const setupBroadcastChannel = () => {
    const channelName = `poll_${sessionId}_sync`;
    console.log("[HOST] Setting up broadcast channel:", channelName);

    channelRef.current = supabase.channel(channelName);

    channelRef.current.subscribe((status: string) => {
      console.log("[HOST] Channel status:", status);
    });
  };

  const subscribeToAnswers = () => {
    const subscription = supabase
      .channel(`poll_${sessionId}_answers`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "poll_answers",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const answer = payload.new;
          if (answer.question_index === currentQuestionIndex) {
            refreshAnswerStats(currentQuestionIndex);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const refreshAnswerStats = async (
    questionIndex: number = currentQuestionIndex,
  ) => {
    try {
      console.log(`[HOST] Refreshing stats for question ${questionIndex + 1}`);

      const { data: answers, error } = await supabase
        .from("poll_answers")
        .select("option_id")
        .eq("session_id", sessionId)
        .eq("question_index", questionIndex);

      if (error) {
        console.error(`[HOST] Database error:`, error);
        throw error;
      }

      console.log(
        `[HOST] Found ${answers?.length || 0} answers for question ${questionIndex + 1}`,
      );

      const stats: { [key: string]: number } = {};
      if (questions[questionIndex]) {
        questions[questionIndex].options.forEach((option) => {
          stats[option.id] = 0;
        });
      }

      answers?.forEach((answer) => {
        if (stats.hasOwnProperty(answer.option_id)) {
          stats[answer.option_id]++;
        }
      });

      console.log(`[HOST] Updated stats:`, stats);

      setAnswerStats({ ...stats });
      setTotalAnswers(answers?.length || 0);
    } catch (error: any) {
      console.error(`[HOST] Error fetching answer stats:`, error);
    }
  };

  const startPoll = async () => {
    if (questions.length === 0) {
      toast({
        title: "No questions",
        description: "This poll doesn't have any questions",
        variant: "destructive",
      });
      return;
    }

    if (players.length === 0) {
      toast({
        title: "Cannot start poll",
        description: "At least 1 player is required to start the poll",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("[HOST] Starting poll with", questions.length, "questions");

      // First, update the database
      const { error: dbError } = await supabase
        .from("poll_sessions")
        .update({
          status: "active",
          current_question_index: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (dbError) throw dbError;
      console.log("[HOST] Database updated to active status");

      // Update local state
      setCurrentQuestionIndex(0);
      setPollSession((prev) => ({
        ...prev,
        status: "active",
        current_question_index: 0,
      }));

      // Prepare question data
      const questionData = {
        id: questions[0].id,
        text: questions[0].text,
        options: questions[0].options || [],
      };

      console.log("[HOST] Broadcasting first question:", questionData);

      // Broadcast the first question
      if (channelRef.current) {
        const result = await channelRef.current.send({
          type: "broadcast",
          event: "question_started",
          payload: {
            question_index: 0,
            question: questionData,
            session_status: "active",
            timestamp: Date.now(),
          },
        });
        console.log("[HOST] Broadcast result:", result);
      }

      // Initialize answer stats
      const initialStats: { [key: string]: number } = {};
      questions[0].options.forEach((option) => {
        initialStats[option.id] = 0;
      });
      setAnswerStats(initialStats);
      setTotalAnswers(0);

      console.log("[HOST] Poll started successfully");
    } catch (error: any) {
      console.error("[HOST] Error starting poll:", error);
      toast({
        title: "Error starting poll",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const nextQuestion = async () => {
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      await endPoll();
      return;
    }

    try {
      console.log(`[HOST] Moving to question ${nextIndex + 1}`);

      // Update database
      const { error: dbError } = await supabase
        .from("poll_sessions")
        .update({
          current_question_index: nextIndex,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (dbError) throw dbError;
      console.log("[HOST] Database updated with next question index");

      // Update local state
      setCurrentQuestionIndex(nextIndex);

      // Prepare question data
      const questionData = {
        id: questions[nextIndex].id,
        text: questions[nextIndex].text,
        options: questions[nextIndex].options || [],
      };

      console.log("[HOST] Broadcasting next question:", questionData);

      // Broadcast the next question
      if (channelRef.current) {
        const result = await channelRef.current.send({
          type: "broadcast",
          event: "question_started",
          payload: {
            question_index: nextIndex,
            question: questionData,
            session_status: "active",
            timestamp: Date.now(),
          },
        });
        console.log("[HOST] Broadcast result:", result);
      }

      // Initialize fresh answer stats for the new question
      const freshStats: { [key: string]: number } = {};
      questions[nextIndex].options.forEach((option) => {
        freshStats[option.id] = 0;
      });
      setAnswerStats(freshStats);
      setTotalAnswers(0);

      console.log(`[HOST] Successfully moved to question ${nextIndex + 1}`);
    } catch (error: any) {
      console.error(`[HOST] Error moving to next question:`, error);
      toast({
        title: "Error loading next question",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const endPoll = async () => {
    try {
      console.log("[HOST] Ending poll");

      // Update database
      const { error } = await supabase
        .from("poll_sessions")
        .update({
          status: "completed",
          current_question_index: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) throw error;
      console.log("[HOST] Database updated to completed status");

      // Broadcast poll end to all participants
      if (channelRef.current) {
        const result = await channelRef.current.send({
          type: "broadcast",
          event: "poll_ended",
          payload: {
            timestamp: Date.now(),
          },
        });
        console.log("[HOST] Poll end broadcast result:", result);
      }

      setPollEnded(true);
      console.log("[HOST] Poll ended successfully");
    } catch (error: any) {
      console.error("[HOST] Error ending poll:", error);
      toast({
        title: "Error ending poll",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-16 flex items-center justify-center">
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
      <div className="min-h-screen bg-[#f5f5f7] pt-16 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Poll Completed!
            </h1>
            <p className="text-xl text-gray-600">{quiz?.title}</p>
          </div>

          <Card className="bg-white shadow-sm border-gray-100 p-8 mb-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-blue-500/20 mb-4">
                <BarChart3 className="h-10 w-10 text-blue-500" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Poll Results</h2>
              <p className="text-gray-600 mb-6">
                Total Participants: {players.length}
              </p>
              <Button
                onClick={() => navigate("/host")}
                className="bg-navy hover:bg-navy/90 text-lg px-8 py-6 h-auto"
              >
                Back to Host Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (currentQuestionIndex === -1 && pollSession?.status !== "active") {
    return (
      <div className="min-h-screen bg-[#f5f5f7] pt-16 pb-12">
        <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
          <Link to="/">
            <Logo className="h-12 w-auto ml-0 sm:ml-16" />
          </Link>
          <UserMenu />
        </div>
        <div className="max-w-4xl mx-auto px-4 text-center mt-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {quiz?.title} - Poll Mode
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {questions.length} questions
          </p>

          <Card className="bg-white shadow-sm border-gray-100 p-8 mb-8">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-4 text-center">
                Ready to Start Poll?
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                {players.length}{" "}
                {players.length === 1 ? "participant has" : "participants have"}{" "}
                joined.
              </p>

              {/* Player List */}
              {players.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-center">
                    Joined Players:
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {players.map((player, index) => (
                      <div
                        key={player.id}
                        className="bg-gray-50 rounded-lg p-3 text-center border"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {player.name || `Player ${index + 1}`}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Joined{" "}
                          {new Date(player.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                <Button
                  onClick={() => navigate(`/poll-monitor/${sessionId}`)}
                  variant="outline"
                  className="gap-2 text-lg px-8 py-6 h-auto"
                >
                  <Users className="h-5 w-5" />
                  Monitor Players
                </Button>
                <Button
                  onClick={startPoll}
                  className="bg-blue-600 hover:bg-blue-700 gap-2 text-lg px-8 py-6 h-auto"
                >
                  Start Poll
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const questionNumber = currentQuestionIndex + 1;
  const totalQuestions = questions.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 pt-16 pb-12">
      <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
        <Logo className="bg-white/20 backdrop-blur-md p-1 rounded ml-0 sm:ml-16" />
        <UserMenu />
      </div>
      <div className="max-w-4xl mx-auto px-4 mt-16">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              Poll Question {questionNumber} of {totalQuestions}
            </h2>
          </div>
          <div className="flex items-center gap-4 text-white">
            <div className="flex items-center">
              <Users className="inline h-5 w-5 mr-2" />
              {players.length} players joined
            </div>
            <div className="flex items-center">
              <BarChart3 className="inline h-5 w-5 mr-2" />
              {totalAnswers} responses
            </div>
          </div>
        </div>

        <Card className="bg-white shadow-sm border-gray-100 p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-center">
            {currentQuestion.text}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {currentQuestion.options.map((option, index) => {
              const answerCount = answerStats[option.id] || 0;
              const percentage =
                totalAnswers > 0
                  ? Math.round((answerCount / totalAnswers) * 100)
                  : 0;
              const colors = [
                "bg-blue-500",
                "bg-green-500",
                "bg-yellow-500",
                "bg-red-500",
              ];

              return (
                <div
                  key={option.id}
                  className={`p-6 rounded-xl ${colors[index]} text-white relative overflow-hidden border-2 border-white/20`}
                >
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-lg font-medium leading-tight pr-2 flex-1">
                        {option.text}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold drop-shadow-lg">
                          {percentage}%
                        </span>
                        <span className="text-sm opacity-90 font-medium">
                          ({answerCount} votes)
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 h-3 bg-black/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/80 rounded-full transition-all duration-700 ease-out shadow-inner"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center gap-4">
            <Button
              onClick={endPoll}
              variant="outline"
              className="bg-red-500 hover:bg-red-600 text-white border-red-500 gap-2 text-lg px-8 py-6 h-auto"
            >
              End Poll
            </Button>
            <Button
              onClick={nextQuestion}
              className="bg-blue-600 hover:bg-blue-700 gap-2 text-lg px-8 py-6 h-auto"
            >
              {currentQuestionIndex < questions.length - 1 ? (
                <>
                  Next Question
                  <ChevronRight className="h-5 w-5" />
                </>
              ) : (
                "Finish Poll"
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PollGamePlay;
