import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, CheckCircle } from "lucide-react";
import UserMenu from "@/components/ui/user-menu";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";
import Logo from "@/components/ui/logo";
import { useRef } from "react";

interface Question {
  id: string;
  text: string;
  time_limit: number;
  options: {
    id: string;
    text: string;
  }[];
}

const AnytimeQuizPlayerGame = () => {
  const { sessionId, playerId } = useParams<{
    sessionId: string;
    playerId: string;
  }>();
  const { toast } = useToast();
  const [quizSession, setQuizSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [playerData, setPlayerData] = useState<any>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionTimer, setTransitionTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [submittedAnswers, setSubmittedAnswers] = useState<Set<number>>(
    new Set(),
  );
  const [antiCheatMeasures, setAntiCheatMeasures] = useState({
    tabSwitchCount: 0,
    rightClickDisabled: true,
    devToolsDetected: false,
    screenshotAttempts: 0,
  });

  useEffect(() => {
    if (sessionId && playerId) {
      fetchQuizData();
      setupAntiCheatMeasures();
    }
  }, [sessionId, playerId]);

  const setupAntiCheatMeasures = () => {
    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setAntiCheatMeasures((prev) => ({
        ...prev,
        screenshotAttempts: prev.screenshotAttempts + 1,
      }));
      toast({
        title: "Action Blocked",
        description: "Right-click is disabled during the quiz",
        variant: "destructive",
      });
    };

    // Detect tab switching
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setAntiCheatMeasures((prev) => ({
          ...prev,
          tabSwitchCount: prev.tabSwitchCount + 1,
        }));

        if (antiCheatMeasures.tabSwitchCount >= 2) {
          toast({
            title: "Suspicious Activity Detected",
            description:
              "Multiple tab switches detected. This quiz session may be terminated.",
            variant: "destructive",
          });
        }
      }
    };

    // Detect common screenshot key combinations
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12 (DevTools)
      if (e.key === "F12") {
        e.preventDefault();
        setAntiCheatMeasures((prev) => ({ ...prev, devToolsDetected: true }));
        toast({
          title: "Action Blocked",
          description: "Developer tools are disabled during the quiz",
          variant: "destructive",
        });
      }

      // Block Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === "I") {
        e.preventDefault();
        setAntiCheatMeasures((prev) => ({ ...prev, devToolsDetected: true }));
      }

      // Block Print Screen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        setAntiCheatMeasures((prev) => ({
          ...prev,
          screenshotAttempts: prev.screenshotAttempts + 1,
        }));
        toast({
          title: "Screenshot Blocked",
          description: "Screenshots are not allowed during the quiz",
          variant: "destructive",
        });
      }

      // Block Ctrl+S (Save)
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
      }
    };

    // Add event listeners
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  };

  useEffect(() => {
    if (
      questions.length > 0 &&
      currentQuestionIndex < questions.length &&
      !showTransition &&
      !submittedAnswers.has(currentQuestionIndex)
    ) {
      const currentQuestion = questions[currentQuestionIndex];

      // Clear any old interval
      if (timerRef.current) clearInterval(timerRef.current);

      setTimeLeft(currentQuestion.time_limit);
      setSelectedOption(null);
      setAnswerSubmitted(false);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentQuestionIndex, questions, showTransition]);

  const fetchQuizData = async () => {
    try {
      setLoading(true);

      // Get the anytime quiz session
      const { data: sessionData, error: sessionError } = await supabase
        .from("anytime_quiz_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error("Quiz session not found");

      setQuizSession(sessionData);

      // Get player data
      const { data: playerInfo, error: playerError } = await supabase
        .from("anytime_quiz_players")
        .select("*")
        .eq("id", playerId)
        .single();

      if (playerError) throw playerError;
      setPlayerData(playerInfo);

      // Check if player has already completed the quiz
      if (playerInfo.completed_at) {
        setQuizCompleted(true);
        setScore(playerInfo.score);
        return;
      }

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
    } catch (error: any) {
      toast({
        title: "Error loading quiz",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = (secondsLeft: number) => {
    // Fixed score of 100 points for every correct answer
    return 100;
  };

  const handleTimeUp = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!answerSubmitted && !submittedAnswers.has(currentQuestionIndex)) {
      // Auto-submit with no answer (incorrect)
      setAnswerSubmitted(true);
      setSubmittedAnswers((prev) => new Set([...prev, currentQuestionIndex]));

      // Show transition screen and move to next question
      startTransitionToNextQuestion();
    }
  };

  const startTransitionToNextQuestion = () => {
    setShowTransition(true);
    setTransitionTimer(5);

    const transitionInterval = setInterval(() => {
      setTransitionTimer((prev) => {
        if (prev <= 1) {
          clearInterval(transitionInterval);
          setShowTransition(false);

          // Reset local state before next question
          setAnswerSubmitted(false);
          setSelectedOption(null);

          if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
          } else {
            completeQuiz();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const submitAnswer = async () => {
    if (
      answerSubmitted ||
      !selectedOption ||
      submittedAnswers.has(currentQuestionIndex)
    )
      return;

    setAnswerSubmitted(true);
    setSubmittedAnswers((prev) => new Set([...prev, currentQuestionIndex]));

    try {
      const currentQuestion = questions[currentQuestionIndex];
      let isCorrect = false;
      let pointsEarned = 0;

      // Get the correct answer
      const { data: correctOption, error: optionError } = await supabase
        .from("options")
        .select("id, is_correct")
        .eq("question_id", currentQuestion.id)
        .eq("is_correct", true)
        .single();

      if (optionError) throw optionError;

      isCorrect = correctOption?.id === selectedOption;
      pointsEarned = isCorrect ? calculateScore(timeLeft) : 0;

      // Update local score (but don't show it to player)
      if (isCorrect) {
        setScore((prevScore) => prevScore + pointsEarned);
      }

      // Submit the answer with anti-cheat data
      const { error } = await supabase.from("anytime_quiz_answers").insert({
        session_id: sessionId,
        player_id: playerId,
        question_id: currentQuestion.id,
        question_index: currentQuestionIndex,
        option_id: selectedOption,
        is_correct: isCorrect,
        time_taken: currentQuestion.time_limit - timeLeft,
      });

      // Log suspicious activity if detected
      if (
        antiCheatMeasures.tabSwitchCount > 0 ||
        antiCheatMeasures.screenshotAttempts > 0 ||
        antiCheatMeasures.devToolsDetected
      ) {
        await supabase
          .from("anytime_participants")
          .update({
            // Log suspicious activity in a separate field or table
          })
          .eq("id", playerId);
      }

      if (error) throw error;

      // Start transition to next question with timer
      startTransitionToNextQuestion();
    } catch (error: any) {
      toast({
        title: "Error submitting answer",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      setAnswerSubmitted(false);
      setSubmittedAnswers((prev) => {
        const newSet = new Set([...prev]);
        newSet.delete(currentQuestionIndex);
        return newSet;
      });
    }
  };

  const completeQuiz = async () => {
    try {
      // Update player's completion status and final score
      const { error } = await supabase
        .from("anytime_quiz_players")
        .update({
          score: score,
          completed_at: new Date().toISOString(),
        })
        .eq("id", playerId);

      if (error) throw error;

      setQuizCompleted(true);
    } catch (error: any) {
      toast({
        title: "Error completing quiz",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
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

  if (quizCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#7C3AED] to-[#7C3AED] text-white flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
        <div className="fixed top-4 left-4 z-50">
          <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
        </div>
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/50 mb-4">
              <CheckCircle className="h-10 w-10 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Quiz Completed!</h1>
            <p className="text-lg opacity-90 mb-4">
              Thank you for participating
            </p>
            <div className="bg-white/20 rounded-lg p-4 mb-4">
              <div className="text-2xl font-bold">Quiz Completed!</div>
              <div className="text-sm opacity-80">
                Thank you for participating
              </div>
            </div>
          </div>

          <Button
            onClick={() => (window.location.href = "/")}
            className="bg-white text-purple-600 hover:bg-white/90 text-lg px-8 py-6 h-auto w-full"
          >
            Take Another Quiz
          </Button>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#7C3AED] to-[#7C3AED] text-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl p-8 text-center">
          <h1 className="text-3xl font-bold mb-4">No Questions Available</h1>
          <p className="text-lg opacity-90 mb-6">
            This quiz doesn't have any questions yet.
          </p>
          <Button
            onClick={() => (window.location.href = "/")}
            className="bg-white text-purple-600 hover:bg-white/90 text-lg px-8 py-6 h-auto w-full"
          >
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 text-white flex flex-col select-none"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
      }}
    >
      <div className="p-4 flex justify-between items-center">
        <div className="text-2xl font-bold">{timeLeft}s</div>
        <div className="flex items-center gap-4">
          {/* Anti-cheat indicators */}
          {antiCheatMeasures.tabSwitchCount > 0 && (
            <div className="flex items-center gap-1 text-red-300 text-xs">
              <AlertTriangle className="h-4 w-4" />
              <span>Tab switches: {antiCheatMeasures.tabSwitchCount}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <span>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-4">
        <div className="h-2 bg-white/20 rounded-full">
          <div
            className="h-2 bg-white rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="flex justify-center mb-2">
        <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl md:text-3xl font-bold mb-8 text-center">
          {currentQuestion.text}
        </h1>

        {showTransition ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/20 mb-6">
              <div className="text-3xl font-bold text-white">
                {transitionTimer}
              </div>
            </div>
            <p className="text-2xl mb-4 font-bold">Answer submitted!</p>
            <p className="text-white/80 text-lg">
              {currentQuestionIndex < questions.length - 1
                ? `Next question in ${transitionTimer} seconds...`
                : "Completing quiz..."}
            </p>
            <div className="mt-6">
              <div className="h-2 bg-white/20 rounded-full max-w-xs mx-auto">
                <div
                  className="h-2 bg-white rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${((5 - transitionTimer) / 5) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        ) : answerSubmitted || submittedAnswers.has(currentQuestionIndex) ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-white/20 mb-4">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <p className="text-xl mb-4">Answer already submitted!</p>
            <p className="text-white/80">
              You can only submit one answer per question.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
                    onClick={() => setSelectedOption(option.id)}
                    disabled={timeLeft === 0}
                    className={`${colors[index]} text-white text-lg p-8 h-auto rounded-xl ${selectedOption === option.id ? "ring-4 ring-white" : ""} ${timeLeft === 0 ? "opacity-50" : ""}`}
                  >
                    <span className="break-words whitespace-normal">
                      {option.text}
                    </span>
                  </Button>
                );
              })}
            </div>

            <div className="text-center">
              <Button
                onClick={submitAnswer}
                disabled={
                  !selectedOption ||
                  answerSubmitted ||
                  timeLeft === 0 ||
                  submittedAnswers.has(currentQuestionIndex)
                }
                className="bg-white text-purple-600 hover:bg-white/90 text-xl font-bold px-12 py-6 h-auto rounded-xl disabled:opacity-50"
              >
                {submittedAnswers.has(currentQuestionIndex)
                  ? "Answer Already Submitted"
                  : !selectedOption
                    ? "Select an Answer"
                    : "Submit Answer"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnytimeQuizPlayerGame;
