import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Users, Clock, Copy, ArrowRight } from "lucide-react";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../auth/VercelAuthProvider";
import { useToast } from "@/components/ui/use-toast";
import UserMenu from "@/components/ui/user-menu";
import Logo from "@/components/ui/logo";
import { Link } from "react-router-dom";

interface Quiz {
  id: string;
  title: string;
  description: string;
  created_at: string;
  question_count?: number;
}

const HostQuiz = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<"live" | "poll" | "anytime">("live");
  const [showGameModeSelection, setShowGameModeSelection] = useState(false);

  useEffect(() => {
    if (user) {
      fetchQuizzes();
    }
  }, [user]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);

      // Get all quizzes created by the user
      const { data: quizzesData, error: quizzesError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (quizzesError) throw quizzesError;

      // For each quiz, count the number of questions
      const quizzesWithQuestionCount = await Promise.all(
        (quizzesData || []).map(async (quiz) => {
          const { count, error } = await supabase
            .from("questions")
            .select("*", { count: "exact" })
            .eq("quiz_id", quiz.id);

          return {
            ...quiz,
            question_count: count || 0,
          };
        }),
      );

      setQuizzes(quizzesWithQuestionCount);
    } catch (error: any) {
      toast({
        title: "Error loading quizzes",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    if (!selectedQuiz) {
      toast({
        title: "No quiz selected",
        description: "Please select a quiz to host",
        variant: "destructive",
      });
      return;
    }

    setShowGameModeSelection(true);
  };

  const startGameWithMode = async (mode: "live" | "poll" | "anytime") => {
    try {
      // Generate a random 6-digit game PIN
      const pin = Math.floor(100000 + Math.random() * 900000).toString();

      if (mode === "live") {
        // Create a new live game session
        const { data, error } = await supabase
          .from("game_sessions")
          .insert({
            quiz_id: selectedQuiz,
            host_id: user?.id,
            game_pin: pin,
            status: "waiting",
            game_mode: "live",
          })
          .select();

        if (error) throw error;
        if (!data || data.length === 0)
          throw new Error("Failed to create game session");

        setGamePin(pin);
        setGameMode("live");
        // Don't navigate immediately, show the game PIN first
      } else if (mode === "poll") {
        // Create a new poll session
        const { data, error } = await supabase
          .from("poll_sessions")
          .insert({
            quiz_id: selectedQuiz,
            host_id: user?.id,
            game_pin: pin,
            status: "waiting",
          })
          .select();

        if (error) {
          console.error("Poll session creation error:", error);
          throw error;
        }
        if (!data || data.length === 0)
          throw new Error("Failed to create poll session");

        console.log("Created poll session:", data[0]);
        setGamePin(pin);
        setGameMode("poll");
        // Don't navigate immediately, show the game PIN first
      } else if (mode === "anytime") {
        // Create a new anytime quiz session
        const { data, error } = await supabase
          .from("anytime_quiz_sessions")
          .insert({
            quiz_id: selectedQuiz,
            host_id: user?.id,
            game_pin: pin,
            status: "active",
          })
          .select();

        if (error) {
          console.error("Anytime quiz session creation error:", error);
          throw error;
        }
        if (!data || data.length === 0)
          throw new Error("Failed to create anytime quiz session");

        console.log("Created anytime quiz session:", data[0]);
        setGamePin(pin);
        setGameMode("anytime");
        // Navigate immediately for anytime quiz
        navigate(`/anytime-quiz/${data[0].id}`);
        return;
      }

      setShowGameModeSelection(false);
    } catch (error: any) {
      toast({
        title: "Error starting game",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const copyGamePin = () => {
    if (gamePin) {
      navigator.clipboard.writeText(gamePin);
      toast({
        title: "Game PIN copied",
        description: "Share this PIN with participants",
      });
    }
  };

  const deleteQuiz = async (quizId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this quiz? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setDeleteLoading(quizId);

      // First delete all questions associated with the quiz
      const { error: questionsError } = await supabase
        .from("questions")
        .delete()
        .eq("quiz_id", quizId);

      if (questionsError) throw questionsError;

      // Then delete the quiz itself
      const { error: quizError } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quizId);

      if (quizError) throw quizError;

      // Update the local state to remove the deleted quiz
      setQuizzes(quizzes.filter((quiz) => quiz.id !== quizId));

      // If the deleted quiz was selected, clear the selection
      if (selectedQuiz === quizId) {
        setSelectedQuiz(null);
      }

      toast({
        title: "Quiz deleted",
        description: "The quiz has been successfully deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting quiz",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FF6952] pt-16 pb-12">
      <div className="w-full bg-white flex justify-between items-center px-4 sm:px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
        <Link to="/">
          <Logo className="h-8 sm:h-12 w-auto ml-0 sm:ml-16" />
        </Link>
        <UserMenu />
      </div>
      <div className="max-w-4xl mx-auto px-4 mt-16">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Host a Quiz
          </h1>
          <div className="flex flex-col sm:flex-row gap-2 text-white w-full sm:w-auto">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="gap-2 text-xs sm:text-sm"
              size="sm"
            >
              Home
            </Button>
            <Button
              onClick={() => navigate("/results")}
              variant="outline"
              className="gap-2 text-xs sm:text-sm"
              size="sm"
            >
              View All Results
            </Button>
            <Button
              onClick={() => navigate("/create")}
              className="bg-navy hover:bg-navy/90 gap-2 text-xs sm:text-sm"
              size="sm"
            >
              Create New Quiz
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-gray-100 border-t-navy animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-4 w-4 rounded-full bg-navy/20 animate-pulse" />
              </div>
            </div>
          </div>
        ) : showGameModeSelection ? (
          <Card className="bg-white shadow-sm border-gray-100 text-center p-4 sm:p-8">
            <div className="max-w-md mx-auto">
              <h2 className="text-xl sm:text-2xl font-bold mb-4">
                Select Game Mode
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                Choose how you want to run this quiz
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => startGameWithMode("live")}
                  className="w-full bg-green-600 hover:bg-green-700 gap-2 text-sm sm:text-base px-4 py-3"
                >
                  <Play className="h-4 w-4" />
                  Live Quiz (Real-time with timer)
                </Button>
                <Button
                  onClick={() => startGameWithMode("poll")}
                  className="w-full bg-blue-600 hover:bg-blue-700 gap-2 text-sm sm:text-base px-4 py-3"
                >
                  <Users className="h-4 w-4" />
                  Poll Mode (No timer, show results)
                </Button>
                <Button
                  onClick={() => startGameWithMode("anytime")}
                  className="w-full bg-purple-600 hover:bg-purple-700 gap-2 text-sm sm:text-base px-4 py-3"
                >
                  <Clock className="h-4 w-4" />
                  Self-Paced (Anytime access)
                </Button>
                <Button
                  onClick={() => setShowGameModeSelection(false)}
                  variant="outline"
                  className="w-full text-sm sm:text-base px-4 py-3"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        ) : gamePin ? (
          <Card className="bg-white shadow-sm border-gray-100 text-center p-4 sm:p-8">
            <div className="max-w-md mx-auto">
              <div className="mb-6 bg-navy text-white p-4 sm:p-6 rounded-xl">
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Game PIN</h2>
                <div className="text-3xl sm:text-5xl font-bold tracking-wider mb-4">
                  {gamePin}
                </div>
                <div className="flex flex-col gap-3 justify-center items-center">
                  <Button
                    onClick={copyGamePin}
                    variant="outline"
                    className="bg-white/20 border-white text-white hover:bg-white/30 gap-2 text-sm"
                    size="sm"
                  >
                    <Copy className="h-4 w-4" />
                    Copy PIN
                  </Button>

                  <div className="flex flex-col items-center bg-white p-2 sm:p-3 rounded-lg">
                    <div className="bg-white p-1 rounded-md mb-2">
                      {gamePin && (
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${window.location.origin}/join?pin=${gamePin}`)}`}
                          alt="QR Code"
                          className="w-16 h-16 sm:w-24 sm:h-24"
                        />
                      )}
                    </div>
                    <span className="text-xs text-gray-800 font-medium">
                      Scan to join
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm sm:text-lg mb-6">
                Share this PIN with participants. They can join at{" "}
                <span className="font-bold">quizmaster.com</span> or through the
                app.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                <Button
                  onClick={() => {
                    // Navigate based on the game mode that was selected
                    if (gameMode === "live") {
                      // For live games, find the session by game PIN
                      supabase
                        .from("game_sessions")
                        .select("id")
                        .eq("game_pin", gamePin)
                        .single()
                        .then(({ data, error }) => {
                          if (error || !data) {
                            toast({
                              title: "Error",
                              description: "Could not find game session",
                              variant: "destructive",
                            });
                          } else {
                            navigate(`/game/${data.id}`);
                          }
                        });
                    } else if (gameMode === "poll") {
                      // For poll games, find the session by game PIN
                      supabase
                        .from("poll_sessions")
                        .select("id")
                        .eq("game_pin", gamePin)
                        .single()
                        .then(({ data, error }) => {
                          if (error || !data) {
                            toast({
                              title: "Error",
                              description: "Could not find poll session",
                              variant: "destructive",
                            });
                          } else {
                            navigate(`/poll/${data.id}`);
                          }
                        });
                    }
                  }}
                  className="bg-navy hover:bg-navy/90 gap-2 text-sm sm:text-lg px-4 sm:px-8 py-4 sm:py-6 h-auto"
                >
                  {gameMode === "live"
                    ? "Continue to Live Quiz Lobby"
                    : "Continue to Poll Lobby"}
                  <ArrowRight className="h-4 sm:h-5 w-4 sm:w-5" />
                </Button>
              </div>
            </div>
          </Card>
        ) : quizzes.length === 0 ? (
          <Card className="bg-white shadow-sm border-gray-100 p-4 sm:p-8 text-center">
            <div className="max-w-md mx-auto">
              <h2 className="text-xl sm:text-2xl font-bold mb-4">
                No Quizzes Found
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                You haven't created any quizzes yet. Create your first quiz to
                get started!
              </p>
              <Button
                onClick={() => navigate("/create")}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 gap-2 text-sm sm:text-lg px-4 sm:px-8 py-4 sm:py-6 h-auto w-full sm:w-auto"
              >
                Create Your First Quiz
                <ArrowRight className="h-4 sm:h-5 w-4 sm:w-5" />
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
              {quizzes.map((quiz) => (
                <Card
                  key={quiz.id}
                  className={`bg-white shadow-sm border-2 cursor-pointer transition-all ${selectedQuiz === quiz.id ? "border-[#46178F]" : "border-gray-100 hover:border-gray-300"}`}
                  onClick={() => setSelectedQuiz(quiz.id)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg">
                      {quiz.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs sm:text-sm text-gray-500 mb-4 line-clamp-2">
                      {quiz.description || "No description"}
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between text-xs sm:text-sm text-gray-600 gap-2 sm:gap-0">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span>
                          {new Date(quiz.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span>{quiz.question_count} questions</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-3">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/edit/${quiz.id}`);
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs sm:text-sm"
                      >
                        Edit Quiz
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteQuiz(quiz.id);
                        }}
                        variant="destructive"
                        size="sm"
                        className="w-full text-xs sm:text-sm"
                      >
                        Delete Quiz
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-center">
              <Button
                onClick={startGame}
                disabled={!selectedQuiz}
                className="bg-navy hover:bg-navy/90 gap-2 text-sm sm:text-lg px-6 sm:px-8 py-4 sm:py-6 h-auto disabled:opacity-50 w-full sm:w-auto"
              >
                <Play className="h-4 sm:h-5 w-4 sm:w-5" />
                Start Game
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HostQuiz;
