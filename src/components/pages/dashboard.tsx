import React, { useState, useEffect } from "react";
import TopNavigation from "../dashboard/layout/TopNavigation";
import Sidebar from "../dashboard/layout/Sidebar";
import DashboardGrid from "../dashboard/DashboardGrid";
import TaskBoard from "../dashboard/TaskBoard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw,
  Trophy,
  Users,
  Clock,
  BarChart3,
  Download,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../auth/VercelAuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const [loading, setLoading] = useState(false);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Function to trigger loading state for demonstration
  const handleRefresh = () => {
    setLoading(true);
    // Reset loading after 2 seconds
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  // Fetch quiz results
  const fetchQuizResults = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get all quizzes created by the user
      const { data: quizzes, error: quizzesError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (quizzesError) throw quizzesError;

      // For each quiz, get game sessions and their results
      const quizResultsData = await Promise.all(
        (quizzes || []).map(async (quiz) => {
          // Get live game sessions
          const { data: liveSessions } = await supabase
            .from("game_sessions")
            .select("*")
            .eq("quiz_id", quiz.id)
            .eq("status", "completed");

          // Get poll sessions
          const { data: pollSessions } = await supabase
            .from("poll_sessions")
            .select("*")
            .eq("quiz_id", quiz.id)
            .eq("status", "completed");

          // Get anytime quiz sessions (both completed and active)
          const { data: anytimeSessions } = await supabase
            .from("anytime_quiz_sessions")
            .select("*")
            .eq("quiz_id", quiz.id)
            .in("status", ["completed", "active"]);

          const allSessions = [
            ...(liveSessions || []).map((s) => ({ ...s, type: "live" })),
            ...(pollSessions || []).map((s) => ({ ...s, type: "poll" })),
            ...(anytimeSessions || []).map((s) => ({ ...s, type: "anytime" })),
          ];

          // Get player counts and winners for each session
          const sessionsWithDetails = await Promise.all(
            allSessions.map(async (session) => {
              let players = [];
              let winner = null;
              let totalPlayers = 0;

              if (session.type === "live") {
                const { data: gamePlayers } = await supabase
                  .from("game_players")
                  .select("*")
                  .eq("session_id", session.id);

                players = gamePlayers || [];
                totalPlayers = players.length;

                // Calculate scores for live games
                const playersWithScores = await Promise.all(
                  players.map(async (player) => {
                    const { data: answers } = await supabase
                      .from("game_answers")
                      .select("is_correct")
                      .eq("session_id", session.id)
                      .eq("player_id", player.id);

                    const score =
                      (answers || []).filter((a) => a.is_correct).length * 100;
                    return { ...player, score };
                  }),
                );

                winner = playersWithScores.sort((a, b) => b.score - a.score)[0];
              } else if (session.type === "poll") {
                const { data: pollPlayers } = await supabase
                  .from("poll_players")
                  .select("*")
                  .eq("session_id", session.id);

                players = pollPlayers || [];
                totalPlayers = players.length;
              } else if (session.type === "anytime") {
                const { data: anytimePlayers } = await supabase
                  .from("anytime_quiz_players")
                  .select("*")
                  .eq("session_id", session.id);

                players = anytimePlayers || [];
                totalPlayers = players.length;
                winner = players.sort(
                  (a, b) => (b.score || 0) - (a.score || 0),
                )[0];
              }

              return {
                ...session,
                totalPlayers,
                winner,
                completedAt: session.updated_at || session.created_at,
              };
            }),
          );

          return {
            quiz,
            sessions: sessionsWithDetails,
          };
        }),
      );

      // Flatten and sort all sessions by completion date
      const allResults = quizResultsData
        .flatMap((qr) =>
          qr.sessions.map((s) => ({ ...s, quizTitle: qr.quiz.title })),
        )
        .sort(
          (a, b) =>
            new Date(b.completedAt).getTime() -
            new Date(a.completedAt).getTime(),
        );

      setQuizResults(allResults);
    } catch (error: any) {
      toast({
        title: "Error loading results",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showResults && user) {
      fetchQuizResults();
    }
  }, [showResults, user]);
  // Auto-load results when component mounts
  useEffect(() => {
    if (user) {
      setShowResults(true);
      fetchQuizResults();
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100">
      <TopNavigation />
      <div className="flex h-[calc(100vh-64px)] mt-16">
        {/* Hide sidebar on mobile */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto px-3 sm:px-6 pt-4 pb-2 flex flex-col sm:flex-row justify-end gap-2">
            <Button
              onClick={() => setShowResults(!showResults)}
              className="bg-purple-500 hover:bg-purple-600 text-white rounded-full px-3 sm:px-4 h-9 shadow-sm transition-colors flex items-center gap-2 text-sm"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">
                {showResults ? "Hide Results" : "View All Results"}
              </span>
              <span className="sm:hidden">
                {showResults ? "Hide" : "Results"}
              </span>
            </Button>
            <Button
              onClick={handleRefresh}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 sm:px-4 h-9 shadow-sm transition-colors flex items-center gap-2 text-sm"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">
                {loading ? "Loading..." : "Refresh Dashboard"}
              </span>
              <span className="sm:hidden">Refresh</span>
            </Button>
          </div>
          <div
            className={cn(
              "container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8",
              "transition-all duration-300 ease-in-out",
            )}
          >
            {showResults ? (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Quiz Results History
                  </h2>
                  <Button
                    onClick={fetchQuizResults}
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-600 text-white gap-2 w-full sm:w-auto"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
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
                ) : quizResults.length === 0 ? (
                  <Card className="bg-white shadow-sm border-gray-100 p-4 sm:p-8 text-center">
                    <div className="max-w-md mx-auto">
                      <BarChart3 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                        No Quiz Results Yet
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                        Complete some quizzes to see results and analytics here.
                      </p>
                      <Button
                        onClick={() => navigate("/host")}
                        className="bg-navy hover:bg-navy/90 w-full sm:w-auto"
                      >
                        Host a Quiz
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {quizResults.map((result, index) => (
                      <Card
                        key={`${result.id}-${index}`}
                        className="bg-white shadow-sm border-gray-100 hover:shadow-md transition-shadow"
                      >
                        <CardHeader className="pb-3 p-4 sm:p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                                {result.quizTitle}
                              </CardTitle>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${
                                    result.type === "live"
                                      ? "bg-green-100 text-green-700"
                                      : result.type === "poll"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-purple-100 text-purple-700"
                                  }`}
                                >
                                  {result.type === "live"
                                    ? "Live Quiz"
                                    : result.type === "poll"
                                      ? "Poll"
                                      : "Self-Paced"}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {new Date(
                                      result.completedAt,
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 p-4 sm:p-6 sm:pt-0">
                          <div className="space-y-3 sm:space-y-4">
                            {/* Status for ongoing quizzes */}
                            {result.status === "active" && (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                  <span>Status</span>
                                </div>
                                <span className="text-green-600 font-semibold text-xs sm:text-sm">
                                  Active
                                </span>
                              </div>
                            )}

                            {/* Participants */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>Participants</span>
                              </div>
                              <span className="font-semibold text-gray-900 text-sm">
                                {result.totalPlayers}
                              </span>
                            </div>

                            {/* Winner */}
                            {result.winner && (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                                  <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
                                  <span>Winner</span>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold text-gray-900 text-xs sm:text-sm truncate max-w-[120px]">
                                    {result.winner.player_name ||
                                      result.winner.name}
                                  </div>
                                  {result.winner.score && (
                                    <div className="text-xs text-gray-500">
                                      {result.winner.score} points
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Game PIN */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                                <span>Game PIN</span>
                              </div>
                              <span className="font-mono text-xs sm:text-sm bg-gray-100 px-2 py-1 rounded">
                                {result.game_pin}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs h-8"
                                onClick={() => {
                                  // Navigate to detailed results based on type
                                  if (result.type === "live") {
                                    // For live games, we could create a results page
                                    toast({
                                      title: "Feature Coming Soon",
                                      description:
                                        "Detailed live game results will be available soon",
                                    });
                                  } else if (result.type === "anytime") {
                                    navigate(`/anytime-quiz/${result.id}`);
                                  } else {
                                    toast({
                                      title: "Feature Coming Soon",
                                      description:
                                        "Detailed poll results will be available soon",
                                    });
                                  }
                                }}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">
                                  View Details
                                </span>
                                <span className="sm:hidden">View</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs h-8"
                                onClick={async () => {
                                  try {
                                    // Export basic results
                                    let csvContent = "Quiz Results Export\n";
                                    csvContent += `Quiz Title,${result.quizTitle}\n`;
                                    csvContent += `Game Type,${result.type}\n`;
                                    csvContent += `Game PIN,${result.game_pin}\n`;
                                    csvContent += `Total Participants,${result.totalPlayers}\n`;
                                    csvContent += `Completed At,${new Date(result.completedAt).toLocaleString()}\n`;

                                    if (result.winner) {
                                      csvContent += `Winner,${result.winner.player_name || result.winner.name}\n`;
                                      if (result.winner.score) {
                                        csvContent += `Winner Score,${result.winner.score}\n`;
                                      }
                                    }

                                    const blob = new Blob([csvContent], {
                                      type: "text/csv;charset=utf-8;",
                                    });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.setAttribute("href", url);
                                    link.setAttribute(
                                      "download",
                                      `${result.quizTitle}-${result.type}-results.csv`,
                                    );
                                    link.style.visibility = "hidden";
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);

                                    toast({
                                      title: "Export successful",
                                      description:
                                        "Basic results have been exported to CSV",
                                    });
                                  } catch (error: any) {
                                    toast({
                                      title: "Export failed",
                                      description:
                                        error.message || "Something went wrong",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Export
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <DashboardGrid isLoading={loading} />
                <TaskBoard isLoading={loading} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Home;
