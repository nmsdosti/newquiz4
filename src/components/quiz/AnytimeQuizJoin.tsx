import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Shield, AlertTriangle } from "lucide-react";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";
import UserMenu from "@/components/ui/user-menu";
import Logo from "@/components/ui/logo";
import { Link } from "react-router-dom";

const AnytimeQuizJoin = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [playerName, setPlayerName] = useState(searchParams.get("name") || "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [quizSession, setQuizSession] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");
  const [securityChecks, setSecurityChecks] = useState({
    ipCheck: false,
    deviceCheck: false,
    emailCheck: false,
    timeCheck: false,
  });

  useEffect(() => {
    if (sessionId) {
      fetchQuizSession();
      generateDeviceFingerprint();
    }
  }, [sessionId]);

  const generateDeviceFingerprint = () => {
    // Create a unique device fingerprint based on browser characteristics
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("Device fingerprint", 2, 2);
    }

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      navigator.hardwareConcurrency || 0,
      navigator.deviceMemory || 0,
    ].join("|");

    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    setDeviceFingerprint(Math.abs(hash).toString(36));
  };

  const fetchQuizSession = async () => {
    try {
      // Get the anytime quiz session
      const { data: sessionData, error: sessionError } = await supabase
        .from("anytime_quiz_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error("Quiz session not found");

      setQuizSession(sessionData);

      // Get the quiz details
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", sessionData.quiz_id)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);
    } catch (error: any) {
      toast({
        title: "Error loading quiz",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      navigate("/");
    }
  };

  const getClientIP = async () => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip;
    } catch (error) {
      // Fallback IP if service is unavailable
      return "unknown";
    }
  };

  const performSecurityChecks = async (ipAddress: string) => {
    const checks = {
      ipCheck: false,
      deviceCheck: false,
      emailCheck: false,
      timeCheck: false,
    };

    try {
      // 1. Check if IP has already participated
      const { data: ipPlayers } = await supabase
        .from("anytime_quiz_players")
        .select("*")
        .eq("session_id", sessionId)
        .eq("ip_address", ipAddress);

      if (ipPlayers && ipPlayers.length > 0) {
        checks.ipCheck = true;
      }

      // 2. Check if device fingerprint has been used
      const { data: devicePlayers } = await supabase
        .from("anytime_quiz_players")
        .select("*")
        .eq("session_id", sessionId)
        .like("player_name", `%${deviceFingerprint}%`);

      if (devicePlayers && devicePlayers.length > 0) {
        checks.deviceCheck = true;
      }

      // 3. Check if email domain is suspicious (common temp email domains)
      const suspiciousDomains = [
        "10minutemail.com",
        "tempmail.org",
        "guerrillamail.com",
        "mailinator.com",
        "yopmail.com",
        "temp-mail.org",
        "throwaway.email",
        "getnada.com",
        "maildrop.cc",
      ];
      const emailDomain = email.split("@")[1]?.toLowerCase();
      if (suspiciousDomains.includes(emailDomain)) {
        checks.emailCheck = true;
      }

      // 4. Check if multiple attempts from same IP in short time
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentAttempts } = await supabase
        .from("anytime_quiz_players")
        .select("*")
        .eq("session_id", sessionId)
        .eq("ip_address", ipAddress)
        .gte("created_at", oneHourAgo);

      if (recentAttempts && recentAttempts.length > 0) {
        checks.timeCheck = true;
      }
    } catch (error) {
      console.error("Security check error:", error);
    }

    setSecurityChecks(checks);
    return checks;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playerName.trim() || !email.trim() || !phone.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Check for obviously fake names
    const suspiciousNames = [
      "test",
      "fake",
      "dummy",
      "temp",
      "anonymous",
      "user",
      "player",
    ];
    if (
      suspiciousNames.some((name) => playerName.toLowerCase().includes(name))
    ) {
      toast({
        title: "Invalid name",
        description: "Please enter your real full name",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Get client IP address
      const ipAddress = await getClientIP();

      // Perform comprehensive security checks
      const securityResults = await performSecurityChecks(ipAddress);

      // Block if any security check fails
      if (securityResults.ipCheck) {
        toast({
          title: "Access Denied",
          description:
            "This network has already been used to take this quiz. Each quiz can only be taken once per network to ensure fairness.",
          variant: "destructive",
        });
        return;
      }

      if (securityResults.deviceCheck) {
        toast({
          title: "Access Denied",
          description: "This device has already been used for this quiz.",
          variant: "destructive",
        });
        return;
      }

      if (securityResults.emailCheck) {
        toast({
          title: "Invalid Email",
          description:
            "Please use a valid, permanent email address. Temporary email services are not allowed.",
          variant: "destructive",
        });
        return;
      }

      if (securityResults.timeCheck) {
        toast({
          title: "Too Many Attempts",
          description:
            "Multiple attempts detected from this network. Please wait before trying again.",
          variant: "destructive",
        });
        return;
      }

      // Add the player to the anytime quiz with enhanced tracking
      const { data, error } = await supabase
        .from("anytime_quiz_players")
        .insert({
          session_id: sessionId,
          player_name: `${playerName}_${deviceFingerprint}`, // Include device fingerprint
          email: email,
          phone: phone,
          ip_address: ipAddress,
        })
        .select();

      if (error) throw error;

      // Log the attempt for security monitoring
      await supabase.from("anytime_participants").insert({
        session_id: sessionId,
        player_name: playerName,
        email: email,
        phone: phone || null,
        ip_address: ipAddress,
      });

      // Navigate to the anytime quiz player screen
      navigate(`/anytime-quiz-play/${sessionId}/${data[0].id}`);
    } catch (error: any) {
      toast({
        title: "Error joining quiz",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#7C3AED] to-[#7C3AED] text-white flex items-center justify-center p-4">
      <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
        <Link to="/">
          <Logo className="h-12 w-auto ml-16" />
        </Link>
        <UserMenu />
      </div>
      <Card className="max-w-md w-full bg-white/10 backdrop-blur-md border-white/20 shadow-xl">
        <div className="flex justify-center items-center mb-4 mt-4">
          <Logo className="bg-white/20 backdrop-blur-md p-1 rounded" />
        </div>
        <CardHeader className="text-center">
          <CardTitle className="text-3xl text-white font-bold">
            Join Quiz
          </CardTitle>
          {quiz && <p className="text-white/80 text-lg">{quiz.title}</p>}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="playerName"
                className="block text-sm text-white font-medium"
              >
                Full Name *
              </label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your full name"
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-purple-500 focus:border-purple-500 text-lg h-14"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm text-white font-medium"
              >
                Email Address *
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-purple-500 focus:border-purple-500 text-lg h-14"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="phone"
                className="block text-sm text-white font-medium"
              >
                Phone Number *
              </label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-purple-500 focus:border-purple-500 text-lg h-14"
                required
              />
            </div>

            {/* Security Notice */}
            <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-red-300 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-100">
                  <div className="font-semibold mb-2">
                    Anti-Cheating Measures Active
                  </div>
                  <ul className="space-y-1 text-xs">
                    <li>• IP address and device fingerprinting enabled</li>
                    <li>• Only one attempt per network/device allowed</li>
                    <li>• Temporary email addresses are blocked</li>
                    <li>• Real names required - fake names will be rejected</li>
                    <li>• All attempts are logged and monitored</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="text-xs text-white/70 bg-white/10 p-3 rounded-lg">
              <p className="mb-1">
                • This quiz can only be taken once per network/device
              </p>
              <p className="mb-1">
                • Your information will be verified for authenticity
              </p>
              <p>• All fields marked with * are required</p>
            </div>

            <Button
              type="submit"
              className="w-full bg-white text-purple-700 hover:bg-white/90 text-lg py-6 h-auto gap-2"
              disabled={loading}
            >
              {loading ? "Joining..." : "Start Quiz"}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnytimeQuizJoin;
