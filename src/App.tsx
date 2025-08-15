import { Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useRoutes } from "react-router-dom";
import LoginForm from "./components/auth/LoginForm";
import SignUpForm from "./components/auth/SignUpForm";
import ForgotPassword from "./components/auth/ForgotPassword";
import ResetPassword from "./components/auth/ResetPassword";
import Success from "./components/pages/success";
import Home from "./components/pages/home";
import Dashboard from "./components/pages/dashboard";
import Profile from "./components/pages/profile";
import Settings from "./components/pages/settings";
import ContactUs from "./components/pages/ContactUs";
import Pricing from "./components/pages/pricing";
import CreateQuiz from "./components/quiz/CreateQuiz";
import HostQuiz from "./components/quiz/HostQuiz";
import JoinGame from "./components/quiz/JoinGame";
import LiveQuizGamePlay from "./components/quiz/LiveQuizGamePlay";
import PlayerGame from "./components/quiz/PlayerGame";
import GameLobby from "./components/quiz/GameLobby";
import PollGamePlay from "./components/quiz/PollGamePlay";
import AnytimeQuizJoin from "./components/quiz/AnytimeQuizJoin";
import AnytimeQuizPlayerGame from "./components/quiz/AnytimeQuizPlayerGame";
import AnytimeQuizGamePlay from "./components/quiz/AnytimeQuizGamePlay";
import LiveQuizPlayerGame from "./components/quiz/LiveQuizPlayerGame";
import PollPlayerGame from "./components/quiz/PollPlayerGame";
import PollPlayersMonitor from "./components/quiz/PollPlayersMonitor";
import AdminApproval from "./components/admin/AdminApproval";
import Messages from "./components/pages/messages";
import { AuthProvider, useAuth } from "./components/auth/VercelAuthProvider";
import { Toaster } from "./components/ui/toaster";
import { LoadingScreen, LoadingSpinner } from "./components/ui/loading-spinner";
import { keepDatabaseActive } from "./utils/keepAlive";

// Import tempo routes for storyboard support
let routes: any[] = [];
if (import.meta.env.VITE_TEMPO) {
  try {
    routes = require("tempo-routes").default || [];
  } catch (e) {
    // Tempo routes not available
  }
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isApproved } = useAuth();

  if (loading) {
    return <LoadingScreen text="Authenticating..." />;
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-8 max-w-md mx-auto text-center border border-white/30">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Account Pending Approval
          </h2>
          <p className="text-gray-600 mb-6">
            Your account is currently under review. You will receive access once
            approved by an administrator.
          </p>
          <button
            onClick={() => (window.location.href = "/login")}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full hover:from-purple-700 hover:to-pink-700 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, isSuperAdmin, isApproved } = useAuth();

  if (loading) {
    return <LoadingScreen text="Authenticating..." />;
  }

  if (!user || !isApproved || (!isAdmin && !isSuperAdmin)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      {/* Tempo routes for storyboards */}
      {import.meta.env.VITE_TEMPO && useRoutes(routes)}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/signup" element={<SignUpForm />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/success" element={<Success />} />
        <Route
          path="/results"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* User Account Routes */}
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />

        {/* Quiz Creator Routes */}
        <Route
          path="/create"
          element={
            <PrivateRoute>
              <CreateQuiz />
            </PrivateRoute>
          }
        />
        <Route
          path="/edit/:quizId"
          element={
            <PrivateRoute>
              <CreateQuiz />
            </PrivateRoute>
          }
        />
        <Route
          path="/host"
          element={
            <PrivateRoute>
              <HostQuiz />
            </PrivateRoute>
          }
        />
        <Route
          path="/game/:sessionId"
          element={
            <PrivateRoute>
              <GameLobby />
            </PrivateRoute>
          }
        />
        <Route
          path="/game/:sessionId/play"
          element={
            <PrivateRoute>
              <LiveQuizGamePlay />
            </PrivateRoute>
          }
        />

        {/* Player Routes */}
        <Route path="/join" element={<JoinGame />} />
        <Route path="/play/:sessionId/:playerId" element={<PlayerGame />} />

        {/* Poll Routes */}
        <Route
          path="/poll/:sessionId"
          element={
            <PrivateRoute>
              <PollGamePlay />
            </PrivateRoute>
          }
        />
        <Route
          path="/poll-play/:sessionId/:playerId"
          element={<PollPlayerGame />}
        />
        <Route
          path="/poll-monitor/:sessionId"
          element={
            <PrivateRoute>
              <PollPlayersMonitor />
            </PrivateRoute>
          }
        />

        {/* Anytime Quiz Routes */}
        <Route
          path="/anytime-quiz/:sessionId"
          element={
            <PrivateRoute>
              <AnytimeQuizGamePlay />
            </PrivateRoute>
          }
        />
        <Route
          path="/anytime-quiz-join/:sessionId"
          element={<AnytimeQuizJoin />}
        />
        <Route
          path="/anytime-quiz-play/:sessionId/:playerId"
          element={<AnytimeQuizPlayerGame />}
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminApproval />
            </AdminRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <AdminRoute>
              <Messages />
            </AdminRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  // Initialize the keep-alive mechanism when the app starts
  useEffect(() => {
    const cleanup = keepDatabaseActive();
    return () => cleanup();
  }, []);

  return (
    <AuthProvider>
      <Suspense fallback={<LoadingScreen text="Loading application..." />}>
        <AppRoutes />
      </Suspense>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
