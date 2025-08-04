import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Award, Clock } from "lucide-react";
import UserMenu from "@/components/ui/user-menu";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";
import Logo from "@/components/ui/logo";

interface Question {
  id: string;
  text: string;
  time_limit: number;
  options: {
    id: string;
    text: string;
  }[];
}

const PlayerGame = () => {
  const { sessionId, playerId } = useParams<{
    sessionId: string;
    playerId: string;
  }>();
  const { toast } = useToast();
  const [gameSession, setGameSession] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [finalAnswerSubmitted, setFinalAnswerSubmitted] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [waitingForNextQuestion, setWaitingForNextQuestion] = useState(false);
  const [showGetReady, setShowGetReady] = useState(false);

  useEffect(() => {
    if (sessionId && playerId) {
      fetchGameSession();
      subscribeToGameChanges();
    }
  }, [sessionId, playerId]);

  const fetchGameSession = async () => {
    try {
      setLoading(true);
      // Get the game session
      const { data: sessionData, error: sessionError } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error("Game session not found");

      setGameSession(sessionData);
      // If the game is completed, show the final results
      if (sessionData.status === "completed") {
        setGameEnded(true);
        await fetchFinalResults();
        return;
      }

      // If the game is active and has a current question
      if (
        sessionData.status === "active" &&
        sessionData.current_question_index !== null
      ) {
        // *** MODIFICATION START ***
        // If it's the very first question, show "Get Ready" for a moment
        if (
          sessionData.current_question_index === 0 &&
          !sessionStorage.getItem("hasSeenGetReady")
        ) {
          setShowGetReady(true); // show loading screen
          setTimeout(() => {
            setShowGetReady(false);
            fetchCurrentQuestion(
              sessionData.quiz_id,
              sessionData.current_question_index,
            );
            sessionStorage.setItem("hasSeenGetReady", "true");
          }, 3000);
        } else {
          await fetchCurrentQuestion(
            sessionData.quiz_id,
            sessionData.current_question_index,
          );
        }
        // *** MODIFICATION END ***

        await checkIfAnswered(sessionData.current_question_index);
        setFinalAnswerSubmitted(false);
        setCanSubmit(false);
      }
    } catch (error: any) {
      toast({
        title: "Error loading game",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentQuestion = async (
    quizId: string,
    questionIndex: number,
  ) => {
    try {
      // Get all questions for this quiz
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("id", { ascending: true });
      if (questionsError) throw questionsError;
      if (!questionsData || questionIndex >= questionsData.length) return;

      const question = questionsData[questionIndex];
      // Get options for this question
      const { data: optionsData, error: optionsError } = await supabase
        .from("options")
        .select("id, text")
        .eq("question_id", question.id);
      if (optionsError) throw optionsError;

      // Set the question data and start the timer
      setCurrentQuestion({
        ...question,
        options: optionsData || [],
      });
      setTimeLeft(question.time_limit);
      setWaitingForNextQuestion(false);

      // Start the countdown timer
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Error loading question",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const checkIfAnswered = async (questionIndex: number) => {
    try {
      const { data, error } = await supabase
        .from("game_answers")
        .select("*")
        .eq("session_id", sessionId)
        .eq("player_id", playerId)
        .eq("question_index", questionIndex)
        .single();

      if (!error && data) {
        setFinalAnswerSubmitted(true);
        setSelectedOption(data.option_id);
        setCanSubmit(false);
      } else {
        setFinalAnswerSubmitted(false);
        setSelectedOption(null);
        setCanSubmit(false);
      }
    } catch (error) {
      // If no answer found, that's fine
      setFinalAnswerSubmitted(false);
      setSelectedOption(null);
    }
  };

  const fetchFinalResults = async () => {
    try {
      // Get all players and their scores
      const { data: playersData, error: playersError } = await supabase
        .from("game_players")
        .select("id, player_name, score")
        .eq("session_id", sessionId)
        .order("score", { ascending: false });

      if (playersError) throw playersError;

      // Find this player's score and rank
      // Sort players by score in descending order to ensure correct ranking
      const sortedPlayers =
        playersData?.sort((a, b) => b.score - a.score) || [];
      const playerIndex = sortedPlayers.findIndex((p) => p.id === playerId);

      if (playerIndex !== -1) {
        setScore(sortedPlayers[playerIndex].score || 0);
        setPlayerRank(playerIndex + 1); // +1 because array index is 0-based but ranks start at 1
      }
    } catch (error: any) {
      toast({
        title: "Error loading results",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const subscribeToGameChanges = () => {
    const subscription = supabase
      .channel("game_session_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const updatedSession = payload.new;
          setGameSession(updatedSession);

          if (updatedSession.status === "completed") {
            setGameEnded(true);
            fetchFinalResults();
            return;
          }

          // When game becomes active and has a current question index
          if (
            updatedSession.status === "active" &&
            updatedSession.current_question_index !== null
          ) {
            const newIndex = updatedSession.current_question_index;

            // Explicitly check for the "Get Ready!" signal from the host
            if (newIndex === -2) {
              setShowGetReady(true);
              setCurrentQuestion(null);
            }
            // Check if a new, valid question is being sent
            else if (newIndex >= 0) {
              setShowGetReady(false); // Hide the "Get Ready!" screen
              fetchCurrentQuestion(updatedSession.quiz_id, newIndex);
              checkIfAnswered(newIndex);
              setFinalAnswerSubmitted(false);
              setCanSubmit(false);
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const calculateScore = (secondsLeft: number) => {
    // Base score is 1000, with bonus points for answering quickly
    return 1000 + secondsLeft * 50;
  };

  const selectAnswer = (optionId: string) => {
    if (finalAnswerSubmitted || !currentQuestion || timeLeft === 0) return;
    setSelectedOption(optionId);
    setCanSubmit(true);
  };

  const submitAnswer = () => {
    if (!selectedOption || finalAnswerSubmitted) return;
    submitFinalAnswer(selectedOption);
  };

  const submitFinalAnswer = async (optionId: string) => {
    if (finalAnswerSubmitted || !currentQuestion) return;

    setFinalAnswerSubmitted(true);

    try {
      console.log("Submitting answer:", {
        sessionId,
        playerId,
        questionId: currentQuestion.id,
        questionIndex: gameSession.current_question_index,
        optionId,
        timeTaken: currentQuestion.time_limit - timeLeft,
      });

      // Get the correct answer
      const { data: correctOption, error: optionError } = await supabase
        .from("options")
        .select("id, is_correct")
        .eq("question_id", currentQuestion.id)
        .eq("is_correct", true)
        .single();

      if (optionError) {
        console.error("Error fetching correct option:", optionError);
        throw optionError;
      }

      const isCorrect = correctOption?.id === optionId;

      // Calculate score using the same formula as the host
      const pointsEarned = isCorrect ? calculateScore(timeLeft) : 0;

      // Update local score
      if (isCorrect) {
        setScore((prevScore) => prevScore + pointsEarned);
      }

      // Submit the answer
      const { data: insertedAnswer, error } = await supabase
        .from("game_answers")
        .insert({
          session_id: sessionId,
          player_id: playerId,
          question_id: currentQuestion.id,
          question_index: gameSession.current_question_index,
          option_id: optionId,
          is_correct: isCorrect,
          time_taken: currentQuestion.time_limit - timeLeft,
        })
        .select();

      if (error) {
        console.error("Error inserting answer:", error);
        throw error;
      }

      console.log("Answer submitted successfully:", insertedAnswer);

      // Show feedback
      toast({
        title: isCorrect ? "Correct!" : "Incorrect",
        description: isCorrect
          ? `You got it right! +${pointsEarned} points`
          : "Better luck next time",
        variant: isCorrect ? "default" : "destructive",
      });

      // Now wait for the next question
      setWaitingForNextQuestion(true);
    } catch (error: any) {
      console.error("Error in submitFinalAnswer:", error);
      toast({
        title: "Error submitting answer",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      setFinalAnswerSubmitted(false);
    }
  };

  if (showGetReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#46178F] to-[#7B2CBF] text-white flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Get Ready!</h1>
          <p className="text-xl mb-8">The next question is coming up...</p>
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

  if (gameEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FF6952] to-[#FF6952] text-white flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
        <div className="fixed top-4 left-4 z-50">
          <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
        </div>
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/50 mb-4">
              <Award className="h-10 w-10 text-coral" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Thanks for playing!</h1>
          </div>

          <Button
            onClick={() => (window.location.href = "/")}
            className="bg-white text-navy hover:bg-white/90 text-lg px-8 py-6 h-auto w-full"
          >
            Play Again
          </Button>
        </Card>
      </div>
    );
  }

  if (!gameSession || gameSession.status === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#46178F] to-[#7B2CBF] text-white flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Waiting for game to start</h1>
          <p className="text-xl mb-8">The host will start the game soon</p>

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

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#46178F] to-[#7B2CBF] text-white flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Get Ready!</h1>
          <p className="text-xl mb-8">The next question is coming up</p>

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

  if (waitingForNextQuestion || timeLeft === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#46178F] to-[#7B2CBF] text-white flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
          </div>
          <h1 className="text-3xl font-bold mb-4">
            {finalAnswerSubmitted ? "Answer Submitted!" : "Time's Up!"}
          </h1>
          <p className="text-xl mb-8">Waiting for the next question</p>

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 text-white flex flex-col">
      <div className="p-4 flex justify-between items-center">
        <div className="text-2xl font-bold">{timeLeft}s</div>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <span>Question {gameSession.current_question_index + 1}</span>
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
              "bg-coral hover:bg-coral/80", // Coral
              "bg-skyblue hover:bg-skyblue/80", // Sky Blue
              "bg-navy hover:bg-navy/80", // Navy
              "bg-coral/80 hover:bg-coral/60", // Light Coral
            ];
            return (
              <Button
                key={option.id}
                onClick={() => selectAnswer(option.id)}
                disabled={finalAnswerSubmitted}
                className={`${colors[index]} text-white text-lg p-8 h-auto rounded-xl ${selectedOption === option.id ? "ring-4 ring-white" : ""} ${finalAnswerSubmitted ? "opacity-50" : ""}`}
              >
                <span className="break-words whitespace-normal">
                  {option.text}
                </span>
              </Button>
            );
          })}
        </div>

        {selectedOption && !finalAnswerSubmitted && (
          <Button
            onClick={submitAnswer}
            disabled={!canSubmit || finalAnswerSubmitted}
            className="bg-white text-navy hover:bg-white/90 text-xl font-bold px-12 py-6 h-auto rounded-xl"
          >
            Submit Answer
          </Button>
        )}
      </div>
    </div>
  );
};

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export default PlayerGame;
