import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, RefreshCw, Play, ArrowLeft } from "lucide-react";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../auth/VercelAuthProvider";
import { useToast } from "@/components/ui/use-toast";
import UserMenu from "@/components/ui/user-menu";
import Logo from "@/components/ui/logo";

const PollPlayersMonitor = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pollSession, setPollSession] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (sessionId) {
      initializeMonitor();
    }

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [sessionId]);

  const initializeMonitor = async () => {
    try {
      setLoading(true);
      console.log("[MONITOR] Initializing for session:", sessionId);

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
      console.log("[MONITOR] Poll session loaded:", sessionData);

      // Get the quiz details
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", sessionData.quiz_id)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);

      // Load players
      await loadPlayers();

      // Set up real-time subscription for new players
      setupPlayerSubscription();
    } catch (error: any) {
      console.error("[MONITOR] Error initializing:", error);
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

  const loadPlayers = async () => {
    try {
      const { data: playersData, error: playersError } = await supabase
        .from("poll_players")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (playersError) throw playersError;
      setPlayers(playersData || []);
      console.log("[MONITOR] Players loaded:", playersData?.length || 0);
    } catch (error: any) {
      console.error("[MONITOR] Error loading players:", error);
      toast({
        title: "Error loading players",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const setupPlayerSubscription = () => {
    console.log("[MONITOR] Setting up player subscription");

    subscriptionRef.current = supabase
      .channel(`poll_players_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "poll_players",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("[MONITOR] New player joined:", payload.new);
          setPlayers((prev) => [...prev, payload.new]);
          toast({
            title: "New player joined!",
            description: `${payload.new.name || "Anonymous"} has joined the poll`,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "poll_players",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("[MONITOR] Player left:", payload.old);
          setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
        },
      )
      .subscribe();
  };

  const refreshPlayers = async () => {
    setRefreshing(true);
    await loadPlayers();
    setRefreshing(false);
  };

  const startPoll = () => {
    navigate(`/poll/${sessionId}`);
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

  return (
    <div className="min-h-screen bg-[#f5f5f7] pt-16 pb-12">
      <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
        <Link to="/">
          <Logo className="h-12 w-auto ml-0 sm:ml-16" />
        </Link>
        <UserMenu />
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-16">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Poll Players Monitor
            </h1>
            <p className="text-xl text-gray-600">{quiz?.title}</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate("/host")}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Host
            </Button>
            <Button
              onClick={refreshPlayers}
              variant="outline"
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              onClick={startPoll}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Play className="h-4 w-4" />
              Start Poll
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats Card */}
          <Card className="bg-white shadow-sm border-gray-100 p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-500/20 mb-4">
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {players.length}
              </h3>
              <p className="text-gray-600">
                {players.length === 1 ? "Player" : "Players"} Joined
              </p>
            </div>
          </Card>

          {/* Game Info Card */}
          <Card className="bg-white shadow-sm border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-4">Poll Information</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Game PIN:</span>
                <p className="font-mono text-lg font-bold text-blue-600">
                  {pollSession?.game_pin}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Status:</span>
                <p className="font-medium capitalize">{pollSession?.status}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Created:</span>
                <p className="text-sm">
                  {pollSession?.created_at &&
                    new Date(pollSession.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          {/* Quick Actions Card */}
          <Card className="bg-white shadow-sm border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(pollSession?.game_pin || "");
                  toast({
                    title: "Game PIN copied",
                    description: "Share this PIN with participants",
                  });
                }}
                variant="outline"
                className="w-full"
              >
                Copy Game PIN
              </Button>
              <Button
                onClick={() => {
                  const joinUrl = `${window.location.origin}/join?pin=${pollSession?.game_pin}`;
                  navigator.clipboard.writeText(joinUrl);
                  toast({
                    title: "Join URL copied",
                    description: "Share this URL with participants",
                  });
                }}
                variant="outline"
                className="w-full"
              >
                Copy Join URL
              </Button>
            </div>
          </Card>
        </div>

        {/* Players List */}
        <Card className="bg-white shadow-sm border-gray-100 mt-6">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Joined Players</h3>
              <span className="text-sm text-gray-500">
                Updates automatically
              </span>
            </div>

            {players.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">No players yet</p>
                <p className="text-gray-400 text-sm">
                  Players will appear here as they join using the game PIN
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {players.map((player, index) => (
                  <div
                    key={player.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                        {(player.name || `P${index + 1}`)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {player.name || `Player ${index + 1}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          Joined{" "}
                          {new Date(player.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PollPlayersMonitor;
