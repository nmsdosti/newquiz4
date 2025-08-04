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

const LiveQuizPlayerGame = () => {
  const { sessionId, playerId } = useParams<{
    sessionId: string;
    playerId: string;
  }>();
  const { toast } = useToast();
  const [quizSession, setQuizSession] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [waitingForNextQuestion, setWaitingForNextQuestion] = useState(false);

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

      setQuizSession(sessionData);

      // If the game is completed, show the final results
      if (sessionData.status === "completed") {
        setGameEnded(true);
        return;
      }

      // If the game is active and has a current question
      if (
        sessionData.status === "active" &&
        sessionData.current_question_index !== null
      ) {
        await fetchCurrentQuestion(
          sessionData.quiz_id,
          sessionData.current_question_index,
        );
        await checkIfAnswered(sessionData.current_question_index);
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

      setCurrentQuestion({
        ...question,
        options: optionsData || [],
      });
      setTimeLeft(question.time_limit);
      setWaitingForNextQuestion(false);

      // Start countdown timer
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            if (!answerSubmitted) {
              setWaitingForNextQuestion(true);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Clean up timer on component unmount
      return () => clearInterval(timer);
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
        setAnswerSubmitted(true);
        setSelectedOption(data.option_id);
      } else {
        setAnswerSubmitted(false);
        setSelectedOption(null);
      }
    } catch (error) {
      setAnswerSubmitted(false);
      setSelectedOption(null);
    }
  };

  const subscribeToGameChanges = () => {
    const subscription = supabase
      .channel(`game_${sessionId}_sync`)
      .on("broadcast", { event: "game_started" }, async (payload) => {
        const { question_index } = payload.payload;
        await fetchCurrentQuestion(quizSession.quiz_id, question_index);
        await checkIfAnswered(question_index);
      })
      .on("broadcast", { event: "next_question" }, async (payload) => {
        const { question_index } = payload.payload;
        await fetchCurrentQuestion(quizSession.quiz_id, question_index);
        await checkIfAnswered(question_index);
      })
      .on("broadcast", { event: "game_ended" }, () => {
        setGameEnded(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const selectAnswer = (optionId: string) => {
    if (answerSubmitted || !currentQuestion || timeLeft === 0) return;
    setSelectedOption(optionId);
  };

  const submitAnswer = async () => {
    if (!selectedOption || answerSubmitted || !currentQuestion) return;

    setAnswerSubmitted(true);

    try {
      // Get the correct answer
      const { data: correctOption, error: optionError } = await supabase
        .from("options")
        .select("id, is_correct")
        .eq("question_id", currentQuestion.id)
        .eq("is_correct", true)
        .single();

      if (optionError) throw optionError;

      const isCorrect = correctOption?.id === selectedOption;
      const pointsEarned = isCorrect ? 1000 : 0;

      // Update local score
      if (isCorrect) {
        setScore((prevScore) => prevScore + pointsEarned);
      }

      // Submit the answer
      const { error } = await supabase.from("game_answers").insert({
        session_id: sessionId,
        player_id: playerId,
        question_id: currentQuestion.id,
        question_index: quizSession.current_question_index,
        option_id: selectedOption,
        is_correct: isCorrect,
        time_taken: currentQuestion.time_limit - timeLeft,
      });

      if (error) throw error;

      // Update player score in database
      if (isCorrect) {
        await supabase
          .from("game_players")
          .update({ score: score + pointsEarned })
          .eq("id", playerId);
      }

      toast({
        title: isCorrect ? "Correct!" : "Incorrect",
        description: isCorrect
          ? `You got it right! +${pointsEarned} points`
          : "Better luck next time",
        variant: isCorrect ? "default" : "destructive",
      });

      setWaitingForNextQuestion(true);
    } catch (error: any) {
      toast({
        title: "Error submitting answer",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      setAnswerSubmitted(false);
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
            <p className="text-lg opacity-90">Final Score: {score} points</p>
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

  if (!quizSession || quizSession.status === "waiting") {
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
            {answerSubmitted ? "Answer Submitted!" : "Time's Up!"}
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
          <span>Question {(quizSession?.current_question_index || 0) + 1}</span>
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
              "bg-coral hover:bg-coral/80",
              "bg-skyblue hover:bg-skyblue/80",
              "bg-navy hover:bg-navy/80",
              "bg-coral/80 hover:bg-coral/60",
            ];
            return (
              <Button
                key={option.id}
                onClick={() => selectAnswer(option.id)}
                disabled={answerSubmitted || timeLeft === 0}
                className={`${colors[index]} text-white text-lg p-8 h-auto rounded-xl ${
                  selectedOption === option.id ? "ring-4 ring-white" : ""
                } ${answerSubmitted ? "opacity-50" : ""}`}
              >
                <span className="break-words whitespace-normal">
                  {option.text}
                </span>
              </Button>
            );
          })}
        </div>

        {selectedOption && !answerSubmitted && timeLeft > 0 && (
          <Button
            onClick={submitAnswer}
            className="bg-white text-navy hover:bg-white/90 text-xl font-bold px-12 py-6 h-auto rounded-xl"
          >
            Submit Answer
          </Button>
        )}

        <div className="mt-4 text-center">
          <p className="text-white/80 text-sm">Score: {score} points</p>
        </div>
      </div>
    </div>
  );
};

export default LiveQuizPlayerGame;
