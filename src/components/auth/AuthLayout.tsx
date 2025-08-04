import { ReactNode } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 text-white">
      {/* Modern navigation */}
      <header className="fixed top-0 z-50 w-full bg-white backdrop-blur-md shadow-md border-b border-skyblue/30">
        <div className="max-w-[980px] mx-4 sm:mx-16 flex h-16 sm:h-20 items-center justify-left px-4">
          <div>
            <Logo className="bg-white/20 backdrop-blur-md p-1 rounded h-8 sm:h-auto" />
          </div>
        </div>
      </header>

      <div className="min-h-screen flex items-center justify-center sm:justify-left pt-20 sm:pt-14 px-4">
        <div className="max-w-md w-full sm:ml-16">
          <div className="text-center sm:text-left mb-6 sm:mb-8">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
              Newquiz.online
            </h2>
            <p className="text-lg sm:text-xl font-medium text-white mt-2">
              Where Possibility Meets Learning
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
