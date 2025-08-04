import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import UserMenu from "@/components/ui/user-menu";
import Logo from "@/components/ui/logo";

export default function PricingPage() {
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
          <Link to="/pricing" className="text-purple-600 font-medium">
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

      {/* Pricing Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Choose Your
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                Perfect Plan
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Unlock unlimited quiz creation and hosting with our flexible
              pricing options
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Monthly Plan */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-gray-200 p-8 text-center hover:border-purple-400 transition-all duration-300 hover:shadow-xl">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl">📅</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Monthly</h3>
              <div className="text-4xl font-bold text-purple-600 mb-6">
                ₹49
                <span className="text-lg text-gray-500 font-normal">
                  /month
                </span>
              </div>
              <ul className="text-left space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">Unlimited quiz creation</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">Unlimited participants</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">Real-time analytics</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">24/7 support</span>
                </li>
              </ul>
              <Link to="/contact">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-full text-lg font-semibold transition-all duration-300">
                  Contact Us
                </Button>
              </Link>
            </div>

            {/* Yearly Plan - Featured */}
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl border-2 border-purple-400 p-8 text-center relative transform scale-105 shadow-2xl">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl">🎯</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Yearly</h3>
              <div className="text-4xl font-bold text-purple-600 mb-2">
                ₹499
                <span className="text-lg text-gray-500 font-normal">/year</span>
              </div>
              <div className="text-sm text-green-600 font-semibold mb-6">
                Save ₹89 (15% off)
              </div>
              <ul className="text-left space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">Everything in Monthly</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">Priority support</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">Advanced analytics</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">Custom branding</span>
                </li>
              </ul>
              <Link to="/contact">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-full text-lg font-semibold transition-all duration-300 shadow-lg">
                  Contact Us
                </Button>
              </Link>
            </div>

            {/* Custom Website Plan */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-gray-200 p-8 text-center hover:border-purple-400 transition-all duration-300 hover:shadow-xl">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl">🌐</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Custom Website
              </h3>
              <div className="text-4xl font-bold text-purple-600 mb-2">
                ₹899
                <span className="text-lg text-gray-500 font-normal">/year</span>
              </div>
              <div className="text-sm text-gray-500 mb-6">+ Domain charges</div>
              <ul className="text-left space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">Your own domain</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">Custom logo & branding</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">White-label solution</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-gray-700">Dedicated support</span>
                </li>
              </ul>
              <Link to="/contact">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-full text-lg font-semibold transition-all duration-300">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>

          <div className="text-center mt-16">
            <p className="text-gray-600 mb-4 text-lg">
              All plans include unlimited quiz creation and hosting
            </p>
            <p className="text-gray-500">
              Need help choosing?{" "}
              <Link
                to="/contact"
                className="text-purple-600 hover:underline font-medium"
              >
                Contact our team
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white/50 backdrop-blur-sm py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-8">
            <div className="bg-white/80 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Can I change my plan anytime?
              </h3>
              <p className="text-gray-600">
                Yes, you can upgrade or downgrade your plan at any time. Changes
                will be reflected in your next billing cycle.
              </p>
            </div>
            <div className="bg-white/80 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Is there a free trial available?
              </h3>
              <p className="text-gray-600">
                We offer a free tier with limited features. Contact us to
                discuss trial options for premium plans.
              </p>
            </div>
            <div className="bg-white/80 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards, debit cards, and digital
                payment methods including UPI and net banking.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
