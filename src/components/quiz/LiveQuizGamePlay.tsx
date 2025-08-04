import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, Award, Users, Clock, Copy, Play } from "lucide-react";
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
}

const LiveQuizGamePlay = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [quizSession, setQuizSession] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [answerStats, setAnswerStats] = useState<{ [key: string]: number }>({});
  const [totalAnswers, setTotalAnswers] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchGameData();
      subscribeToAnswers();
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
          description: "You are not the host of this quiz",
          variant: "destructive",
        });
        navigate("/host");
        return;
      }

      setQuizSession(sessionData);

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
        score: player.score || 0,
      }));

      setPlayers(formattedPlayers);

      // If the game is already in progress, get the current question index
      if (sessionData.current_question_index !== null) {
        setCurrentQuestionIndex(sessionData.current_question_index);
        if (
          sessionData.current_question_index >= 0 &&
          sessionData.current_question_index < questionsWithOptions.length
        ) {
          const question =
            questionsWithOptions[sessionData.current_question_index];
          startTimer(question.time_limit);
          refreshAnswerStats();
        }
      }
    } catch (error: any) {
      toast({
        title: "Error loading quiz",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      navigate("/host");
    } finally {
      setLoading(false);
    }
  };

  const subscribeToAnswers = () => {
    const subscription = supabase
      .channel(`game_${sessionId}_answers`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_answers",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const answer = payload.new;
          if (answer.question_index === currentQuestionIndex) {
            refreshAnswerStats();
          }
          // Update player score if correct
          if (answer.is_correct) {
            setPlayers((current) =>
              current.map((player) =>
                player.id === answer.player_id
                  ? { ...player, score: player.score + 1000 }
                  : player,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const refreshAnswerStats = async () => {
    try {
      const { data: answers, error } = await supabase
        .from("game_answers")
        .select("option_id")
        .eq("session_id", sessionId)
        .eq("question_index", currentQuestionIndex);

      if (error) throw error;

      const stats: { [key: string]: number } = {};
      if (questions[currentQuestionIndex]) {
        questions[currentQuestionIndex].options.forEach((option) => {
          stats[option.id] = 0;
        });
      }

      answers?.forEach((answer) => {
        if (stats.hasOwnProperty(answer.option_id)) {
          stats[answer.option_id]++;
        }
      });

      setAnswerStats({ ...stats });
      setTotalAnswers(answers?.length || 0);
    } catch (error: any) {
      console.error("Error fetching answer stats:", error);
    }
  };

  const startTimer = (seconds: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setTimeLeft(seconds);
    setShowResults(false);

    // Initialize answer stats
    const initialStats: { [key: string]: number } = {};
    if (questions[currentQuestionIndex]) {
      questions[currentQuestionIndex].options.forEach((option) => {
        initialStats[option.id] = 0;
      });
    }
    setAnswerStats(initialStats);
    setTotalAnswers(0);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          setShowResults(true);
          refreshAnswerStats();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
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
      // Update game session status to active and set first question
      const { error } = await supabase
        .from("game_sessions")
        .update({
          status: "active",
          current_question_index: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) throw error;

      setCurrentQuestionIndex(0);
      startTimer(questions[0].time_limit);

      // Broadcast game start to all participants
      await supabase.channel(`game_${sessionId}_sync`).send({
        type: "broadcast",
        event: "game_started",
        payload: {
          question_index: 0,
          question: questions[0],
          timestamp: Date.now(),
        },
      });
    } catch (error: any) {
      toast({
        title: "Error starting game",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const nextQuestion = async () => {
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      await endGame();
      return;
    }

    try {
      // Update database with next question index
      const { error } = await supabase
        .from("game_sessions")
        .update({
          current_question_index: nextIndex,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) throw error;

      setCurrentQuestionIndex(nextIndex);
      startTimer(questions[nextIndex].time_limit);

      // Broadcast next question to all participants
      await supabase.channel(`game_${sessionId}_sync`).send({
        type: "broadcast",
        event: "next_question",
        payload: {
          question_index: nextIndex,
          question: questions[nextIndex],
          timestamp: Date.now(),
        },
      });
    } catch (error: any) {
      toast({
        title: "Error loading next question",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const endGame = async () => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
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
  };

  const copyGamePin = () => {
    if (quizSession?.game_pin) {
      navigator.clipboard.writeText(quizSession.game_pin);
      toast({
        title: "Game PIN copied",
        description: "Share this PIN with participants",
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

  if (gameEnded) {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
      <div className="min-h-screen bg-[#f5f5f7] pt-16 pb-12">
        <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
          <Link to="/">
            <Logo className="h-12 w-auto ml-16" />
          </Link>
          <UserMenu />
        </div>

        <div className="max-w-4xl mx-auto px-4 mt-16">
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
                if (index === 0) medalColor = "bg-coral text-white";
                else if (index === 1) medalColor = "bg-skyblue text-white";
                else if (index === 2) medalColor = "bg-navy text-white";

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

          <div className="flex justify-center">
            <Button
              onClick={() => navigate("/host")}
              className="bg-navy hover:bg-navy/90 gap-2 text-lg px-8 py-6 h-auto"
            >
              Back to Host Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (currentQuestionIndex === -1 && quizSession?.status !== "active") {
    return (
      <div className="min-h-screen bg-[#f5f5f7] pt-16 pb-12">
        <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
          <Link to="/">
            <Logo className="h-12 w-auto ml-16" />
          </Link>
          <UserMenu />
        </div>

        <div className="max-w-4xl mx-auto px-4 text-center mt-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {quiz?.title} - Live Quiz
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {questions.length} questions
          </p>

          {/* Game PIN Display */}
          <Card className="bg-white shadow-sm border-gray-100 p-8 mb-8">
            <div className="max-w-md mx-auto">
              <div className="mb-6 bg-navy text-white p-6 rounded-xl">
                <h2 className="text-2xl font-bold mb-2">Game PIN</h2>
                <div className="text-5xl font-bold tracking-wider mb-4">
                  {quizSession?.game_pin}
                </div>
                <Button
                  onClick={copyGamePin}
                  variant="outline"
                  className="bg-white/20 border-white text-white hover:bg-white/30 gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy PIN
                </Button>
              </div>

              <h2 className="text-2xl font-bold mb-4">Ready to Start?</h2>
              <p className="text-gray-600 mb-6">
                {players.length}{" "}
                {players.length === 1 ? "player has" : "players have"} joined.
              </p>
              <Button
                onClick={startGame}
                className="bg-green-600 hover:bg-green-700 gap-2 text-lg px-8 py-6 h-auto"
              >
                <Play className="h-5 w-5" />
                Start Live Quiz
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
            <h2 className="text-xl font-bold text-white">
              Question {questionNumber} of {totalQuestions}
            </h2>
          </div>
          <div className="text-2xl font-bold text-white">{timeLeft}s</div>
        </div>

        <div className="h-2 bg-white/20 rounded-full mb-6">
          <div
            className="h-2 bg-white rounded-full transition-all duration-300"
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
                          {option.is_correct && (
                            <div className="flex-shrink-0 ml-2">
                              <span className="inline-flex items-center text-xs bg-white text-green-600 px-3 py-1.5 rounded-full font-bold">
                                ✓ Correct
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">
                              {percentage}%
                            </span>
                            <span className="text-sm opacity-90">
                              ({answerCount} players)
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 h-3 bg-black/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white/80 rounded-full transition-all duration-700"
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
                  onClick={endGame}
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
                    "bg-coral",
                    "bg-skyblue",
                    "bg-navy",
                    "bg-coral/80",
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

            <div className="text-center">
              <div className="text-white/80 mb-2">
                <span className="bg-white/20 px-3 py-1 rounded-full">
                  {totalAnswers} players have answered
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveQuizGamePlay;
