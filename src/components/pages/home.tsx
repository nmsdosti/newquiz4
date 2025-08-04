import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/VercelAuthProvider";
import UserMenu from "@/components/ui/user-menu";
import Logo from "@/components/ui/logo";

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="w-full bg-white/80 backdrop-blur-md flex justify-between items-center px-4 sm:px-6 lg:px-8 py-4 shadow-sm fixed top-0 left-0 right-0 z-50">
        <Logo className="" />
        <div className="hidden md:flex items-center space-x-8">
          <Link
            to="/"
            className="text-gray-700 hover:text-purple-600 font-medium transition-colors"
          >
            Home
          </Link>
          <Link
            to="/pricing"
            className="text-gray-700 hover:text-purple-600 font-medium transition-colors"
          >
            Pricing
          </Link>
          <Link
            to="/contact"
            className="text-gray-700 hover:text-purple-600 font-medium transition-colors"
          >
            Contact
          </Link>
        </div>
        <UserMenu />
      </nav>

      {/* Hero Section */}
      <main className="pt-20 pb-16 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            {/* Left Side: Content */}
            <div className="flex-1 text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Interactive Quiz
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                  Platform
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Create engaging quizzes, host live sessions, and connect with
                participants worldwide. Transform learning into an interactive
                experience.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
                <Link to={user ? "/create" : "/signup"}>
                  <Button className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg transition-all duration-300 transform hover:scale-105">
                    Get Started
                  </Button>
                </Link>
                <Link to="/join">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-2 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white px-8 py-3 rounded-full text-lg font-semibold transition-all duration-300"
                  >
                    Join Quiz
                  </Button>
                </Link>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto lg:mx-0">
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200 shadow-sm">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                    <span className="text-white text-xl">⚡</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Live Quizzes
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Real-time interactive sessions
                  </p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200 shadow-sm">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4">
                    <span className="text-white text-xl">📊</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Analytics
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Instant results & insights
                  </p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200 shadow-sm">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl flex items-center justify-center mb-4">
                    <span className="text-white text-xl">🎨</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Customizable
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Personalize your experience
                  </p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200 shadow-sm">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                    <span className="text-white text-xl">🌐</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Global Access
                  </h3>
                  <p className="text-gray-600 text-sm">Join from anywhere</p>
                </div>
              </div>
            </div>

            {/* Right Side: Illustration */}
            <div className="flex-1 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-lg">
                {/* Main Dashboard Mockup */}
                <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-8 h-8 bg-white/20 rounded-lg"></div>
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                        <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                        <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-4 bg-white/20 rounded w-3/4"></div>
                      <div className="h-4 bg-white/20 rounded w-1/2"></div>
                    </div>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-yellow-100 rounded-xl p-4">
                      <div className="w-8 h-8 bg-yellow-500 rounded-lg mb-2"></div>
                      <div className="h-3 bg-yellow-300 rounded w-full mb-1"></div>
                      <div className="h-3 bg-yellow-300 rounded w-2/3"></div>
                    </div>
                    <div className="bg-green-100 rounded-xl p-4">
                      <div className="w-8 h-8 bg-green-500 rounded-lg mb-2"></div>
                      <div className="h-3 bg-green-300 rounded w-full mb-1"></div>
                      <div className="h-3 bg-green-300 rounded w-2/3"></div>
                    </div>
                    <div className="bg-blue-100 rounded-xl p-4">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg mb-2"></div>
                      <div className="h-3 bg-blue-300 rounded w-full mb-1"></div>
                      <div className="h-3 bg-blue-300 rounded w-2/3"></div>
                    </div>
                    <div className="bg-pink-100 rounded-xl p-4">
                      <div className="w-8 h-8 bg-pink-500 rounded-lg mb-2"></div>
                      <div className="h-3 bg-pink-300 rounded w-full mb-1"></div>
                      <div className="h-3 bg-pink-300 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl shadow-lg flex items-center justify-center">
                  <span className="text-white text-2xl">📈</span>
                </div>
                <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-xl shadow-lg flex items-center justify-center">
                  <span className="text-white text-lg">🎯</span>
                </div>
                <div className="absolute top-1/2 -left-8 w-10 h-10 bg-gradient-to-r from-green-400 to-teal-400 rounded-lg shadow-lg flex items-center justify-center">
                  <span className="text-white text-sm">✨</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-purple-600 to-pink-600 py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Transform Learning?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join thousands of educators and learners worldwide
          </p>
          {!user && (
            <Link to="/signup">
              <Button className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-3 rounded-full text-lg font-semibold shadow-lg transition-all duration-300 transform hover:scale-105">
                Get Started Free
              </Button>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
