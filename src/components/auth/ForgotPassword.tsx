import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
      toast({
        title: "Password reset email sent",
        description: "Check your email for the password reset link",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-8 w-full max-w-md mx-auto border border-skyblue/30">
        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-navy">
                Reset your password
              </h2>
              <p className="text-sm text-navy/70 mt-2">
                Enter your email address and we'll send you a link to reset your
                password.
              </p>
            </div>

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
                className="h-12 rounded-lg border-skyblue focus:ring-coral focus:border-coral bg-white/80 text-black"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 text-sm font-medium transition-colors"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            <div className="text-sm text-center text-navy mt-6">
              Remember your password?{" "}
              <Link
                to="/login"
                className="text-coral hover:text-coral/80 font-medium transition-colors"
              >
                Back to login
              </Link>
            </div>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-navy">Check your email</h3>
            <p className="text-navy/70">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="w-full h-12 rounded-full bg-coral text-white hover:bg-coral/90 text-sm font-medium transition-colors"
            >
              Back to Login
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
