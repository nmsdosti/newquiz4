import React from "react";

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="relative">
      <div
        className={`${sizeClasses[size]} rounded-full border-4 border-gray-100 border-t-[#46178F] animate-spin`}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-[#46178F]/20 animate-pulse" />
      </div>
    </div>
  );
}

export function LoadingScreen({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-gray-600 font-medium">{text}</p>
    </div>
  );
}
