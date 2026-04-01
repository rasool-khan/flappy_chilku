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
    document.documentElement.classList.toggle("x-mode", xMode);
    document.body.classList.toggle("x-mode", xMode);
  }, [xMode]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-start">
      <div className="flex items-start justify-center w-full">
        <Game xMode={xMode} setXMode={setXMode} />
      </div>
    </main>
  );
}
