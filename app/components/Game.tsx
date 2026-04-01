"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ref,
  push,
  onValue,
  runTransaction,
  type DatabaseReference,
} from "firebase/database";
import { getFirebaseDb, LEADERBOARD_PATH, UNIQUE_LEADERBOARD_PATH, X_LEADERBOARD_PATH, X_UNIQUE_LEADERBOARD_PATH } from "../lib/firebase";
import GameCanvas from "./GameCanvas";

/* ── helpers ──────────────────────────────────────────── */
function sanitize(v: string) {
  return v.replace(/[^\w -]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
}

function uniqueKey(name: string) {
  return name.toLowerCase().replace(/[.$#[\]/]/g, "_");
}

interface Entry {
  username: string;
  score: number;
  timestamp: number;
}

/* ── component ────────────────────────────────────────── */
export default function Game({ xMode, setXMode }: { xMode: boolean; setXMode: (v: boolean | ((p: boolean) => boolean)) => void }) {
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("customFlappyUsername") || "";
  });
  const [inputVal, setInputVal] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("customFlappyUsername") || "";
  });
  const [status, setStatus] = useState("Set your username to start.");
  const [statusError, setStatusError] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Entry[]>([]);
  const [personalBest, setPersonalBest] = useState<Entry[]>([]);
  const readyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lbRef = useRef<DatabaseReference | null>(null);
  const ubRef = useRef<DatabaseReference | null>(null);

  /* ── init firebase + realtime listeners ─────────────── */
  useEffect(() => {
    // Clear stale data when switching modes (deferred to avoid synchronous setState-in-effect lint rule)
    const clearTimer = setTimeout(() => {
      setLeaderboard([]);
      setPersonalBest([]);
    }, 0);
    try {
      const db = getFirebaseDb();
      lbRef.current = ref(db, xMode ? X_LEADERBOARD_PATH : LEADERBOARD_PATH);
      ubRef.current = ref(db, xMode ? X_UNIQUE_LEADERBOARD_PATH : UNIQUE_LEADERBOARD_PATH);
      readyRef.current = true;
    } catch {
      return;
    }

    const unsubs: (() => void)[] = [];

    if (lbRef.current) {
      unsubs.push(
        onValue(
          lbRef.current,
          (snap) => {
            const entries: Entry[] = [];
            snap.forEach((child) => {
              const v = child.val();
              if (typeof v?.username === "string" && typeof v?.score === "number") {
                entries.push({ username: sanitize(v.username) || "Anonymous", score: v.score, timestamp: Number(v.timestamp || 0) });
              }
            });
            entries.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
            setLeaderboard(entries.slice(0, 10));
          },
          () => setStatusError(true),
        ),
      );
    }

    if (ubRef.current) {
      unsubs.push(
        onValue(
          ubRef.current,
          (snap) => {
            const entries: Entry[] = [];
            snap.forEach((child) => {
              const v = child.val();
              if (typeof v?.username === "string" && typeof v?.score === "number") {
                entries.push({ username: sanitize(v.username) || "Anonymous", score: v.score, timestamp: Number(v.timestamp || 0) });
              }
            });
            entries.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
            setPersonalBest(entries);
          },
          () => {},
        ),
      );
    }

    return () => { clearTimeout(clearTimer); unsubs.forEach((u) => u()); };
  }, [xMode]);

  /* ── save username ──────────────────────────────────── */
  const saveUsername = useCallback((raw: string) => {
    const name = sanitize(raw);
    if (!name) {
      setStatus("Enter a username with letters or numbers.");
      setStatusError(true);
      return;
    }
    setPlayerName(name);
    setInputVal(name);
    localStorage.setItem("customFlappyUsername", name);
    setStatus(readyRef.current ? "Username saved — your next game hits the leaderboard." : "Username saved.");
    setStatusError(false);
  }, []);

  /* ── submit score ───────────────────────────────────── */
  const submitScore = useCallback(
    (score: number) => {
      if (!readyRef.current || !playerName || score <= 0) return;
      if (lbRef.current) {
        push(lbRef.current, { username: playerName, score, timestamp: Date.now() }).catch(() => {});
      }
      if (ubRef.current) {
        const key = uniqueKey(playerName);
        const ubPath = xMode ? X_UNIQUE_LEADERBOARD_PATH : UNIQUE_LEADERBOARD_PATH;
        const childRef = ref(getFirebaseDb(), `${ubPath}/${key}`);
        runTransaction(childRef, (cur) => {
          if (!cur || typeof cur.score !== "number" || score > cur.score) {
            return { username: playerName, score, timestamp: Date.now() };
          }
          return cur;
        }).catch(() => {});
      }
    },
    [playerName, xMode],
  );

  const onRequestUsername = useCallback(() => {
    inputRef.current?.focus();
    setStatus("Choose a username before you start.");
    setStatusError(true);
  }, []);

  /* ── render ─────────────────────────────────────────── */
  const x = xMode; // shorthand
  return (
    <div className="w-full max-w-[1040px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-5 lg:gap-8 items-start justify-center px-4 py-5 lg:py-8">
      {/* Game Column */}
      <div className="flex flex-col items-center gap-3 justify-self-center">
        <GameCanvas
          playerName={playerName}
          onRequestUsername={onRequestUsername}
          onScoreSubmit={submitScore}
          xMode={xMode}
        />
        <div className={`flex items-center gap-2 text-[13px] font-medium flex-wrap justify-center ${x ? "text-purple-300/50" : "text-green-200/50"}`}>
          <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${x ? "bg-purple-400/10" : "bg-green-200/10"}`}>SPACE</kbd>
          <span className={x ? "text-purple-300/25" : "text-green-200/25"}>/</span>
          <span>Click</span>
          <span className={x ? "text-purple-300/25" : "text-green-200/25"}>/</span>
          <span>Tap</span>
          <span className={`mx-0.5 ${x ? "text-purple-300/15" : "text-green-200/15"}`}>·</span>
          {playerName ? (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${x ? "text-purple-300/40" : "text-green-200/40"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${x ? "bg-purple-400" : "bg-green-400"}`} />
              {playerName}
            </span>
          ) : (
            <span className={`text-xs font-medium ${x ? "text-purple-300/30" : "text-green-200/30"}`}>Enter a name to play</span>
          )}
        </div>
      </div>

      {/* Side Panel */}
      <aside className="flex flex-col gap-3 w-full max-w-[400px] justify-self-center lg:justify-self-start">
        {/* Username */}
        <section className={`rounded-2xl p-4 transition-colors duration-300 ${
          x ? "bg-[#1A0F2E]/80 border border-purple-500/20" : "bg-[#1A2E15]/80 border border-[#5BA829]/20"
        }`}>
          <p className={`text-[13px] font-semibold mb-3 ${x ? "text-purple-200/70" : "text-green-200/70"}`}>Username</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); saveUsername(inputVal); }}
          >
            <input
              ref={inputRef}
              type="text"
              maxLength={18}
              placeholder="Your name..."
              autoComplete="nickname"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className={`flex-1 min-w-0 h-9 px-3 rounded-lg text-sm focus:outline-none focus:ring-1 transition-all ${
                x
                  ? "bg-[#120A20]/80 border border-purple-500/25 text-purple-100 placeholder:text-purple-200/25 focus:ring-purple-400/40"
                  : "bg-[#0F1F0F]/80 border border-[#5BA829]/25 text-green-100 placeholder:text-green-200/25 focus:ring-green-400/40"
              }`}
            />
            <button
              type="submit"
              className={`h-9 px-4 rounded-lg text-white text-[13px] font-bold active:scale-[0.97] transition-all cursor-pointer ${
                x ? "bg-purple-600 hover:bg-purple-500" : "bg-[#5BA829] hover:bg-[#6BCB32]"
              }`}
            >
              Save
            </button>
          </form>
          <p className={`mt-2 text-[11px] font-medium min-h-[16px] ${statusError ? "text-red-400/80" : x ? "text-purple-400/60" : "text-green-400/60"}`}>
            {status}
          </p>
        </section>

        {/* X Mode Toggle */}
        <button
          onClick={() => setXMode((v) => !v)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[13px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer select-none ${
            x
              ? "bg-[#1A0F2E]/80 border border-purple-500/30 text-purple-300 shadow-[0_0_16px_rgba(168,85,247,0.15)]"
              : "bg-[#1A2E15]/80 border border-[#5BA829]/20 text-green-200/40 hover:text-green-200/60 hover:border-[#5BA829]/35"
          }`}
        >
          <span className="flex items-center gap-2.5">
            <span className={`relative w-9 h-5 rounded-full transition-colors duration-300 flex-shrink-0 ${
              x ? "bg-purple-500" : "bg-green-200/15"
            }`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 ${
                x ? "left-[18px] bg-white shadow-[0_0_8px_rgba(168,85,247,0.7)]" : "left-0.5 bg-green-200/40"
              }`} />
            </span>
            <span>X Mode</span>
          </span>
          {x && (
            <span className="flex items-center gap-2 text-[11px] tracking-widest">
              <span className="animate-pulse">⚡</span>
              <span className="text-purple-400/60">ACTIVE</span>
              <span className="animate-pulse">⚡</span>
            </span>
          )}
        </button>

        {/* Leaderboard */}
        <LeaderboardCard leaderboard={leaderboard} personalBest={personalBest} xMode={xMode} />
      </aside>
    </div>
  );
}

