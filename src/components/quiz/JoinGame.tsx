import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";
import UserMenu from "@/components/ui/user-menu";
import Logo from "@/components/ui/logo";
import { Link } from "react-router-dom";

const JoinGame = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [gamePin, setGamePin] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [step, setStep] = useState(1); // 1: Enter PIN, 2: Enter Name
  const [loading, setLoading] = useState(false);
  const [gameSession, setGameSession] = useState<any>(null);
  const [gameMode, setGameMode] = useState<"live" | "poll" | "anytime">("live");

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gamePin.trim()) {
      toast({
        title: "Missing game PIN",
        description: "Please enter a valid game PIN",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Check for live game session
      const { data: liveGame, error: liveError } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("game_pin", gamePin)
        .eq("status", "waiting")
        .single();

      if (!liveError && liveGame) {
        setGameSession(liveGame);
        setGameMode("live");
        setStep(2);
        return;
      }

      // Check for poll session
      const { data: pollGame, error: pollError } = await supabase
        .from("poll_sessions")
        .select("*")
        .eq("game_pin", gamePin)
        .in("status", ["waiting", "active"])
        .single();

      if (!pollError && pollGame) {
        setGameSession(pollGame);
        setGameMode("poll");
        setStep(2);
        return;
      }

      // Check for anytime quiz session
      const { data: anytimeGame, error: anytimeError } = await supabase
        .from("anytime_quiz_sessions")
        .select("*")
        .eq("game_pin", gamePin)
        .eq("status", "active")
        .single();

      if (!anytimeError && anytimeGame) {
        setGameSession(anytimeGame);
        setGameMode("anytime");
        setStep(2);
        return;
      }

      // No game found
      toast({
        title: "Game not found",
        description: "Please check the PIN and try again",
        variant: "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Error joining game",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playerName.trim()) {
      toast({
        title: "Missing name",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      if (gameMode === "live") {
        // Add the player to the live game
        const { data, error } = await supabase
          .from("game_players")
          .insert({
            session_id: gameSession.id,
            player_name: playerName,
          })
          .select();

        if (error) throw error;
        navigate(`/play/${gameSession.id}/${data[0].id}`);
      } else if (gameMode === "poll") {
        // Add the player to the poll
        const { data, error } = await supabase
          .from("poll_players")
          .insert({
            session_id: gameSession.id,
            player_name: playerName,
          })
          .select();

        if (error) throw error;
        navigate(`/poll-play/${gameSession.id}/${data[0].id}`);
      } else if (gameMode === "anytime") {
        // For anytime quiz, we need additional information
        navigate(
          `/anytime-quiz-join/${gameSession.id}?name=${encodeURIComponent(playerName)}`,
        );
      }
    } catch (error: any) {
      toast({
        title: "Error joining game",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 text-white flex items-center justify-center p-4">
      <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
        <Logo className="bg-white/20 backdrop-blur-md p-1 rounded ml-0 sm:ml-16" />
        <UserMenu />
      </div>
      <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl">
        <div className="flex justify-center items-center mb-4 mt-4">
          <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
        </div>
        <CardHeader className="text-center">
          <CardTitle className="text-3xl text-white font-bold">
            {step === 1 ? "Join a Game" : "Enter Your Name"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <form onSubmit={handlePinSubmit} className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="gamePin"
                  className="block text-sm text-white font-medium"
                >
                  Game PIN
                </label>
                <Input
                  id="gamePin"
                  value={gamePin}
                  onChange={(e) => setGamePin(e.target.value)}
                  placeholder="Enter 6-digit PIN"
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-coral focus:border-coral text-xl text-center tracking-wider h-14"
                  maxLength={6}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-white text-navy hover:bg-white/90 text-lg py-6 h-auto"
                disabled={loading}
              >
                {loading ? "Checking..." : "Enter"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleNameSubmit} className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="playerName"
                  className="block text-sm text-white font-medium"
                >
                  Your Name
                </label>
                <Input
                  id="playerName"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-coral focus:border-coral text-xl text-center h-14"
                  maxLength={15}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-white text-navy hover:bg-white/90 text-lg py-6 h-auto gap-2"
                disabled={loading}
              >
                {loading ? "Joining..." : "Join Quiz"}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinGame;
