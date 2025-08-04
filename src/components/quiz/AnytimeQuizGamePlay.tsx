import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Copy, Download, Eye, Clock } from "lucide-react";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../auth/VercelAuthProvider";
import { useToast } from "@/components/ui/use-toast";
import UserMenu from "@/components/ui/user-menu";
import Logo from "@/components/ui/logo";

const AnytimeQuizGamePlay = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [quizSession, setQuizSession] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    if (sessionId) {
      fetchQuizData();
      subscribeToPlayers();
    }
  }, [sessionId]);

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

      // Get questions count
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", sessionData.quiz_id);

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Get the players who have joined
      const { data: playersData, error: playersError } = await supabase
        .from("anytime_quiz_players")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      if (playersError) throw playersError;
      setPlayers(playersData || []);
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

  const subscribeToPlayers = () => {
    const subscription = supabase
      .channel(`anytime_quiz_${sessionId}_players`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "anytime_quiz_players",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newPlayer = payload.new;
          setPlayers((current) => [newPlayer, ...current]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "anytime_quiz_players",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const updatedPlayer = payload.new;
          setPlayers((current) =>
            current.map((player) =>
              player.id === updatedPlayer.id ? updatedPlayer : player,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
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

  const copyQuizLink = () => {
    const link = `${window.location.origin}/join?pin=${quizSession?.game_pin}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Quiz link copied",
      description: "Share this link with participants",
    });
  };

  const exportResults = async () => {
    try {
      // Get all players with their detailed answers
      const { data: playersWithAnswers, error } = await supabase
        .from("anytime_quiz_players")
        .select(
          `
          *,
          anytime_quiz_answers (
            *,
            questions (text),
            options (text, is_correct)
          )
        `,
        )
        .eq("session_id", sessionId)
        .order("score", { ascending: false });

      if (error) throw error;

      // Create comprehensive CSV content
      let csvContent = "";

      // Section 1: Quiz Information
      csvContent += "ANYTIME QUIZ RESULTS\n";
      csvContent += `Quiz Title,${quiz?.title || "Unknown Quiz"}\n`;
      csvContent += `Total Questions,${questions.length}\n`;
      csvContent += `Total Participants,${players.length}\n`;
      csvContent += `Game PIN,${quizSession?.game_pin || "N/A"}\n`;
      csvContent += `Export Date,${new Date().toLocaleString()}\n`;
      csvContent += "\n";

      // Section 2: Participant Summary
      csvContent += "PARTICIPANT SUMMARY\n";
      csvContent +=
        "Rank,Name,Email,Phone,Score,Completed At,IP Address,Total Answers,Correct Answers,Accuracy\n";

      playersWithAnswers?.forEach((player, index) => {
        const completedAt = player.completed_at
          ? new Date(player.completed_at).toLocaleString()
          : "Not Completed";
        const totalAnswers = player.anytime_quiz_answers?.length || 0;
        const correctAnswers =
          player.anytime_quiz_answers?.filter((a) => a.is_correct).length || 0;
        const accuracy =
          totalAnswers > 0
            ? Math.round((correctAnswers / totalAnswers) * 100)
            : 0;

        csvContent += `${index + 1},"${player.player_name}","${player.email}","${player.phone || "N/A"}",${player.score},"${completedAt}","${player.ip_address}",${totalAnswers},${correctAnswers},${accuracy}%\n`;
      });
      csvContent += "\n";

      // Section 3: Questions and Correct Answers
      csvContent += "QUESTIONS AND CORRECT ANSWERS\n";
      csvContent +=
        "Question Number,Question Text,Correct Answer,Time Limit (seconds)\n";
      questions.forEach((question, index) => {
        // Find correct option for this question
        const correctAnswer = "N/A"; // We'll need to fetch this separately
        csvContent += `${index + 1},"${question.text}","${correctAnswer}",${question.time_limit}\n`;
      });
      csvContent += "\n";

      // Section 4: Detailed Player Answers
      csvContent += "DETAILED PLAYER ANSWERS\n";
      csvContent +=
        "Player Name,Email,IP Address,Question Number,Question Text,Player Answer,Is Correct,Time Taken (seconds)\n";

      playersWithAnswers?.forEach((player) => {
        player.anytime_quiz_answers?.forEach((answer) => {
          const questionNumber = answer.question_index + 1;
          const questionText = answer.questions?.text || "Unknown Question";
          const playerAnswer = answer.options?.text || "Unknown Answer";
          const isCorrect = answer.is_correct ? "Yes" : "No";
          const timeTaken = answer.time_taken || "N/A";

          csvContent += `"${player.player_name}","${player.email}","${player.ip_address}",${questionNumber},"${questionText}","${playerAnswer}",${isCorrect},${timeTaken}\n`;
        });

        // Add rows for unanswered questions
        const answeredQuestions = new Set(
          player.anytime_quiz_answers?.map((a) => a.question_index) || [],
        );
        questions.forEach((question, qIndex) => {
          if (!answeredQuestions.has(qIndex)) {
            csvContent += `"${player.player_name}","${player.email}","${player.ip_address}",${qIndex + 1},"${question.text}","No Answer","No","N/A"\n`;
          }
        });
      });
      csvContent += "\n";

      // Section 5: Question Performance Summary
      csvContent += "QUESTION PERFORMANCE SUMMARY\n";
      csvContent +=
        "Question Number,Question Text,Total Answers,Correct Answers,Incorrect Answers,No Answers,Accuracy Rate\n";
      questions.forEach((question, qIndex) => {
        const questionAnswers =
          playersWithAnswers?.flatMap(
            (p) =>
              p.anytime_quiz_answers?.filter(
                (a) => a.question_index === qIndex,
              ) || [],
          ) || [];
        const correctAnswers = questionAnswers.filter(
          (a) => a.is_correct,
        ).length;
        const incorrectAnswers = questionAnswers.filter(
          (a) => !a.is_correct,
        ).length;
        const noAnswers = players.length - questionAnswers.length;
        const accuracyRate =
          questionAnswers.length > 0
            ? ((correctAnswers / questionAnswers.length) * 100).toFixed(1)
            : "0.0";

        csvContent += `${qIndex + 1},"${question.text}",${questionAnswers.length},${correctAnswers},${incorrectAnswers},${noAnswers},${accuracyRate}%\n`;
      });

      // Create and download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `anytime-quiz-comprehensive-results-${quiz?.title || "quiz"}-${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Results exported",
        description:
          "Comprehensive CSV file with all details has been downloaded",
      });
    } catch (error: any) {
      toast({
        title: "Error exporting results",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const endQuiz = async () => {
    if (
      !confirm(
        "Are you sure you want to end this quiz? This will prevent new participants from joining.",
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("anytime_quiz_sessions")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Quiz ended",
        description: "The quiz has been closed to new participants",
      });

      // Show summary instead of navigating away
      setShowSummary(true);
    } catch (error: any) {
      toast({
        title: "Error ending quiz",
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

  const completedPlayers = players.filter((player) => player.completed_at);
  const activePlayers = players.filter((player) => !player.completed_at);
  const averageScore =
    completedPlayers.length > 0
      ? Math.round(
          completedPlayers.reduce((sum, player) => sum + player.score, 0) /
            completedPlayers.length,
        )
      : 0;

  // Show summary when quiz is ended
  if (showSummary) {
    const sortedPlayers = [...completedPlayers].sort(
      (a, b) => b.score - a.score,
    );
    const winner = sortedPlayers[0];

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
              Quiz Summary
            </h1>
            <p className="text-xl text-gray-600">{quiz?.title}</p>
          </div>

          {/* Winner Card */}
          {winner && (
            <Card className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-xl border-0 p-8 mb-8">
              <div className="text-center">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-3xl font-bold mb-2">Winner!</h2>
                <div className="text-2xl font-semibold mb-2">
                  {winner.player_name}
                </div>
                <div className="text-xl opacity-90">{winner.score} points</div>
              </div>
            </Card>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white shadow-sm border-gray-100 p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {players.length}
              </div>
              <div className="text-sm text-gray-600">Total Participants</div>
            </Card>
            <Card className="bg-white shadow-sm border-gray-100 p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {completedPlayers.length}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </Card>
            <Card className="bg-white shadow-sm border-gray-100 p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {averageScore}
              </div>
              <div className="text-sm text-gray-600">Average Score</div>
            </Card>
            <Card className="bg-white shadow-sm border-gray-100 p-6 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {questions.length}
              </div>
              <div className="text-sm text-gray-600">Questions</div>
            </Card>
          </div>

          {/* Leaderboard */}
          <Card className="bg-white shadow-sm border-gray-100 mb-8">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold">Final Leaderboard</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {sortedPlayers.slice(0, 10).map((player, index) => {
                  let medalColor = "";
                  let medal = "";
                  if (index === 0) {
                    medalColor = "bg-yellow-500 text-white";
                    medal = "🥇";
                  } else if (index === 1) {
                    medalColor = "bg-gray-400 text-white";
                    medal = "🥈";
                  } else if (index === 2) {
                    medalColor = "bg-amber-600 text-white";
                    medal = "🥉";
                  }

                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center mr-4 font-bold ${medalColor || "bg-gray-200"}`}
                        >
                          {medal || index + 1}
                        </div>
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                            <span className="text-sm font-medium text-purple-600">
                              {player.player_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {player.player_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {player.email}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          {player.score} pts
                        </div>
                        <div className="text-sm text-gray-500">
                          {player.completed_at
                            ? new Date(player.completed_at).toLocaleString()
                            : "In Progress"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <Button
              onClick={exportResults}
              className="bg-green-600 hover:bg-green-700 gap-2 text-lg px-8 py-6 h-auto"
            >
              Export Detailed Results
            </Button>
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
            {quiz?.title} - Self-Paced Quiz
          </h1>
          <p className="text-xl text-gray-600">
            {questions.length} questions • {players.length} participants
          </p>
        </div>

        {/* Game PIN and Controls */}
        <Card className="bg-white shadow-sm border-gray-100 p-8 mb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-4">Game PIN</h2>
            <div className="text-6xl font-bold text-purple-600 mb-4 tracking-wider">
              {quizSession?.game_pin}
            </div>
            <p className="text-gray-600 mb-6">
              Share this PIN or link with participants to join the quiz
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Button
                onClick={copyGamePin}
                className="bg-purple-600 hover:bg-purple-700 gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy PIN
              </Button>
              <Button
                onClick={copyQuizLink}
                variant="outline"
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
              <Button
                onClick={exportResults}
                variant="outline"
                className="gap-2"
                disabled={players.length === 0}
              >
                <Download className="h-4 w-4" />
                Export Results
              </Button>
              <Button onClick={endQuiz} variant="destructive" className="gap-2">
                End Quiz
              </Button>
            </div>
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-sm border-gray-100 p-6 text-center">
            <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {players.length}
            </div>
            <div className="text-sm text-gray-600">Total Participants</div>
          </Card>
          <Card className="bg-white shadow-sm border-gray-100 p-6 text-center">
            <Clock className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {completedPlayers.length}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </Card>
          <Card className="bg-white shadow-sm border-gray-100 p-6 text-center">
            <Eye className="h-8 w-8 text-orange-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {activePlayers.length}
            </div>
            <div className="text-sm text-gray-600">In Progress</div>
          </Card>
          <Card className="bg-white shadow-sm border-gray-100 p-6 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {averageScore}
            </div>
            <div className="text-sm text-gray-600">Average Score</div>
          </Card>
        </div>

        {/* Participants List */}
        <Card className="bg-white shadow-sm border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold">Participants</h2>
          </div>

          {players.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No participants yet</p>
              <p className="text-sm">Share the game PIN to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {players.map((player, index) => (
                    <tr
                      key={player.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-purple-600">
                                {player.player_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {player.player_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {player.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {player.phone || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            player.completed_at
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {player.completed_at ? "Completed" : "In Progress"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {player.completed_at ? `${player.score} pts` : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.completed_at
                          ? new Date(player.completed_at).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AnytimeQuizGamePlay;
