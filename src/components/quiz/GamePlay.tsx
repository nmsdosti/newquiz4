import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ChevronRight,
  Award,
  TrendingUp,
  Users,
  Target,
  Clock,
  BarChart3,
  PieChart,
} from "lucide-react";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../auth/VercelAuthProvider";
import { useToast } from "@/components/ui/use-toast";
import UserMenu from "@/components/ui/user-menu";
import Logo from "@/components/ui/logo";

interface Question {
  id: string;
  text: string;
  time_limit: number;
  options: {
    id: string;
    text: string;
    is_correct: boolean;
  }[];
}

interface Player {
  id: string;
  name: string;
  score: number;
  avatar: string;
}

const GamePlay = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [gameSession, setGameSession] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1); // -1 means not started
  const [timeLeft, setTimeLeft] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [answerStats, setAnswerStats] = useState<{ [key: string]: number }>({});
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [isCalculatingResults, setIsCalculatingResults] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);

  useEffect(() => {
    if (sessionId) {
      fetchGameData();
      subscribeToAnswers();

      // Subscribe to synchronization events
      const syncChannel = supabase.channel(`game_${sessionId}_sync`);
      syncChannel
        .on("broadcast", { event: "question_changed" }, (payload) => {
          console.log("[SYNC] Question change broadcast received:", payload);
          // Force refresh when question changes
          setTimeout(() => {
            refreshAnswerStats();
          }, 100);
        })
        .on("broadcast", { event: "question_started" }, (payload) => {
          console.log("[SYNC] Question start broadcast received:", payload);
          // Ensure timing synchronization
          if (payload.payload.question_index === currentQuestionIndex) {
            refreshAnswerStats();
          }
        })
        .subscribe();

      return () => {
        syncChannel.unsubscribe();
      };
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionId]);

  const fetchGameData = async () => {
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

      // Check if the current user is the host
      if (sessionData.host_id !== user?.id) {
        toast({
          title: "Access denied",
          description: "You are not the host of this game",
          variant: "destructive",
        });
        navigate("/host");
        return;
      }

      setGameSession(sessionData);

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
            .select("*")
            .eq("question_id", question.id);

          if (optionsError) throw optionsError;

          return {
            ...question,
            options: optionsData || [],
          };
        }),
      );

      setQuestions(questionsWithOptions);

      // Get the players who have joined
      const { data: playersData, error: playersError } = await supabase
        .from("game_players")
        .select("*")
        .eq("session_id", sessionId);

      if (playersError) throw playersError;

      const formattedPlayers = (playersData || []).map((player) => ({
        id: player.id,
        name: player.player_name,
        score: 0,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.player_name}`,
      }));

      setPlayers(formattedPlayers);

      // If the game is already in progress, get the current question index
      if (sessionData.current_question_index !== null) {
        setCurrentQuestionIndex(sessionData.current_question_index);

        // If there's an active question, start the timer and fetch current stats
        if (
          sessionData.current_question_index >= 0 &&
          sessionData.current_question_index < questionsWithOptions.length
        ) {
          const question =
            questionsWithOptions[sessionData.current_question_index];
          // Use the new timer method with proper question index
          startTimer(sessionData.current_question_index, question.time_limit);
          // Fetch current answer stats for this question
          setTimeout(() => {
            console.log("[INIT] Fetching stats for resumed question");
            refreshAnswerStats();
          }, 100);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error loading game",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      navigate("/host");
    } finally {
      setLoading(false);
    }
  };

  const subscribeToAnswers = () => {
    // Create a unique channel for this game session
    const channelName = `game_${sessionId}_answers`;

    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_answers",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const answer = payload.new;
          console.log(
            `[REALTIME] New answer received for Q${answer.question_index + 1}:`,
            answer,
          );

          // Update player score if correct
          if (answer.is_correct) {
            const pointsEarned = calculateScore(0);
            setPlayers((current) =>
              current.map((player) =>
                player.id === answer.player_id
                  ? { ...player, score: player.score + pointsEarned }
                  : player,
              ),
            );
          }

          // Immediate stats update for current question
          if (answer.question_index === currentQuestionIndex) {
            console.log(
              `[REALTIME] Immediate refresh for current Q${currentQuestionIndex + 1}`,
            );

            // Update stats immediately without waiting for database refresh
            setAnswerStats((prevStats) => {
              const newStats = { ...prevStats };
              if (newStats.hasOwnProperty(answer.option_id)) {
                newStats[answer.option_id] =
                  (newStats[answer.option_id] || 0) + 1;
                console.log(
                  `[REALTIME] Updated ${answer.option_id} to ${newStats[answer.option_id]}`,
                );
              } else {
                console.warn(
                  `[REALTIME] Unknown option_id: ${answer.option_id}`,
                );
              }
              return newStats;
            });

            setTotalAnswers((prev) => prev + 1);
            setLastUpdateTime(Date.now());

            // Also trigger database refresh for accuracy
            setTimeout(() => refreshAnswerStats(answer.question_index), 50);
          }
        },
      )
      .on("broadcast", { event: "answer_submitted" }, (payload) => {
        console.log("Broadcast answer received:", payload);
        if (payload.payload.question_index === currentQuestionIndex) {
          // Immediately update stats from broadcast
          setAnswerStats((prevStats) => {
            const newStats = { ...prevStats };
            if (newStats.hasOwnProperty(payload.payload.option_id)) {
              newStats[payload.payload.option_id] =
                (newStats[payload.payload.option_id] || 0) + 1;
              console.log(
                `[BROADCAST] Updated ${payload.payload.option_id} to ${newStats[payload.payload.option_id]}`,
              );
            } else {
              console.warn(
                `[BROADCAST] Unknown option_id: ${payload.payload.option_id}`,
              );
            }
            return newStats;
          });
          setTotalAnswers((prev) => prev + 1);
        }
      })
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const calculateScore = (secondsLeft: number) => {
    // Fixed score of 100 points for every correct answer
    return 100;
  };

  const startTimer = (questionIndex: number, seconds: number) => {
    console.log(
      `[TIMER] Starting timer with ${seconds} seconds for question ${questionIndex + 1}`,
    );

    // Clear any existing timer immediately
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const currentQ = questions[questionIndex];
    if (!currentQ || !currentQ.options) {
      console.log(`[TIMER] Invalid question data for index ${questionIndex}`);
      return;
    }

    // Initialize fresh stats for this question with regular option IDs
    const freshStats: { [key: string]: number } = {};
    currentQ.options.forEach((option) => {
      freshStats[option.id] = 0;
    });

    // Set initial state
    setShowResults(false);
    setIsCalculatingResults(false);
    setAnswerStats(freshStats);
    setTotalAnswers(0);
    setLastUpdateTime(Date.now());

    // Broadcast question start to all participants
    supabase.channel(`game_${sessionId}_sync`).send({
      type: "broadcast",
      event: "question_started",
      payload: {
        question_index: questionIndex,
        question: currentQ,
        time_limit: seconds,
        timestamp: Date.now(),
      },
    });

    // Set initial time immediately
    const safeTime = Math.max(seconds, 1);
    setTimeLeft(safeTime);

    console.log(`[TIMER] Initial time set to: ${seconds}`);

    // Start countdown after a small delay to ensure state is set
    setTimeout(() => {
      let remainingTime = safeTime; // instead of "seconds"

      const countdown = () => {
        remainingTime--;
        console.log(`[TIMER] Countdown: ${remainingTime}`);

        setTimeLeft(remainingTime);

        if (remainingTime <= 0) {
          console.log(`[TIMER] Time up for Q${questionIndex + 1}`);

          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // Broadcast time up event
          supabase.channel(`game_${sessionId}_sync`).send({
            type: "broadcast",
            event: "time_up",
            payload: { question_index: questionIndex, timestamp: Date.now() },
          });

          // Show results after a brief delay
          setIsCalculatingResults(true);
          setTimeout(() => {
            refreshAnswerStats(questionIndex).then(() => {
              console.log(
                `[TIMER] Setting showResults to true for Q${questionIndex + 1}`,
              );
              setShowResults(true);
              setIsCalculatingResults(false);
            });
          }, 500);
        }
      };

      // Start the countdown timer
      timerRef.current = setInterval(countdown, 1000);
    }, 100);

    // Initial stats refresh
    setTimeout(() => {
      console.log(`[TIMER] Initial stats refresh for Q${questionIndex + 1}`);
      refreshAnswerStats(questionIndex);
    }, 200);
  };

  const startGame = async () => {
    if (questions.length === 0) {
      toast({
        title: "No questions",
        description: "This quiz doesn't have any questions",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(
        "[START_GAME] Starting game with",
        questions.length,
        "questions",
      );

      // Clear any existing timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // IMMEDIATELY show "Get Ready!" screen - this is the critical fix
      setCurrentQuestionIndex(-2);
      setShowResults(false);
      setIsCalculatingResults(false);
      setTimeLeft(0);

      // Update game session state immediately
      const updatedSession = {
        ...gameSession,
        status: "active",
        current_question_index: -2,
        updated_at: new Date().toISOString(),
      };
      setGameSession(updatedSession);

      console.log("[START_GAME] Set state to show Get Ready screen");

      // Update database
      const { error: statusError } = await supabase
        .from("game_sessions")
        .update({
          status: "active",
          current_question_index: -2,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (statusError) throw statusError;

      // Broadcast game start
      await supabase.channel(`game_${sessionId}_sync`).send({
        type: "broadcast",
        event: "game_started",
        payload: {
          quiz_id: quiz.id,
          total_questions: questions.length,
          timestamp: Date.now(),
        },
      });

      console.log(
        "[START_GAME] Database updated, showing Get Ready for 3 seconds",
      );

      // Wait 3 seconds, then start first question
      setTimeout(async () => {
        try {
          console.log("[START_GAME] Moving to first question");

          const { error } = await supabase
            .from("game_sessions")
            .update({
              current_question_index: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessionId);

          if (error) throw error;

          // Set the question index to 0 and start the timer
          console.log("Questions loaded:", questions);
          if (questions.length && questions[0]?.time_limit) {
            const timeLimit = Math.max(questions[0].time_limit, 1); // Ensure at least 1 second
            console.log("Starting first question with time limit:", timeLimit);

            setCurrentQuestionIndex(0);
            startTimer(0, timeLimit);
          } else {
            console.error(
              "First question is missing or has no valid time_limit",
            );
          }
        } catch (error: any) {
          console.error("[START_GAME] Error:", error);
          toast({
            title: "Error starting game",
            description: error.message || "Something went wrong",
            variant: "destructive",
          });
        }
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Error starting game",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const fetchAnswerStats = async () => {
    try {
      console.log(
        "Fetching answer stats for session:",
        sessionId,
        "question:",
        currentQuestionIndex,
      );

      const { data: answers, error } = await supabase
        .from("game_answers")
        .select("option_id")
        .eq("session_id", sessionId)
        .eq("question_index", currentQuestionIndex);

      if (error) {
        console.error("Error fetching answers:", error);
        throw error;
      }

      console.log("Fetched answers:", answers);
      console.log(
        "Current question options:",
        questions[currentQuestionIndex]?.options,
      );

      // Initialize stats with all options set to 0
      const stats: { [key: string]: number } = {};
      if (questions[currentQuestionIndex]) {
        questions[currentQuestionIndex].options.forEach((option) => {
          stats[option.id] = 0;
        });
      }

      // Count actual answers
      answers?.forEach((answer) => {
        if (stats.hasOwnProperty(answer.option_id)) {
          stats[answer.option_id] = (stats[answer.option_id] || 0) + 1;
        }
      });

      console.log("Answer stats after processing:", stats);
      console.log("Total answers:", answers?.length || 0);

      // Force state update by creating new objects
      setAnswerStats({ ...stats });
      setTotalAnswers(answers?.length || 0);
    } catch (error: any) {
      console.error("Error fetching answer stats:", error);
    }
  };

  // Initialize answer stats for current question
  const initializeAnswerStats = () => {
    if (questions[currentQuestionIndex]) {
      const initialStats: { [key: string]: number } = {};
      questions[currentQuestionIndex].options.forEach((option) => {
        initialStats[option.id] = 0;
      });
      setAnswerStats(initialStats);
      setTotalAnswers(0);
    }
  };

  // Enhanced refresh with forced state updates and better error handling
  const refreshAnswerStats = async (questionIndex = currentQuestionIndex) => {
    try {
      const refreshId = Date.now();
      const currentStateQuestionIndex = currentQuestionIndex;

      console.log(
        `[REFRESH-${refreshId}] Called with questionIndex=${questionIndex}, currentQuestionIndex=${currentStateQuestionIndex}`,
      );

      if (questionIndex < 0 || !questions[questionIndex]) {
        console.log(
          `[REFRESH-${refreshId}] Invalid question index:`,
          questionIndex,
        );
        return;
      }

      const currentQ = questions[questionIndex];
      if (!currentQ || !currentQ.options) {
        console.log(`[REFRESH-${refreshId}] Invalid question data`);
        return;
      }

      console.log(
        `[REFRESH-${refreshId}] Fetching stats for Q${questionIndex + 1}, options:`,
        currentQ.options.map((opt) => ({ id: opt.id, text: opt.text })),
      );

      const { data: answers, error } = await supabase
        .from("game_answers")
        .select("option_id")
        .eq("session_id", sessionId)
        .eq("question_index", questionIndex);

      if (error) {
        console.error(`[REFRESH-${refreshId}] Supabase error:`, error);
        return;
      }

      console.log(`[REFRESH-${refreshId}] Raw answers from DB:`, answers);

      // Initialize stats with regular option IDs (not unique keys)
      const stats: { [key: string]: number } = {};
      currentQ.options.forEach((option) => {
        stats[option.id] = 0;
        console.log(
          `[REFRESH-${refreshId}] Initialized stat for option: ${option.id}`,
        );
      });

      // Count answers using regular option IDs
      answers?.forEach((answer) => {
        if (stats.hasOwnProperty(answer.option_id)) {
          stats[answer.option_id]++;
          console.log(
            `[REFRESH-${refreshId}] Incremented ${answer.option_id} to ${stats[answer.option_id]}`,
          );
        } else {
          console.warn(
            `[REFRESH-${refreshId}] Unknown option_id: ${answer.option_id} for question ${questionIndex}`,
          );
        }
      });

      const total = answers?.length || 0;
      console.log(
        `[REFRESH-${refreshId}] Final stats:`,
        stats,
        `Total: ${total}`,
      );

      // Always update state for real-time updates
      console.log(
        `[REFRESH-${refreshId}] Updating state for question ${questionIndex + 1}`,
      );
      setAnswerStats({ ...stats });
      setTotalAnswers(total);
      setLastUpdateTime(Date.now());
    } catch (error) {
      console.error(`[REFRESH] Unexpected error:`, error);
    }
  };

  const nextQuestion = async () => {
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      try {
        // Clear timers before ending game
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        await supabase
          .from("game_sessions")
          .update({
            status: "completed",
            current_question_index: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        await supabase.channel(`game_${sessionId}_sync`).send({
          type: "broadcast",
          event: "game_ended",
          payload: { timestamp: Date.now() },
        });

        setGameEnded(true);
      } catch (error: any) {
        toast({
          title: "Error ending game",
          description: error.message || "Something went wrong",
          variant: "destructive",
        });
      }
      return;
    }

    try {
      console.log(
        `[NEXT_QUESTION] Moving from Q${currentQuestionIndex + 1} to Q${nextIndex + 1}`,
      );

      // Clear existing timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Update database with next question index
      await supabase
        .from("game_sessions")
        .update({
          current_question_index: nextIndex,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      // Reset state for next question
      setShowResults(false);
      setIsCalculatingResults(false);
      setTimeLeft(0);

      // Update question index BEFORE initializing stats
      setCurrentQuestionIndex(nextIndex);

      // Broadcast question change
      await supabase.channel(`game_${sessionId}_sync`).send({
        type: "broadcast",
        event: "question_changed",
        payload: {
          question_index: nextIndex,
          question: questions[nextIndex],
          timestamp: Date.now(),
        },
      });

      // Start timer for next question (this will initialize stats with unique keys)
      console.log(
        `[NEXT_QUESTION] Starting timer for Q${nextIndex + 1} with ${questions[nextIndex].time_limit}s`,
      );

      // Small delay to ensure state updates are processed
      setTimeout(() => {
        startTimer(nextIndex, questions[nextIndex].time_limit);
      }, 100);
    } catch (error: any) {
      console.error(`[NEXT_QUESTION] Error:`, error);
      toast({
        title: "Error loading next question",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const endGame = () => {
    navigate("/host");
  };

  const goToHostDashboard = () => {
    navigate("/host");
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

  // Function to export comprehensive results to CSV
  const exportToCSV = async () => {
    try {
      // Sort players by score (highest first)
      const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

      // Get all game answers for this session
      const { data: gameAnswers, error: answersError } = await supabase
        .from("game_answers")
        .select(
          `
          *,
          game_players!inner(player_name),
          questions!inner(text),
          options!inner(text, is_correct)
        `,
        )
        .eq("session_id", sessionId)
        .order("question_index", { ascending: true });

      if (answersError) throw answersError;

      // Create comprehensive CSV content
      let csvContent = "";

      // Section 1: Quiz Information
      csvContent += "QUIZ INFORMATION\n";
      csvContent += `Quiz Title,${quiz?.title || "Unknown Quiz"}\n`;
      csvContent += `Total Questions,${questions.length}\n`;
      csvContent += `Total Players,${players.length}\n`;
      csvContent += `Game PIN,${gameSession?.game_pin || "N/A"}\n`;
      csvContent += "\n";

      // Section 2: Final Leaderboard
      csvContent += "FINAL LEADERBOARD\n";
      csvContent += "Rank,Player Name,Final Score\n";
      sortedPlayers.forEach((player, index) => {
        csvContent += `${index + 1},"${player.name}",${player.score}\n`;
      });
      csvContent += "\n";

      // Section 3: Questions and Correct Answers
      csvContent += "QUESTIONS AND CORRECT ANSWERS\n";
      csvContent +=
        "Question Number,Question Text,Correct Answer,Time Limit (seconds)\n";
      questions.forEach((question, index) => {
        const correctOption = question.options.find((opt) => opt.is_correct);
        csvContent += `${index + 1},"${question.text}","${correctOption?.text || "N/A"}",${question.time_limit}\n`;
      });
      csvContent += "\n";

      // Section 4: All Answer Options for Each Question
      csvContent += "ALL ANSWER OPTIONS\n";
      csvContent += "Question Number,Question Text,Option Text,Is Correct\n";
      questions.forEach((question, qIndex) => {
        question.options.forEach((option) => {
          csvContent += `${qIndex + 1},"${question.text}","${option.text}",${option.is_correct ? "Yes" : "No"}\n`;
        });
      });
      csvContent += "\n";

      // Section 5: Detailed Player Answers
      csvContent += "DETAILED PLAYER ANSWERS\n";
      csvContent +=
        "Player Name,Question Number,Question Text,Player Answer,Correct Answer,Is Correct,Time Taken (seconds),Points Earned\n";

      // Group answers by player and question for better organization
      const answersByPlayer = {};
      gameAnswers?.forEach((answer) => {
        const playerName = answer.game_players.player_name;
        if (!answersByPlayer[playerName]) {
          answersByPlayer[playerName] = {};
        }
        answersByPlayer[playerName][answer.question_index] = answer;
      });

      // Generate rows for each player and each question
      sortedPlayers.forEach((player) => {
        questions.forEach((question, qIndex) => {
          const playerAnswer = answersByPlayer[player.name]?.[qIndex];
          const correctOption = question.options.find((opt) => opt.is_correct);

          if (playerAnswer) {
            const pointsEarned = playerAnswer.is_correct ? 100 : 0;
            csvContent += `"${player.name}",${qIndex + 1},"${question.text}","${playerAnswer.options.text}","${correctOption?.text || "N/A"}",${playerAnswer.is_correct ? "Yes" : "No"},${playerAnswer.time_taken},${pointsEarned}\n`;
          } else {
            // Player didn't answer this question
            csvContent += `"${player.name}",${qIndex + 1},"${question.text}","No Answer","${correctOption?.text || "N/A"}","No","N/A",0\n`;
          }
        });
      });
      csvContent += "\n";

      // Section 6: Question Performance Summary
      csvContent += "QUESTION PERFORMANCE SUMMARY\n";
      csvContent +=
        "Question Number,Question Text,Total Answers,Correct Answers,Incorrect Answers,No Answers,Accuracy Rate\n";
      questions.forEach((question, qIndex) => {
        const questionAnswers =
          gameAnswers?.filter((answer) => answer.question_index === qIndex) ||
          [];
        const correctAnswers = questionAnswers.filter(
          (answer) => answer.is_correct,
        ).length;
        const incorrectAnswers = questionAnswers.filter(
          (answer) => !answer.is_correct,
        ).length;
        const noAnswers = players.length - questionAnswers.length;
        const accuracyRate =
          questionAnswers.length > 0
            ? ((correctAnswers / questionAnswers.length) * 100).toFixed(1)
            : "0.0";

        csvContent += `${qIndex + 1},"${question.text}",${questionAnswers.length},${correctAnswers},${incorrectAnswers},${noAnswers},${accuracyRate}%\n`;
      });

      // Create a blob and download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `${quiz?.title || "quiz"}_comprehensive_results.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: "Comprehensive quiz results have been exported to CSV",
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message || "Something went wrong while exporting",
        variant: "destructive",
      });
    }
  };

  if (showSummary) {
    return (
      <GameSummary
        sessionId={sessionId!}
        quiz={quiz}
        questions={questions}
        players={players}
        onBackToDashboard={() => navigate("/host")}
        onShowFinalResults={() => setGameEnded(true)}
      />
    );
  }

  if (gameEnded) {
    // Sort players by score (highest first)
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
      <div className="min-h-screen bg-[#f5f5f7] pt-16 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Game Over!
            </h1>
            <p className="text-xl text-gray-600">{quiz?.title}</p>
          </div>

          <Card className="bg-white shadow-sm border-gray-100 p-8 mb-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-coral/20 mb-4">
                <Award className="h-10 w-10 text-coral" />
              </div>
              <h2 className="text-3xl font-bold mb-1">Final Results</h2>
              <p className="text-gray-600">{players.length} players</p>
            </div>

            <div className="space-y-4 max-w-lg mx-auto">
              {sortedPlayers.map((player, index) => {
                let medalColor = "";
                if (index === 0)
                  medalColor = "bg-coral text-white"; // Gold
                else if (index === 1)
                  medalColor = "bg-skyblue text-white"; // Silver
                else if (index === 2) medalColor = "bg-navy text-white"; // Bronze

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 font-bold ${medalColor || "bg-gray-200"}`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center mr-3">
                          <span className="text-white text-sm font-bold">
                            {player.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{player.name}</span>
                      </div>
                    </div>
                    <span className="font-bold">
                      {player.score.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex justify-center gap-4">
            <Button
              onClick={() => {
                // End the quiz immediately and show final results
                setGameEnded(true);
              }}
              variant="outline"
              className="bg-red-500 hover:bg-red-600 text-white border-red-500 gap-2 text-lg px-8 py-6 h-auto"
            >
              End Quiz
            </Button>
            <Button
              onClick={nextQuestion}
              className="bg-navy hover:bg-navy/90 gap-2 text-lg px-8 py-6 h-auto"
            >
              {currentQuestionIndex < questions.length - 1 ? (
                <>
                  Next Question
                  <ChevronRight className="h-5 w-5" />
                </>
              ) : (
                "See Final Results"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show "Get Ready!" screen when currentQuestionIndex is -2
  if (currentQuestionIndex === -2) {
    console.log(
      "[RENDER] Showing Get Ready screen - questionIndex:",
      currentQuestionIndex,
    );
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 pt-16 pb-12">
        <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
          <Logo className="bg-white/20 backdrop-blur-md p-1 rounded ml-0 sm:ml-16" />
          <UserMenu />
        </div>
        <div className="max-w-4xl mx-auto px-4 text-center mt-16">
          <Card className="bg-white shadow-sm border-gray-100 p-8 mb-8">
            <div className="max-w-md mx-auto">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                🚀 Get Ready!
              </h1>
              <p className="text-xl text-gray-600 mb-4">
                The first question is coming up...
              </p>
              <p className="text-sm text-gray-500 mb-8">
                {players.length} players are ready to play!
              </p>
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-gray-200 border-t-navy animate-spin mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full bg-navy/20 animate-pulse" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Starting in a few seconds...
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (currentQuestionIndex === -1 && gameSession?.status !== "active") {
    // Game hasn't started yet - show start button
    console.log(
      "[RENDER] Showing start game screen - status:",
      gameSession?.status,
      "questionIndex:",
      currentQuestionIndex,
    );
    return (
      <div className="min-h-screen bg-[#f5f5f7] pt-16 pb-12">
        <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
          <Logo className="bg-white/20 backdrop-blur-md p-1 rounded ml-0 sm:ml-16" />
          <UserMenu />
        </div>
        <div className="max-w-4xl mx-auto px-4 text-center mt-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {quiz?.title}
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {questions.length} questions
          </p>

          <Card className="bg-white shadow-sm border-gray-100 p-8 mb-8">
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-bold mb-4">Ready to Start?</h2>
              <p className="text-gray-600 mb-6">
                {players.length}{" "}
                {players.length === 1 ? "player has" : "players have"} joined.
              </p>
              <Button
                onClick={startGame}
                className="bg-navy hover:bg-navy/90 gap-2 text-lg px-8 py-6 h-auto"
              >
                Start Game
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const questionNumber = currentQuestionIndex + 1;
  const totalQuestions = questions.length;
  const progress = (questionNumber / totalQuestions) * 100;

  return (
    <div className="min-h-screen bg-[#FF6952] pt-16 pb-12">
      <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
        <Link to="/">
          <Logo className="h-12 w-auto ml-16" />
        </Link>
        <UserMenu />
      </div>
      <div className="max-w-4xl mx-auto px-4 mt-16">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Question {questionNumber} of {totalQuestions}
            </h2>
          </div>
          <div className="text-2xl font-bold text-navy">{timeLeft}s</div>
        </div>

        <div className="h-2 bg-gray-200 rounded-full mb-6">
          <div
            className="h-2 bg-navy rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {showResults && timeLeft === 0 ? (
          <div>
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
                    option.is_correct ? "bg-green-500" : "bg-coral",
                    option.is_correct ? "bg-green-500" : "bg-skyblue",
                    option.is_correct ? "bg-green-500" : "bg-navy",
                    option.is_correct ? "bg-green-500" : "bg-coral/80",
                  ];

                  console.log(
                    `[RESULTS] Q${currentQuestionIndex + 1} Option "${option.text}": option_id=${option.id}, count=${answerCount}, total=${totalAnswers}, percentage=${percentage}%`,
                  );

                  return (
                    <div
                      key={option.id}
                      className={`p-6 rounded-xl ${colors[index]} text-white relative overflow-hidden border-2 border-white/20`}
                    >
                      {/* Dark overlay based on percentage */}
                      <div
                        className="absolute inset-0 bg-black/30 transition-all duration-700 ease-out"
                        style={{
                          clipPath: `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`,
                          opacity: percentage > 0 ? 0.4 : 0,
                        }}
                      ></div>

                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-lg font-medium leading-tight pr-2 flex-1">
                            {option.text}
                          </span>
                          {option.is_correct && (
                            <div className="flex-shrink-0 ml-2">
                              <span className="inline-flex items-center text-xs bg-white text-green-600 px-3 py-1.5 rounded-full font-bold shadow-lg border border-green-200">
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Correct
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold drop-shadow-lg">
                              {percentage}%
                            </span>
                            <span className="text-sm opacity-90 font-medium">
                              ({answerCount} players)
                            </span>
                          </div>
                        </div>

                        {/* Enhanced progress bar */}
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
                  onClick={() => {
                    // End the quiz immediately and show final results
                    setGameEnded(true);
                  }}
                  variant="outline"
                  className="bg-red-500 hover:bg-red-600 text-white border-red-500 gap-2 text-lg px-8 py-6 h-auto"
                >
                  End Quiz
                </Button>
                <Button
                  onClick={nextQuestion}
                  className="bg-navy hover:bg-navy/90 gap-2 text-lg px-8 py-6 h-auto"
                >
                  {currentQuestionIndex < questions.length - 1 ? (
                    <>
                      Next Question
                      <ChevronRight className="h-5 w-5" />
                    </>
                  ) : (
                    "See Final Results"
                  )}
                </Button>
              </div>
            </Card>

            <Card className="bg-white shadow-sm border-gray-100 p-6">
              <h3 className="text-xl font-bold mb-4">Leaderboard</h3>

              <div className="space-y-3">
                {[...players]
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 5)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <div className="bg-gray-200 h-6 w-6 rounded-full flex items-center justify-center mr-3 text-gray-700 font-bold">
                          {index + 1}
                        </div>
                        <span className="font-medium">{player.name}</span>
                      </div>
                      <span className="font-bold">
                        {player.score.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        ) : (
          <div>
            <Card className="bg-white shadow-sm border-gray-100 p-8 text-center mb-6">
              <h2 className="text-3xl font-bold mb-8">
                {currentQuestion.text}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {currentQuestion.options.map((option, index) => {
                  const colors = [
                    "bg-coral", // Coral
                    "bg-skyblue", // Sky Blue
                    "bg-navy", // Navy
                    "bg-coral/80", // Light Coral
                  ];
                  return (
                    <div
                      key={option.id}
                      className={`p-8 rounded-xl ${colors[index]} text-white flex items-center justify-center`}
                    >
                      <span className="text-xl font-medium">{option.text}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Live answer counts integrated into question options */}
            <div className="mt-4">
              <div className="text-center text-sm text-white/80 mb-2">
                <span className="bg-white/20 px-3 py-1 rounded-full">
                  {totalAnswers} players have answered • Last update:{" "}
                  {new Date(lastUpdateTime).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-center mt-2">
                <span className="text-white/60 text-xs">
                  Real-time updates via Supabase
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Game Summary Component
interface GameSummaryProps {
  sessionId: string;
  quiz: any;
  questions: Question[];
  players: Player[];
  onBackToDashboard: () => void;
  onShowFinalResults: () => void;
}

const GameSummary: React.FC<GameSummaryProps> = ({
  sessionId,
  quiz,
  questions,
  players,
  onBackToDashboard,
  onShowFinalResults,
}) => {
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSummaryData();
  }, []);

  const fetchSummaryData = async () => {
    try {
      setLoading(true);

      // Get all game answers for detailed analysis
      const { data: allAnswers, error: answersError } = await supabase
        .from("game_answers")
        .select(
          `
          *,
          game_players!inner(player_name),
          questions!inner(text),
          options!inner(text, is_correct)
        `,
        )
        .eq("session_id", sessionId)
        .order("question_index", { ascending: true });

      if (answersError) throw answersError;

      // Calculate comprehensive statistics
      const totalQuestions = questions.length;
      const totalPlayers = players.length;
      const totalAnswers = allAnswers?.length || 0;
      const correctAnswers =
        allAnswers?.filter((a) => a.is_correct).length || 0;
      const overallAccuracy =
        totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;

      // Question-wise analysis
      const questionStats = questions.map((question, index) => {
        const questionAnswers =
          allAnswers?.filter((a) => a.question_index === index) || [];
        const correctCount = questionAnswers.filter((a) => a.is_correct).length;
        const totalCount = questionAnswers.length;
        const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

        // Answer distribution
        const answerDistribution: {
          [key: string]: { text: string; count: number; isCorrect: boolean };
        } = {};
        question.options.forEach((option) => {
          const optionAnswers = questionAnswers.filter(
            (a) => a.option_id === option.id,
          );
          answerDistribution[option.id] = {
            text: option.text,
            count: optionAnswers.length,
            isCorrect: option.is_correct,
          };
        });

        return {
          questionIndex: index + 1,
          questionText: question.text,
          totalAnswers: totalCount,
          correctAnswers: correctCount,
          accuracy: accuracy,
          answerDistribution,
          averageTime:
            questionAnswers.reduce((sum, a) => sum + a.time_taken, 0) /
            (totalCount || 1),
        };
      });

      // Player performance analysis
      const playerStats = players
        .map((player) => {
          const playerAnswers =
            allAnswers?.filter(
              (a) => a.game_players.player_name === player.name,
            ) || [];
          const correctCount = playerAnswers.filter((a) => a.is_correct).length;
          const totalCount = playerAnswers.length;
          const accuracy =
            totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
          const averageTime =
            playerAnswers.reduce((sum, a) => sum + a.time_taken, 0) /
            (totalCount || 1);

          return {
            name: player.name,
            score: player.score,
            totalAnswers: totalCount,
            correctAnswers: correctCount,
            accuracy: accuracy,
            averageTime: averageTime,
          };
        })
        .sort((a, b) => b.score - a.score);

      // Find most difficult and easiest questions
      const sortedByDifficulty = [...questionStats].sort(
        (a, b) => a.accuracy - b.accuracy,
      );
      const mostDifficult = sortedByDifficulty[0];
      const easiest = sortedByDifficulty[sortedByDifficulty.length - 1];

      setSummaryData({
        overview: {
          totalQuestions,
          totalPlayers,
          totalAnswers,
          overallAccuracy: Math.round(overallAccuracy),
          averageScore: Math.round(
            players.reduce((sum, p) => sum + p.score, 0) / totalPlayers,
          ),
        },
        questionStats,
        playerStats,
        insights: {
          mostDifficult,
          easiest,
          participationRate: Math.round(
            (totalAnswers / (totalQuestions * totalPlayers)) * 100,
          ),
        },
      });
    } catch (error: any) {
      toast({
        title: "Error loading summary",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] pt-16 flex items-center justify-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-gray-100 border-t-navy animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-4 rounded-full bg-navy/20 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!summaryData) return null;

  return (
    <div className="min-h-screen bg-[#f5f5f7] pt-16 pb-12">
      <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
        <Link to="/">
          <Logo className="h-12 w-auto ml-16" />
        </Link>
        <UserMenu />
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-16">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Game Summary
          </h1>
          <p className="text-xl text-gray-600">{quiz?.title}</p>
        </div>

        {/* Enhanced Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-coral to-coral/80 text-white shadow-lg border-0 p-6">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-8 w-8 opacity-80" />
              <div className="text-right">
                <div className="text-3xl font-bold mb-1">
                  {summaryData.overview.totalPlayers}
                </div>
                <div className="text-coral-100 text-sm font-medium">
                  Total Players
                </div>
              </div>
            </div>
            <div className="text-xs text-coral-100">
              Participation Rate: {summaryData.insights.participationRate}%
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-skyblue to-skyblue/80 text-white shadow-lg border-0 p-6">
            <div className="flex items-center justify-between mb-4">
              <BarChart3 className="h-8 w-8 opacity-80" />
              <div className="text-right">
                <div className="text-3xl font-bold mb-1">
                  {summaryData.overview.totalQuestions}
                </div>
                <div className="text-skyblue-100 text-sm font-medium">
                  Questions
                </div>
              </div>
            </div>
            <div className="text-xs text-skyblue-100">
              Total Answers: {summaryData.overview.totalAnswers}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-navy to-navy/80 text-white shadow-lg border-0 p-6">
            <div className="flex items-center justify-between mb-4">
              <Target className="h-8 w-8 opacity-80" />
              <div className="text-right">
                <div className="text-3xl font-bold mb-1">
                  {summaryData.overview.overallAccuracy}%
                </div>
                <div className="text-navy-100 text-sm font-medium">
                  Overall Accuracy
                </div>
              </div>
            </div>
            <Progress
              value={summaryData.overview.overallAccuracy}
              className="h-2 bg-navy-200"
            />
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg border-0 p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="h-8 w-8 opacity-80" />
              <div className="text-right">
                <div className="text-3xl font-bold mb-1">
                  {summaryData.overview.averageScore.toLocaleString()}
                </div>
                <div className="text-green-100 text-sm font-medium">
                  Average Score
                </div>
              </div>
            </div>
            <div className="text-xs text-green-100">
              Highest:{" "}
              {Math.max(
                ...summaryData.playerStats.map((p) => p.score),
              ).toLocaleString()}
            </div>
          </Card>
        </div>

        {/* Performance Distribution Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Score Distribution Visualization */}
          <Card className="bg-white shadow-sm border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6">
              <PieChart className="h-6 w-6 text-coral" />
              <h2 className="text-xl font-bold">Score Distribution</h2>
            </div>
            <div className="space-y-4">
              {(() => {
                const scoreRanges = [
                  {
                    label: "Excellent (80%+)",
                    min: 0.8,
                    color: "bg-green-500",
                    count: 0,
                  },
                  {
                    label: "Good (60-79%)",
                    min: 0.6,
                    color: "bg-blue-500",
                    count: 0,
                  },
                  {
                    label: "Average (40-59%)",
                    min: 0.4,
                    color: "bg-yellow-500",
                    count: 0,
                  },
                  {
                    label: "Below Average (<40%)",
                    min: 0,
                    color: "bg-red-500",
                    count: 0,
                  },
                ];

                const maxScore = Math.max(
                  ...summaryData.playerStats.map((p) => p.score),
                );
                summaryData.playerStats.forEach((player) => {
                  const percentage = maxScore > 0 ? player.score / maxScore : 0;
                  if (percentage >= 0.8) scoreRanges[0].count++;
                  else if (percentage >= 0.6) scoreRanges[1].count++;
                  else if (percentage >= 0.4) scoreRanges[2].count++;
                  else scoreRanges[3].count++;
                });

                return scoreRanges.map((range, index) => {
                  const percentage =
                    summaryData.overview.totalPlayers > 0
                      ? (range.count / summaryData.overview.totalPlayers) * 100
                      : 0;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded ${range.color}`}></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">
                            {range.label}
                          </span>
                          <span className="text-sm text-gray-600">
                            {range.count} players
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                      <span className="text-sm font-semibold w-12 text-right">
                        {Math.round(percentage)}%
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </Card>

          {/* Question Difficulty Analysis */}
          <Card className="bg-white shadow-sm border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="h-6 w-6 text-skyblue" />
              <h2 className="text-xl font-bold">
                Question Difficulty Analysis
              </h2>
            </div>
            <div className="space-y-4">
              {(() => {
                const difficultyRanges = [
                  {
                    label: "Easy (80%+ correct)",
                    min: 80,
                    color: "bg-green-500",
                    questions: [],
                  },
                  {
                    label: "Medium (50-79% correct)",
                    min: 50,
                    color: "bg-yellow-500",
                    questions: [],
                  },
                  {
                    label: "Hard (30-49% correct)",
                    min: 30,
                    color: "bg-orange-500",
                    questions: [],
                  },
                  {
                    label: "Very Hard (<30% correct)",
                    min: 0,
                    color: "bg-red-500",
                    questions: [],
                  },
                ];

                summaryData.questionStats.forEach((q) => {
                  if (q.accuracy >= 80) difficultyRanges[0].questions.push(q);
                  else if (q.accuracy >= 50)
                    difficultyRanges[1].questions.push(q);
                  else if (q.accuracy >= 30)
                    difficultyRanges[2].questions.push(q);
                  else difficultyRanges[3].questions.push(q);
                });

                return difficultyRanges.map((range, index) => {
                  const percentage =
                    summaryData.overview.totalQuestions > 0
                      ? (range.questions.length /
                          summaryData.overview.totalQuestions) *
                        100
                      : 0;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded ${range.color}`}></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">
                            {range.label}
                          </span>
                          <span className="text-sm text-gray-600">
                            {range.questions.length} questions
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                      <span className="text-sm font-semibold w-12 text-right">
                        {Math.round(percentage)}%
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </Card>
        </div>

        {/* Detailed Performance Metrics */}
        <Card className="bg-white shadow-sm border-gray-100 p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="h-6 w-6 text-navy" />
            <h2 className="text-xl font-bold">Response Time Analysis</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {Math.round(
                  summaryData.questionStats.reduce(
                    (sum, q) => sum + q.averageTime,
                    0,
                  ) / summaryData.questionStats.length,
                )}
                s
              </div>
              <div className="text-sm text-blue-700">Average Response Time</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border">
              <div className="text-xl font-bold text-green-600 mb-2">
                {Math.round(
                  Math.min(
                    ...summaryData.questionStats.map((q) => q.averageTime),
                  ),
                )}
                s
              </div>
              <div className="text-sm text-green-700">Fastest Average</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border">
              <div className="text-xl font-bold text-red-600 mb-2">
                {Math.round(
                  Math.max(
                    ...summaryData.questionStats.map((q) => q.averageTime),
                  ),
                )}
                s
              </div>
              <div className="text-sm text-red-700">Slowest Average</div>
            </div>
          </div>
        </Card>

        {/* Enhanced Question Analysis */}
        <Card className="bg-white shadow-sm border-gray-100 p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">
            Detailed Question Performance
          </h2>
          <div className="space-y-8">
            {summaryData.questionStats.map((stat: any, index: number) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-6 bg-gradient-to-r from-gray-50 to-white"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          stat.accuracy >= 70
                            ? "bg-green-500"
                            : stat.accuracy >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                      >
                        {stat.questionIndex}
                      </div>
                      <h3 className="font-semibold text-lg">
                        {stat.questionText}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-sm text-gray-600">Accuracy</div>
                        <div
                          className={`text-xl font-bold ${
                            stat.accuracy >= 70
                              ? "text-green-600"
                              : stat.accuracy >= 50
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {Math.round(stat.accuracy)}%
                        </div>
                        <Progress value={stat.accuracy} className="h-1 mt-1" />
                      </div>

                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-sm text-gray-600">
                          Participation
                        </div>
                        <div className="text-xl font-bold text-blue-600">
                          {stat.totalAnswers}/
                          {summaryData.overview.totalPlayers}
                        </div>
                        <Progress
                          value={
                            (stat.totalAnswers /
                              summaryData.overview.totalPlayers) *
                            100
                          }
                          className="h-1 mt-1"
                        />
                      </div>

                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-sm text-gray-600">Avg Time</div>
                        <div className="text-xl font-bold text-purple-600">
                          {Math.round(stat.averageTime)}s
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-sm text-gray-600">Difficulty</div>
                        <div
                          className={`text-sm font-bold ${
                            stat.accuracy >= 80
                              ? "text-green-600"
                              : stat.accuracy >= 50
                                ? "text-yellow-600"
                                : stat.accuracy >= 30
                                  ? "text-orange-600"
                                  : "text-red-600"
                          }`}
                        >
                          {stat.accuracy >= 80
                            ? "Easy"
                            : stat.accuracy >= 50
                              ? "Medium"
                              : stat.accuracy >= 30
                                ? "Hard"
                                : "Very Hard"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Answer Distribution with Visual Charts */}
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="font-semibold mb-4 text-gray-800">
                    Answer Distribution
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(stat.answerDistribution).map(
                      ([optionId, data]: [string, any]) => {
                        const percentage =
                          stat.totalAnswers > 0
                            ? Math.round((data.count / stat.totalAnswers) * 100)
                            : 0;
                        return (
                          <div
                            key={optionId}
                            className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                              data.isCorrect
                                ? "bg-green-50 border-green-300 hover:bg-green-100"
                                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-sm font-medium text-gray-800 flex-1 pr-2">
                                {data.text}
                              </span>
                              {data.isCorrect && (
                                <span className="inline-flex items-center text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold border border-green-200">
                                  <svg
                                    className="w-3 h-3 mr-1"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  Correct
                                </span>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-2xl font-bold text-gray-900">
                                  {percentage}%
                                </span>
                                <span className="text-sm text-gray-600">
                                  {data.count} players
                                </span>
                              </div>

                              <div className="relative">
                                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                                  <div
                                    className={`h-3 rounded-full transition-all duration-700 ${
                                      data.isCorrect
                                        ? "bg-green-500"
                                        : "bg-gray-400"
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-semibold text-white drop-shadow">
                                    {percentage > 15 ? `${percentage}%` : ""}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Enhanced Top Performers with Detailed Stats */}
        <Card className="bg-white shadow-sm border-gray-100 p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Award className="h-6 w-6 text-yellow-500" />
            <h2 className="text-2xl font-bold">
              Player Performance Leaderboard
            </h2>
          </div>

          <div className="space-y-6">
            {summaryData.playerStats.map((player: any, index: number) => {
              const isTopThree = index < 3;
              const medalColors = [
                "bg-yellow-500",
                "bg-gray-400",
                "bg-amber-600",
              ];
              const medalIcons = ["🥇", "🥈", "🥉"];

              return (
                <div
                  key={index}
                  className={`p-6 rounded-xl border-2 transition-all hover:shadow-lg ${
                    isTopThree
                      ? "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {isTopThree ? (
                          <div className="text-2xl">{medalIcons[index]}</div>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center font-bold text-white">
                            {index + 1}
                          </div>
                        )}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {player.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-lg text-gray-900">
                          {player.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          Rank #{index + 1} • {player.correctAnswers}/
                          {player.totalAnswers} correct
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-2xl text-gray-900">
                        {player.score.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">points</div>
                    </div>
                  </div>

                  {/* Detailed Player Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white rounded-lg border">
                      <div
                        className={`text-xl font-bold ${
                          player.accuracy >= 70
                            ? "text-green-600"
                            : player.accuracy >= 50
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {Math.round(player.accuracy)}%
                      </div>
                      <div className="text-xs text-gray-600">Accuracy</div>
                      <Progress value={player.accuracy} className="h-1 mt-1" />
                    </div>

                    <div className="text-center p-3 bg-white rounded-lg border">
                      <div className="text-xl font-bold text-blue-600">
                        {Math.round(player.averageTime)}s
                      </div>
                      <div className="text-xs text-gray-600">Avg Time</div>
                    </div>

                    <div className="text-center p-3 bg-white rounded-lg border">
                      <div className="text-xl font-bold text-purple-600">
                        {Math.round(
                          (player.totalAnswers /
                            summaryData.overview.totalQuestions) *
                            100,
                        )}
                        %
                      </div>
                      <div className="text-xs text-gray-600">Participation</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Enhanced Game Insights with Visual Elements */}
        <Card className="bg-white shadow-sm border-gray-100 p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">
            📊 Game Insights & Analytics
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {/* Most Challenging Question */}
            <div className="p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border-2 border-red-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">!</span>
                </div>
                <h3 className="font-bold text-red-800">Most Challenging</h3>
              </div>
              <div className="mb-3">
                <div className="text-sm font-medium text-red-700 mb-1">
                  Q{summaryData.insights.mostDifficult.questionIndex}
                </div>
                <p className="text-sm text-red-700 line-clamp-2">
                  {summaryData.insights.mostDifficult.questionText}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {Math.round(summaryData.insights.mostDifficult.accuracy)}%
                  </div>
                  <div className="text-xs text-red-600">Success Rate</div>
                </div>
                <Progress
                  value={summaryData.insights.mostDifficult.accuracy}
                  className="w-16 h-2"
                />
              </div>
            </div>

            {/* Easiest Question */}
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">✓</span>
                </div>
                <h3 className="font-bold text-green-800">Easiest Question</h3>
              </div>
              <div className="mb-3">
                <div className="text-sm font-medium text-green-700 mb-1">
                  Q{summaryData.insights.easiest.questionIndex}
                </div>
                <p className="text-sm text-green-700 line-clamp-2">
                  {summaryData.insights.easiest.questionText}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(summaryData.insights.easiest.accuracy)}%
                  </div>
                  <div className="text-xs text-green-600">Success Rate</div>
                </div>
                <Progress
                  value={summaryData.insights.easiest.accuracy}
                  className="w-16 h-2"
                />
              </div>
            </div>

            {/* Participation Insights */}
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-blue-800">Engagement</h3>
              </div>
              <div className="mb-3">
                <div className="text-2xl font-bold text-blue-600">
                  {summaryData.insights.participationRate}%
                </div>
                <div className="text-sm text-blue-700">Participation Rate</div>
              </div>
              <div className="space-y-2">
                <Progress
                  value={summaryData.insights.participationRate}
                  className="h-2"
                />
                <div className="text-xs text-blue-600">
                  {summaryData.overview.totalAnswers} of{" "}
                  {summaryData.overview.totalQuestions *
                    summaryData.overview.totalPlayers}{" "}
                  possible answers
                </div>
              </div>
            </div>
          </div>

          {/* Additional Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Time Analysis */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Response Time Insights
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-purple-700">Fastest Question:</span>
                  <span className="font-semibold">
                    Q
                    {summaryData.questionStats.findIndex(
                      (q) =>
                        q.averageTime ===
                        Math.min(
                          ...summaryData.questionStats.map(
                            (q) => q.averageTime,
                          ),
                        ),
                    ) + 1}{" "}
                    (
                    {Math.round(
                      Math.min(
                        ...summaryData.questionStats.map((q) => q.averageTime),
                      ),
                    )}
                    s)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-700">Slowest Question:</span>
                  <span className="font-semibold">
                    Q
                    {summaryData.questionStats.findIndex(
                      (q) =>
                        q.averageTime ===
                        Math.max(
                          ...summaryData.questionStats.map(
                            (q) => q.averageTime,
                          ),
                        ),
                    ) + 1}{" "}
                    (
                    {Math.round(
                      Math.max(
                        ...summaryData.questionStats.map((q) => q.averageTime),
                      ),
                    )}
                    s)
                  </span>
                </div>
              </div>
            </div>

            {/* Score Distribution */}
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Score Distribution
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-orange-700">Highest Score:</span>
                  <span className="font-semibold">
                    {Math.max(
                      ...summaryData.playerStats.map((p) => p.score),
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-700">Score Range:</span>
                  <span className="font-semibold">
                    {(
                      Math.max(...summaryData.playerStats.map((p) => p.score)) -
                      Math.min(...summaryData.playerStats.map((p) => p.score))
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button
            onClick={async () => {
              try {
                // Sort players by score (highest first)
                const sortedPlayers = [...players].sort(
                  (a, b) => b.score - a.score,
                );

                // Get all game answers for this session
                const { data: gameAnswers, error: answersError } =
                  await supabase
                    .from("game_answers")
                    .select(
                      `
                    *,
                    game_players!inner(player_name),
                    questions!inner(text),
                    options!inner(text, is_correct)
                  `,
                    )
                    .eq("session_id", sessionId)
                    .order("question_index", { ascending: true });

                if (answersError) throw answersError;

                // Create comprehensive CSV content
                let csvContent = "";

                // Section 1: Quiz Information
                csvContent += "QUIZ INFORMATION\n";
                csvContent += `Quiz Title,${quiz?.title || "Unknown Quiz"}\n`;
                csvContent += `Total Questions,${questions.length}\n`;
                csvContent += `Total Players,${players.length}\n`;
                csvContent += `Game PIN,${gameSession?.game_pin || "N/A"}\n`;
                csvContent += "\n";

                // Section 2: Final Leaderboard
                csvContent += "FINAL LEADERBOARD\n";
                csvContent += "Rank,Player Name,Final Score\n";
                sortedPlayers.forEach((player, index) => {
                  csvContent += `${index + 1},"${player.name}",${player.score}\n`;
                });
                csvContent += "\n";

                // Section 3: Questions and Correct Answers
                csvContent += "QUESTIONS AND CORRECT ANSWERS\n";
                csvContent +=
                  "Question Number,Question Text,Correct Answer,Time Limit (seconds)\n";
                questions.forEach((question, index) => {
                  const correctOption = question.options.find(
                    (opt) => opt.is_correct,
                  );
                  csvContent += `${index + 1},"${question.text}","${correctOption?.text || "N/A"}",${question.time_limit}\n`;
                });
                csvContent += "\n";

                // Section 4: All Answer Options for Each Question
                csvContent += "ALL ANSWER OPTIONS\n";
                csvContent +=
                  "Question Number,Question Text,Option Text,Is Correct\n";
                questions.forEach((question, qIndex) => {
                  question.options.forEach((option) => {
                    csvContent += `${qIndex + 1},"${question.text}","${option.text}",${option.is_correct ? "Yes" : "No"}\n`;
                  });
                });
                csvContent += "\n";

                // Section 5: Detailed Player Answers
                csvContent += "DETAILED PLAYER ANSWERS\n";
                csvContent +=
                  "Player Name,Question Number,Question Text,Player Answer,Correct Answer,Is Correct,Time Taken (seconds),Points Earned\n";

                // Group answers by player and question for better organization
                const answersByPlayer = {};
                gameAnswers?.forEach((answer) => {
                  const playerName = answer.game_players.player_name;
                  if (!answersByPlayer[playerName]) {
                    answersByPlayer[playerName] = {};
                  }
                  answersByPlayer[playerName][answer.question_index] = answer;
                });

                // Generate rows for each player and each question
                sortedPlayers.forEach((player) => {
                  questions.forEach((question, qIndex) => {
                    const playerAnswer = answersByPlayer[player.name]?.[qIndex];
                    const correctOption = question.options.find(
                      (opt) => opt.is_correct,
                    );

                    if (playerAnswer) {
                      const pointsEarned = playerAnswer.is_correct ? 100 : 0;
                      csvContent += `"${player.name}",${qIndex + 1},"${question.text}","${playerAnswer.options.text}","${correctOption?.text || "N/A"}",${playerAnswer.is_correct ? "Yes" : "No"},${playerAnswer.time_taken},${pointsEarned}\n`;
                    } else {
                      // Player didn't answer this question
                      csvContent += `"${player.name}",${qIndex + 1},"${question.text}","No Answer","${correctOption?.text || "N/A"}","No","N/A",0\n`;
                    }
                  });
                });
                csvContent += "\n";

                // Section 6: Question Performance Summary
                csvContent += "QUESTION PERFORMANCE SUMMARY\n";
                csvContent +=
                  "Question Number,Question Text,Total Answers,Correct Answers,Incorrect Answers,No Answers,Accuracy Rate\n";
                questions.forEach((question, qIndex) => {
                  const questionAnswers =
                    gameAnswers?.filter(
                      (answer) => answer.question_index === qIndex,
                    ) || [];
                  const correctAnswers = questionAnswers.filter(
                    (answer) => answer.is_correct,
                  ).length;
                  const incorrectAnswers = questionAnswers.filter(
                    (answer) => !answer.is_correct,
                  ).length;
                  const noAnswers = players.length - questionAnswers.length;
                  const accuracyRate =
                    questionAnswers.length > 0
                      ? (
                          (correctAnswers / questionAnswers.length) *
                          100
                        ).toFixed(1)
                      : "0.0";

                  csvContent += `${qIndex + 1},"${question.text}",${questionAnswers.length},${correctAnswers},${incorrectAnswers},${noAnswers},${accuracyRate}%\n`;
                });

                // Create a blob and download link
                const blob = new Blob([csvContent], {
                  type: "text/csv;charset=utf-8;",
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute(
                  "download",
                  `${quiz?.title || "quiz"}_comprehensive_results.csv`,
                );
                link.style.visibility = "hidden";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                toast({
                  title: "Export successful",
                  description:
                    "Comprehensive quiz results have been exported to Excel",
                });
              } catch (error: any) {
                toast({
                  title: "Export failed",
                  description:
                    error.message || "Something went wrong while exporting",
                  variant: "destructive",
                });
              }
            }}
            className="bg-green-600 hover:bg-green-700 gap-2 text-lg px-8 py-6 h-auto"
          >
            Export to Excel
          </Button>
          <Button
            onClick={async () => {
              try {
                const printWindow = window.open("", "_blank");
                if (printWindow) {
                  // Get the entire HTML content of the current document
                  const fullHtml = document.documentElement.outerHTML;

                  // Get all computed styles and inject them into the new window
                  let styleHtml = "";
                  for (const styleSheet of document.styleSheets) {
                    try {
                      if (styleSheet.cssRules) {
                        for (const cssRule of styleSheet.cssRules) {
                          styleHtml += cssRule.cssText;
                        }
                      }
                    } catch (e) {
                      console.warn(
                        "Could not read stylesheet rules (might be cross-origin):",
                        e,
                      );
                    }
                  }

                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>Game Play Summary</title>
                      <style>
                        body { margin: 0; font-family: sans-serif; }
                        /* Include all existing styles for accurate representation */
                        ${styleHtml}
                        @media print {
                          body { margin: 0; }
                          /* Add any specific print styles here if needed */
                        }
                      </style>
                    </head>
                    <body>
                      ${fullHtml}
                    </body>
                    </html>
                  `);
                  printWindow.document.close();

                  setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                  }, 500);
                }

                toast({
                  title: "PDF Export",
                  description:
                    "Print dialog opened. Please save as PDF from the print options.",
                });
              } catch (error: any) {
                toast({
                  title: "PDF Export failed",
                  description:
                    error.message ||
                    "Something went wrong while generating PDF",
                  variant: "destructive",
                });
              }
            }}
            className="bg-red-600 hover:bg-red-700 gap-2 text-lg px-8 py-6 h-auto"
          >
            Export to PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GamePlay;
