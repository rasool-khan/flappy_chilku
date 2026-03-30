"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ref,
  push,
  onValue,
  runTransaction,
  type DatabaseReference,
} from "firebase/database";
import { getFirebaseDb, LEADERBOARD_PATH, UNIQUE_LEADERBOARD_PATH } from "../lib/firebase";
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
export default function Game() {
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
    try {
      const db = getFirebaseDb();
      lbRef.current = ref(db, LEADERBOARD_PATH);
      ubRef.current = ref(db, UNIQUE_LEADERBOARD_PATH);
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
            setPersonalBest(entries.slice(0, 10));
          },
          () => {},
        ),
      );
    }

    return () => unsubs.forEach((u) => u());
  }, []);

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
        const childRef = ref(getFirebaseDb(), `${UNIQUE_LEADERBOARD_PATH}/${key}`);
        runTransaction(childRef, (cur) => {
          if (!cur || typeof cur.score !== "number" || score > cur.score) {
            return { username: playerName, score, timestamp: Date.now() };
          }
          return cur;
        }).catch(() => {});
      }
    },
    [playerName],
  );

  const onRequestUsername = useCallback(() => {
    inputRef.current?.focus();
    setStatus("Choose a username before you start.");
    setStatusError(true);
  }, []);

  /* ── render ─────────────────────────────────────────── */
  return (
    <div className="w-full max-w-[1040px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-5 lg:gap-8 items-start justify-center px-4 py-5 lg:py-8">
      {/* Game Column */}
      <div className="flex flex-col items-center gap-3 justify-self-center">
        <GameCanvas
          playerName={playerName}
          onRequestUsername={onRequestUsername}
          onScoreSubmit={submitScore}
        />
        <div className="flex items-center gap-2 text-green-200/50 text-[13px] font-medium flex-wrap justify-center">
          <kbd className="px-1.5 py-0.5 rounded bg-green-200/10 text-[10px] font-bold">SPACE</kbd>
          <span className="text-green-200/25">/</span>
          <span>Click</span>
          <span className="text-green-200/25">/</span>
          <span>Tap</span>
          <span className="text-green-200/15 mx-0.5">·</span>
          {playerName ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-green-200/40 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              {playerName}
            </span>
          ) : (
            <span className="text-xs text-green-200/30 font-medium">Enter a name to play</span>
          )}
        </div>
      </div>

      {/* Side Panel */}
      <aside className="flex flex-col gap-3 w-full max-w-[400px] justify-self-center lg:justify-self-start">
        {/* Username */}
        <section className="rounded-2xl bg-[#1A2E15]/80 border border-[#5BA829]/20 p-4">
          <p className="text-[13px] font-semibold text-green-200/70 mb-3">Username</p>
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
              className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[#0F1F0F]/80 border border-[#5BA829]/25 text-green-100 text-sm placeholder:text-green-200/25 focus:outline-none focus:ring-1 focus:ring-green-400/40 transition-all"
            />
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-[#5BA829] text-white text-[13px] font-bold hover:bg-[#6BCB32] active:scale-[0.97] transition-all cursor-pointer"
            >
              Save
            </button>
          </form>
          <p className={`mt-2 text-[11px] font-medium min-h-[16px] ${statusError ? "text-red-400/80" : "text-green-400/60"}`}>
            {status}
          </p>
        </section>

        {/* Leaderboard */}
        <LeaderboardCard leaderboard={leaderboard} personalBest={personalBest} />
      </aside>
    </div>
  );
}

/* ── Leaderboard Card with Tabs ───────────────────────── */
function LeaderboardCard({ leaderboard, personalBest }: { leaderboard: Entry[]; personalBest: Entry[] }) {
  const [tab, setTab] = useState<"top" | "best">("top");
  const entries = tab === "top" ? leaderboard : personalBest;

  return (
    <section className="rounded-2xl bg-[#1A2E15]/80 border border-[#5BA829]/20 p-4">
      <div className="flex gap-0.5 p-0.5 rounded-lg bg-[#0F1F0F]/60 mb-3">
        {(["top", "best"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              tab === t
                ? "bg-[#5BA829] text-white"
                : "text-green-200/35 hover:text-green-200/50"
            }`}
          >
            {t === "top" ? "Top Scores" : "Personal Best"}
          </button>
        ))}
      </div>
      <LeaderboardList entries={entries} empty={tab === "top" ? "No scores yet" : "No bests yet"} />
    </section>
  );
}

/* ── Leaderboard List ─────────────────────────────────── */
function LeaderboardList({ entries, empty }: { entries: Entry[]; empty: string }) {
  if (!entries.length) {
    return <p className="text-green-200/20 text-[13px] text-center py-4">{empty}</p>;
  }
  return (
    <ol className="space-y-1">
      {entries.map((e, i) => (
        <li
          key={`${e.username}-${e.score}-${i}`}
          className={`flex items-center justify-between text-[13px] font-semibold rounded-lg px-3 py-2 ${
            i === 0
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
              i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-500" : "text-green-200/20"
            }`}>
              {i + 1}
            </span>
            <span className="truncate">{e.username}</span>
          </span>
          <span className="text-green-400/90 font-bold tabular-nums ml-3">{e.score}</span>
        </li>
      ))}
    </ol>
  );
}
