import { useState } from "react";
import { useAuth } from "../auth/VercelAuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { useToast } from "@/components/ui/use-toast";

export default function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !fullName) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      const result = await signUp(email, password, fullName);
      if (result?.user) {
        toast({
          title: "Account created successfully",
          description:
            "Your account is pending approval. You will be notified once approved.",
          duration: 8000,
        });
        navigate("/login");
      } else {
        setError("Failed to create account. Please try again.");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      setError(error.message || "Error creating account");
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-4 sm:p-8 w-full max-w-md mx-auto border border-skyblue/30">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium text-navy">
              Full Name
            </Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-10 sm:h-12 rounded-lg border-skyblue focus:ring-coral focus:border-coral bg-white/80 text-black text-sm sm:text-base"
            />
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
              className="h-10 sm:h-12 rounded-lg border-skyblue focus:ring-coral focus:border-coral bg-white/80 text-black text-sm sm:text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-navy">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 sm:h-12 rounded-lg border-skyblue focus:ring-coral focus:border-coral bg-white/80 text-black text-sm sm:text-base"
            />
            <p className="text-xs text-navy/70 mt-1">
              Password must be at least 6 characters
            </p>
          </div>
          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <Button
            type="submit"
            className="w-full h-10 sm:h-12 rounded-full bg-coral text-white hover:bg-coral/90 text-sm sm:text-base font-medium transition-colors"
          >
            Join Newquiz.online
          </Button>

          <div className="text-xs text-center text-navy/70 mt-6">
            By creating an account, you agree to our{" "}
            <Link to="/" className="text-coral hover:text-coral/80">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/" className="text-coral hover:text-coral/80">
              Privacy Policy
            </Link>
          </div>

          <div className="text-sm text-center text-navy mt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-purple-600 hover:text-purple-700 font-medium transition-colors"
            >
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