/* ── Leaderboard Card with Tabs ───────────────────────── */
function LeaderboardCard({ leaderboard, personalBest, xMode }: { leaderboard: Entry[]; personalBest: Entry[]; xMode: boolean }) {
  const [tab, setTab] = useState<"top" | "best">("top");
  const entries = tab === "top" ? leaderboard : personalBest;
  const x = xMode;

  return (
    <section className={`rounded-2xl p-4 transition-colors duration-300 ${
      x ? "bg-[#1A0F2E]/80 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.08)]" : "bg-[#1A2E15]/80 border border-[#5BA829]/20"
    }`}>
      {x ? (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-purple-300/80">X Mode Rankings</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-purple-500/50 border border-purple-500/20 rounded px-1.5 py-0.5">Separate</span>
        </div>
      ) : (
        <p className="text-[13px] font-semibold text-green-200/70 mb-3">Leaderboard</p>
      )}
      <div className={`flex gap-0.5 p-0.5 rounded-lg mb-3 ${x ? "bg-[#120A20]/60" : "bg-[#0F1F0F]/60"}`}>
        {(["top", "best"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              tab === t
                ? x ? "bg-purple-600 text-white" : "bg-[#5BA829] text-white"
                : x ? "text-purple-200/35 hover:text-purple-200/50" : "text-green-200/35 hover:text-green-200/50"
            }`}
          >
            {t === "top" ? "Top Scores" : "Personal Best"}
          </button>
        ))}
      </div>
      <LeaderboardList entries={entries} empty={tab === "top" ? "No scores yet" : "No bests yet"} xMode={xMode} />
    </section>
  );
}

/* ── Leaderboard List ─────────────────────────────────── */
function LeaderboardList({ entries, empty, xMode }: { entries: Entry[]; empty: string; xMode: boolean }) {
  const x = xMode;
  if (!entries.length) {
    return <p className={`text-[13px] text-center py-4 ${x ? "text-purple-200/20" : "text-green-200/20"}`}>{empty}</p>;
  }
  return (
    <ol className="space-y-1">
      {entries.map((e, i) => (
        <li
          key={`${e.username}-${e.score}-${i}`}
          className={`flex items-center justify-between text-[13px] font-semibold rounded-lg px-3 py-2 ${
            x
              ? i === 0
                ? "bg-purple-400/15 text-purple-200"
                : i === 1
                  ? "bg-purple-300/8 text-purple-300/80"
                  : i === 2
                    ? "bg-purple-400/6 text-purple-300/60"
                    : "bg-purple-200/[0.04] text-purple-100/50"
              : i === 0
                ? "bg-yellow-400/10 text-yellow-200"
                : i === 1
                  ? "bg-gray-300/8 text-gray-300"
                  : i === 2
                    ? "bg-amber-600/8 text-amber-300"
                    : "bg-green-200/[0.04] text-green-100/50"
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className={`w-5 text-center text-[11px] font-bold ${
              x
                ? i === 0 ? "text-purple-300" : i === 1 ? "text-purple-400/70" : i === 2 ? "text-purple-500/60" : "text-purple-200/20"
                : i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-500" : "text-green-200/20"
            }`}>
              {i + 1}
            </span>
            <span className="truncate">{e.username}</span>
          </span>
          <span className={`font-bold tabular-nums ml-3 ${x ? "text-purple-400/90" : "text-green-400/90"}`}>{e.score}</span>
        </li>
      ))}
    </ol>
  );
}
