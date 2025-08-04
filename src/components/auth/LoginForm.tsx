import { useState } from "react";
import { useAuth } from "../auth/VercelAuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    try {
      const result = await signIn(email, password);
      if (result?.session) {
        navigate("/");
      } else if (result?.error?.message === "Account pending approval") {
        setError(
          "Your account is pending approval. Please wait for admin approval.",
        );
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.message === "Account pending approval") {
        setError(
          "Your account is pending approval. Please wait for admin approval.",
        );
      } else {
        setError(error.message || "Invalid email or password");
      }
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-4 sm:p-8 w-full max-w-md mx-auto border border-skyblue/30">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-navy">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 sm:h-12 rounded-lg border-skyblue focus:ring-coral focus:border-coral bg-white/80 text-black text-sm sm:text-base"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-navy"
              >
                Password
              </Label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-coral hover:text-coral/80"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 sm:h-12 rounded-lg border-skyblue focus:ring-coral focus:border-coral bg-white/80 text-black text-sm sm:text-base"
            />
          </div>
          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
          <Button
            type="submit"
            className="w-full h-10 sm:h-12 rounded-full bg-coral text-white hover:bg-coral/90 text-sm sm:text-base font-medium transition-colors"
          >
            Sign in to Newquiz.online
          </Button>

          <div className="text-sm text-center text-navy mt-6">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-purple-600 hover:text-purple-700 font-medium transition-colors"
            >
              Create account
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
