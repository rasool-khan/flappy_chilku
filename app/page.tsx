"use client";

import { useState, useEffect } from "react";
import Game from "./components/Game";

export default function Home() {
  const [xMode, setXMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("flappyXMode") === "true";
  });

  useEffect(() => {
    localStorage.setItem("flappyXMode", String(xMode));
  }, [xMode]);

  return (
    <main className={`min-h-dvh flex flex-col items-center justify-start transition-colors duration-500 ${xMode ? "bg-[#0D0A1A]" : ""}`}>
      {/* X Mode Toggle */}
      <div className="w-full max-w-[1040px] px-4 pt-4 flex justify-end">
        <button
          onClick={() => setXMode((v) => !v)}
          className={`group relative flex items-center gap-2.5 px-4 py-2 rounded-xl text-[13px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer select-none ${
            xMode
              ? "bg-purple-500/20 border border-purple-400/40 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.25)]"
              : "bg-green-200/5 border border-green-200/10 text-green-200/40 hover:text-green-200/60 hover:border-green-200/20"
          }`}
        >
          {/* Toggle track */}
          <span className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${xMode ? "bg-purple-500" : "bg-green-200/15"}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 ${
              xMode ? "left-[18px] bg-white shadow-[0_0_8px_rgba(168,85,247,0.6)]" : "left-0.5 bg-green-200/40"
            }`} />
          </span>
          <span className="flex items-center gap-1.5">
            {xMode && <span className="text-[15px] animate-pulse">⚡</span>}
            X Mode
          </span>
        </button>
      </div>
      <div className="flex items-start justify-center w-full">
        <Game xMode={xMode} />
      </div>
    </main>
  );
}
