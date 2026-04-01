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

    // Override the SSR-rendered inline backgroundColor on <html> (inline styles beat CSS classes)
    document.documentElement.style.backgroundColor = xMode ? "#0D0A1A" : "#0A1A0A";

    // Update browser chrome / address bar color
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = xMode ? "#0D0A1A" : "#0A1A0A";
  }, [xMode]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-start">
      <div className="flex items-start justify-center w-full">
        <Game xMode={xMode} setXMode={setXMode} />
      </div>
    </main>
  );
}
