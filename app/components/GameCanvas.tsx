"use client";

import { useRef, useEffect, useCallback } from "react";

/* ── constants ──────────────────────────────────────────────── */
const GROUND_H = 90;
const PIPE_W = 72;
const PIPE_GAP = 165;
const PIPE_SPACING = 220;
const PIPE_SPEED = 2.6;
const GRAVITY = 0.42;
const FLAP_STR = -7.2;

const CANVAS_W = 420;
const CANVAS_H = 700;

const TARGET_DT = 1000 / 60;

/* ── types ──────────────────────────────────────────────────── */
interface Bird {
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: number;
  rotation: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}

/* ── component ──────────────────────────────────────────────── */
export default function GameCanvas({
  playerName,
  onRequestUsername,
  onScoreSubmit,
}: {
  playerName: string;
  onRequestUsername: () => void;
  onScoreSubmit: (score: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const playerNameRef = useRef(playerName);
  const onRequestUsernameRef = useRef(onRequestUsername);
  const onScoreSubmitRef = useRef(onScoreSubmit);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { onRequestUsernameRef.current = onRequestUsername; }, [onRequestUsername]);
  useEffect(() => { onScoreSubmitRef.current = onScoreSubmit; }, [onScoreSubmit]);

  const stateRef = useRef({
    gameStarted: false,
    gameOver: false,
    score: 0,
    bestScore: 0,
    frame: 0,
    bird: { x: 95, y: 260, width: 76, height: 76, velocity: 0, rotation: 0 } as Bird,
    pipes: [] as Pipe[],
    submitted: "",
  });

  const loseSoundRef = useRef<HTMLAudioElement | null>(null);
  const processedRef = useRef<HTMLCanvasElement | null>(null);
  const processedReadyRef = useRef(false);
  // Pixel-accurate collision mask from the processed bird sprite
  const birdMaskRef = useRef<{ w: number; h: number; alpha: Uint8Array } | null>(null);

  /* ── helpers ─────────────────────────────────────────────── */
  const createPipe = useCallback((x: number) => {
    const minTop = 80;
    const maxTop = CANVAS_H - GROUND_H - PIPE_GAP - 120;
    const topHeight = Math.random() * (maxTop - minTop) + minTop;
    stateRef.current.pipes.push({ x, topHeight, passed: false });
  }, []);

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.gameStarted = false;
    s.gameOver = false;
    s.score = 0;
    s.frame = 0;
    s.bird = { x: 95, y: 265, width: 76, height: 76, velocity: 0, rotation: 0 };
    s.pipes = [];
    createPipe(CANVAS_W + 120);
    createPipe(CANVAS_W + 120 + PIPE_SPACING);
  }, [createPipe]);

  const triggerLose = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver) return;
    s.gameOver = true;
    try {
      const snd = loseSoundRef.current;
      if (snd) { snd.currentTime = 0; snd.play().catch(() => {}); }
    } catch { /* */ }
    if (s.score > s.bestScore) {
      s.bestScore = s.score;
      localStorage.setItem("customFlappyBest", String(s.bestScore));
    }
    const pName = playerNameRef.current;
    const key = `${pName}:${s.score}:${s.bestScore}`;
    if (key !== s.submitted && s.score > 0) {
      s.submitted = key;
      onScoreSubmitRef.current(s.score);
    }
  }, []);

  const flap = useCallback(() => {
    if (!playerNameRef.current) { onRequestUsernameRef.current(); return; }
    const s = stateRef.current;
    if (!s.gameStarted) s.gameStarted = true;
    if (s.gameOver) { resetGame(); s.gameStarted = true; }
    s.bird.velocity = FLAP_STR;
  }, [resetGame]);

  /* ── init ────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    stateRef.current.bestScore = Number(localStorage.getItem("customFlappyBest") || 0);

    // Load bird image & build alpha mask for pixel-perfect collision
    const birdImg = new Image();
    birdImg.crossOrigin = "anonymous";
    birdImg.src = "/bird.jpg";

    birdImg.onload = () => {
      const oc = document.createElement("canvas");
      const ox = oc.getContext("2d")!;
      oc.width = birdImg.naturalWidth;
      oc.height = birdImg.naturalHeight;
      ox.drawImage(birdImg, 0, 0);
      const id = ox.getImageData(0, 0, oc.width, oc.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] + d[i + 1] + d[i + 2] < 55) d[i + 3] = 0;
      }
      ox.putImageData(id, 0, 0);
      processedRef.current = oc;
      processedReadyRef.current = true;

      // Build collision mask at the draw size
      const mw = stateRef.current.bird.width;
      const mh = stateRef.current.bird.height;
      const mc = document.createElement("canvas");
      mc.width = mw;
      mc.height = mh;
      const mx = mc.getContext("2d")!;
      mx.drawImage(oc, 0, 0, mw, mh);
      const md = mx.getImageData(0, 0, mw, mh).data;
      const alpha = new Uint8Array(mw * mh);
      for (let i = 0; i < alpha.length; i++) {
        alpha[i] = md[i * 4 + 3] > 20 ? 1 : 0;
      }
      birdMaskRef.current = { w: mw, h: mh, alpha };
    };

    const sound = new Audio("/lose.mp4");
    sound.preload = "auto";
    loseSoundRef.current = sound;

    resetGame();

    /* ── pixel-accurate pipe collision ─────────────────────── */
    function birdHitsPipe(b: Bird, pipe: Pipe): boolean {
      const mask = birdMaskRef.current;
      if (!mask) {
        // Fallback: tight AABB with 4px inset
        const bL = b.x - b.width / 2 + 4;
        const bR = b.x + b.width / 2 - 4;
        const bT = b.y - b.height / 2 + 4;
        const bB = b.y + b.height / 2 - 4;
        return bR > pipe.x && bL < pipe.x + PIPE_W && (bT < pipe.topHeight || bB > pipe.topHeight + PIPE_GAP);
      }

      // Bird bounding box in world coords (no rotation for collision — simpler & fairer)
      const bx0 = b.x - b.width / 2;
      const by0 = b.y - b.height / 2;
      const bx1 = bx0 + b.width;
      const by1 = by0 + b.height;

      // Quick AABB reject
      const pL = pipe.x;
      const pR = pipe.x + PIPE_W;
      if (bx1 <= pL || bx0 >= pR) return false;
      const hitsTopAABB = by0 < pipe.topHeight;
      const hitsBotAABB = by1 > pipe.topHeight + PIPE_GAP;
      if (!hitsTopAABB && !hitsBotAABB) return false;

      // Scan overlapping pixels
      const overlapL = Math.max(bx0, pL);
      const overlapR = Math.min(bx1, pR);

      // Top pipe overlap
      if (hitsTopAABB) {
        const overlapT = Math.max(by0, 0);
        const overlapB = Math.min(by1, pipe.topHeight);
        for (let y = Math.floor(overlapT); y < overlapB; y++) {
          const my = y - Math.floor(by0);
          if (my < 0 || my >= mask.h) continue;
          for (let x = Math.floor(overlapL); x < overlapR; x++) {
            const mx = x - Math.floor(bx0);
            if (mx < 0 || mx >= mask.w) continue;
            if (mask.alpha[my * mask.w + mx]) return true;
          }
        }
      }

      // Bottom pipe overlap
      if (hitsBotAABB) {
        const botY = pipe.topHeight + PIPE_GAP;
        const overlapT = Math.max(by0, botY);
        const overlapB = Math.min(by1, CANVAS_H - GROUND_H);
        for (let y = Math.floor(overlapT); y < overlapB; y++) {
          const my = y - Math.floor(by0);
          if (my < 0 || my >= mask.h) continue;
          for (let x = Math.floor(overlapL); x < overlapR; x++) {
            const mx = x - Math.floor(bx0);
            if (mx < 0 || mx >= mask.w) continue;
            if (mask.alpha[my * mask.w + mx]) return true;
          }
        }
      }

      return false;
    }

    /* ── drawing helpers ───────────────────────────────────── */

    function drawSky(frame: number) {
      // Flat banded sky — pixel art feel
      const skyH = CANVAS_H - GROUND_H;
      const bands: [number, number, string][] = [
        [0, 0.22, "#4EC0CA"],
        [0.22, 0.45, "#62C8CC"],
        [0.45, 0.65, "#78D0B8"],
        [0.65, 0.82, "#A0DDA0"],
        [0.82, 1, "#C8E890"],
      ];
      for (const [t0, t1, c] of bands) {
        ctx.fillStyle = c;
        ctx.fillRect(0, skyH * t0, CANVAS_W, skyH * (t1 - t0) + 1);
      }

      // Blocky pixel clouds (rectangles arranged in cloud shape)
      const B = 6;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      const cloudOffsets = [
        // row offsets: [dx, dy] relative to cloud origin, shapes like:
        //      ████
        //    ████████
        //   ██████████
        //    ████████
        [2, 0, 4], [1, 1, 6], [0, 2, 8], [1, 3, 6],
      ];
      for (let i = 0; i < 5; i++) {
        const cx = Math.floor(((frame * 0.18 + i * 105) % (CANVAS_W + 140)) - 70);
        const cy = 40 + (i % 3) * 70 + (i % 2) * 25;
        const s = i % 2 === 0 ? 1 : 0.75;
        for (const [dx, dy, w] of cloudOffsets) {
          ctx.fillRect(cx + dx * B * s, cy + dy * B * s, w * B * s, B * s);
        }
      }

      // Blocky tree/bush silhouettes near horizon
      const silY = CANVAS_H - GROUND_H;
      ctx.fillStyle = "rgba(60,140,50,0.3)";
      for (let i = 0; i < CANVAS_W; i += 22) {
        const h = 18 + ((i * 7 + 13) % 28);
        ctx.fillRect(i, silY - h, 18, h);
        // Treetop wider block
        ctx.fillRect(i - 3, silY - h - 6, 24, 8);
      }
      // Darker trunks
      ctx.fillStyle = "rgba(40,100,30,0.2)";
      for (let i = 6; i < CANVAS_W; i += 44) {
        ctx.fillRect(i + 6, silY - 16, 6, 16);
      }
    }

    function drawPipe(x: number, topH: number) {
      const botY = topH + PIPE_GAP;
      const botH = CANVAS_H - GROUND_H - botY;
      const pw = PIPE_W;
      const lipH = 28;
      const lipOvr = 8; // lip overhang on each side
      const hlW = 10;   // highlight strip width (left)
      const shW = 8;    // shadow strip width (right)

      // Pipe color palette
      const cBody = "#3E9E23";     // base body color
      const cHL   = "#6DC838";     // left highlight strip
      const cSH   = "#296B13";     // right shadow strip
      const cLip  = "#4DB52B";     // lip base (slightly brighter)
      const cLipHL = "#80E040";    // lip highlight (top row + left col)
      const cLipSH = "#256010";    // lip shadow (bottom row + right col)
      const cDark  = "#172D09";    // dark border around lip

      // Helper: draw a pipe body segment (with left/right bevel strips)
      const seg = (sx: number, sy: number, sw: number, sh: number) => {
        ctx.fillStyle = cBody;
        ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = cHL;
        ctx.fillRect(sx, sy, hlW, sh);
        ctx.fillStyle = cSH;
        ctx.fillRect(sx + sw - shW, sy, shW, sh);
      };

      // Helper: draw a pipe lip with beveled edges and dark border
      const lip = (lx: number, ly: number, lw: number, lh: number) => {
        ctx.fillStyle = cLip;
        ctx.fillRect(lx, ly, lw, lh);
        // top highlight row
        ctx.fillStyle = cLipHL;
        ctx.fillRect(lx, ly, lw, 4);
        // left highlight column
        ctx.fillRect(lx, ly, hlW, lh);
        // bottom shadow row
        ctx.fillStyle = cLipSH;
        ctx.fillRect(lx, ly + lh - 5, lw, 5);
        // right shadow column
        ctx.fillRect(lx + lw - shW, ly, shW, lh);
        // dark 2px border: top, bottom, left, right
        ctx.fillStyle = cDark;
        ctx.fillRect(lx, ly, lw, 2);
        ctx.fillRect(lx, ly + lh - 2, lw, 2);
        ctx.fillRect(lx, ly, 2, lh);
        ctx.fillRect(lx + lw - 2, ly, 2, lh);
      };

      // Top pipe body (from top of canvas down to lip)
      seg(x, 0, pw, topH - lipH);
      // Top pipe lip (overhangs each side, sits at bottom of body)
      lip(x - lipOvr, topH - lipH, pw + lipOvr * 2, lipH);

      // Bottom pipe lip (sits at top of bottom body)
      lip(x - lipOvr, botY, pw + lipOvr * 2, lipH);
      // Bottom pipe body (from below lip to ground)
      seg(x, botY + lipH, pw, botH - lipH + 4);
    }

    function drawGround(frame: number) {
      const gY = CANVAS_H - GROUND_H;
      const px = 4;

      // Green grass strip — flat blocky
      ctx.fillStyle = "#5BA829";
      ctx.fillRect(0, gY, CANVAS_W, 14);
      // Grass highlight top edge
      ctx.fillStyle = "#7FCC3C";
      ctx.fillRect(0, gY, CANVAS_W, px);
      // Grass darker bottom edge
      ctx.fillStyle = "#4B8F22";
      ctx.fillRect(0, gY + 14 - px, CANVAS_W, px);

      // Sandy/tan ground body — flat
      ctx.fillStyle = "#DED895";
      ctx.fillRect(0, gY + 14, CANVAS_W, GROUND_H - 14);

      // Scrolling blocky grass ticks
      ctx.fillStyle = "#4B8F22";
      const scrollX = Math.floor(frame * 1.2) % 14;
      for (let i = -14; i < CANVAS_W + 14; i += 14) {
        ctx.fillRect(i - scrollX, gY + 5, 6, px);
      }

      // Horizontal dark stripes in sand
      ctx.fillStyle = "#C8C07A";
      ctx.fillRect(0, gY + 22, CANVAS_W, 3);
      ctx.fillRect(0, gY + 38, CANVAS_W, 3);
      ctx.fillRect(0, gY + 54, CANVAS_W, 3);

      // Scrolling block dots in sand
      ctx.fillStyle = "#C0B870";
      const sandScroll = Math.floor(frame * 1.5) % 18;
      for (let i = -18; i < CANVAS_W + 18; i += 18) {
        ctx.fillRect(i - sandScroll, gY + 28, px, px);
        ctx.fillRect(i - sandScroll + 9, gY + 44, px, px);
      }
    }

    function drawBird(bird: Bird) {
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.rotation);

      if (processedReadyRef.current && processedRef.current) {
        ctx.drawImage(processedRef.current, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
      } else if (birdImg.complete && birdImg.naturalWidth > 0) {
        ctx.drawImage(birdImg, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
      } else {
        ctx.fillStyle = "#f5e6d3";
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 24, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawScoreHUD(s: typeof stateRef.current) {
      ctx.save();
      ctx.textAlign = "center";

      const scoreStr = String(s.score);
      ctx.font = "400 28px 'Press Start 2P', monospace";
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(20,60,10,0.6)";
      ctx.strokeText(scoreStr, CANVAS_W / 2, 58);
      ctx.fillStyle = "#fff";
      ctx.fillText(scoreStr, CANVAS_W / 2, 58);

      ctx.restore();
    }

    function drawTitleScreen(frame: number) {
      ctx.save();

      const cw = 300;
      const ch = 70;
      const cx = CANVAS_W / 2 - cw / 2;
      const cy = 185;

      const pulse = 1 + Math.sin(frame * 0.04) * 0.012;
      ctx.translate(CANVAS_W / 2, cy + ch / 2);
      ctx.scale(pulse, pulse);
      ctx.translate(-CANVAS_W / 2, -(cy + ch / 2));

      // Panel — blocky green
      ctx.fillStyle = "#4B8F22";
      ctx.fillRect(cx, cy, cw, ch);
      // Inner lighter inset
      ctx.fillStyle = "#5EAA2B";
      ctx.fillRect(cx + 3, cy + 3, cw - 6, ch - 6);
      // Highlight top edge
      ctx.fillStyle = "#7FCC3C";
      ctx.fillRect(cx + 3, cy + 3, cw - 6, 3);
      // Shadow bottom edge
      ctx.fillStyle = "#3D7A1A";
      ctx.fillRect(cx + 3, cy + ch - 6, cw - 6, 3);
      // Dark outline
      ctx.strokeStyle = "#2D5016";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cw, ch);

      ctx.textAlign = "center";
      ctx.font = "400 14px 'Press Start 2P', monospace";
      // Text shadow
      ctx.fillStyle = "rgba(20,60,10,0.4)";
      ctx.fillText("Flappy Chilku", CANVAS_W / 2, cy + 44);
      // Main text
      ctx.fillStyle = "#fff";
      ctx.fillText("Flappy Chilku", CANVAS_W / 2, cy + 42);
      ctx.restore();

      // "Tap to Play" pulsing
      const a = 0.4 + Math.sin(frame * 0.05) * 0.45;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = "400 10px 'Press Start 2P', monospace";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(20,60,10,0.5)";
      ctx.strokeText("Tap to Play", CANVAS_W / 2, 295);
      ctx.fillStyle = "#fff";
      ctx.fillText("Tap to Play", CANVAS_W / 2, 295);
      ctx.restore();
    }

    function drawGameOver(s: typeof stateRef.current, frame: number) {
      // Slight dim
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const cx = CANVAS_W / 2;

      // "Game Over" banner — pixel font outlined
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "400 20px 'Press Start 2P', monospace";
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(20,60,10,0.6)";
      ctx.strokeText("Game Over", cx, 210);
      ctx.fillStyle = "#fff";
      ctx.fillText("Game Over", cx, 210);
      ctx.restore();

      // Scoreboard panel — blocky green
      const cardW = 280;
      const cardH = 164;
      const cardX = cx - cardW / 2;
      const cardY = 232;

      // Outer
      ctx.fillStyle = "#4B8F22";
      ctx.fillRect(cardX, cardY, cardW, cardH);
      // Inner
      ctx.fillStyle = "#5EAA2B";
      ctx.fillRect(cardX + 3, cardY + 3, cardW - 6, cardH - 6);
      // Top highlight / bottom shadow
      ctx.fillStyle = "#7FCC3C";
      ctx.fillRect(cardX + 3, cardY + 3, cardW - 6, 3);
      ctx.fillStyle = "#3D7A1A";
      ctx.fillRect(cardX + 3, cardY + cardH - 6, cardW - 6, 3);
      // Outline
      ctx.strokeStyle = "#2D5016";
      ctx.lineWidth = 2;
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      // Recessed score area
      const inX = cardX + 14;
      const inY = cardY + 14;
      const inW = cardW - 28;
      const inH = cardH - 28;
      ctx.fillStyle = "#3D7A1A";
      ctx.fillRect(inX, inY, inW, inH);
      ctx.fillStyle = "#4B8F22";
      ctx.fillRect(inX + 2, inY + 2, inW - 4, inH - 4);

      ctx.textAlign = "center";

      // Score label
      ctx.font = "400 8px 'Press Start 2P', monospace";
      ctx.fillStyle = "#C8E890";
      ctx.fillText("SCORE", cx, inY + 24);

      // Score value
      ctx.font = "400 22px 'Press Start 2P', monospace";
      ctx.fillStyle = "#fff";
      ctx.fillText(String(s.score), cx, inY + 56);

      // Best score
      if (s.bestScore > 0) {
        ctx.font = "400 7px 'Press Start 2P', monospace";
        ctx.fillStyle = "#C8E890";
        ctx.fillText("BEST", cx, inY + 78);
        ctx.font = "400 14px 'Press Start 2P', monospace";
        ctx.fillStyle = "#fff";
        ctx.fillText(String(s.bestScore), cx, inY + 100);
      }

      // Medal for high scores
      if (s.score >= 5) {
        const medalX = cardX + 38;
        const medalY = inY + 48;
        const medalR = 16;
        let medalColor1: string, medalColor2: string, medalOutline: string;
        if (s.score >= 40) {
          medalColor1 = "#E8E8F0"; medalColor2 = "#B8B8D0"; medalOutline = "#8888AA";
        } else if (s.score >= 20) {
          medalColor1 = "#FFD700"; medalColor2 = "#DAA520"; medalOutline = "#B8860B";
        } else if (s.score >= 10) {
          medalColor1 = "#C0C0C0"; medalColor2 = "#A0A0A0"; medalOutline = "#808080";
        } else {
          medalColor1 = "#CD7F32"; medalColor2 = "#A0522D"; medalOutline = "#804020";
        }
        // Blocky medal — square with cut corners looks
        ctx.fillStyle = medalColor2;
        ctx.fillRect(medalX - medalR, medalY - medalR, medalR * 2, medalR * 2);
        ctx.fillStyle = medalColor1;
        ctx.fillRect(medalX - medalR + 3, medalY - medalR + 3, medalR * 2 - 6, medalR * 2 - 6);
        ctx.strokeStyle = medalOutline;
        ctx.lineWidth = 2;
        ctx.strokeRect(medalX - medalR, medalY - medalR, medalR * 2, medalR * 2);
        // Star
        ctx.fillStyle = medalOutline;
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("★", medalX, medalY + 5);
      }

      // "Tap to Retry" pulsing
      const a = 0.35 + Math.sin(frame * 0.06) * 0.45;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = "400 9px 'Press Start 2P', monospace";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(20,60,10,0.5)";
      ctx.strokeText("Tap to Retry", cx, cardY + cardH + 32);
      ctx.fillStyle = "#fff";
      ctx.fillText("Tap to Retry", cx, cardY + cardH + 32);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    /* ── game loop (delta-time normalised) ────────────────── */
    let raf = 0;
    let prevTime = 0;

    function loop(now: number) {
      if (!prevTime) prevTime = now;
      const rawDt = now - prevTime;
      prevTime = now;
      const dt = Math.min(rawDt, 50) / TARGET_DT;

      const s = stateRef.current;
      s.frame++;

      // ── physics ──
      if (s.gameStarted && !s.gameOver) {
        const b = s.bird;
        b.velocity += GRAVITY * dt;
        b.y += b.velocity * dt;
        b.rotation = Math.min(Math.max(b.velocity * 0.08, -0.5), 1.1);

        if (b.y + b.height / 2 >= CANVAS_H - GROUND_H || b.y - b.height / 2 <= 0) {
          triggerLose();
        }

        // Speed scales with score: +0.18 per pipe up to a max of 2x base speed
        const speedMult = Math.min(1 + s.score * 0.018, 2.0);
        const speed = PIPE_SPEED * speedMult * dt;
        for (let i = s.pipes.length - 1; i >= 0; i--) {
          const pipe = s.pipes[i];
          pipe.x -= speed;
          if (!pipe.passed && pipe.x + PIPE_W < b.x) { pipe.passed = true; s.score++; }
          if (birdHitsPipe(b, pipe)) triggerLose();
          if (pipe.x + PIPE_W < 0) s.pipes.splice(i, 1);
        }

        // Tighten spacing slightly as speed increases so gap stays fair
        const dynSpacing = Math.max(PIPE_SPACING - s.score * 1.5, 160);
        if (s.pipes.length && s.pipes[s.pipes.length - 1].x < CANVAS_W - dynSpacing) {
          createPipe(CANVAS_W + 40);
        }
      }

      // ── draw ──
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawSky(s.frame);
      for (const pipe of s.pipes) drawPipe(pipe.x, pipe.topHeight);
      drawGround(s.frame);
      drawBird(s.bird);
      drawScoreHUD(s);
      if (!s.gameStarted) drawTitleScreen(s.frame);
      if (s.gameOver) drawGameOver(s, s.frame);

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [resetGame, triggerLose, createPipe]);

  /* ── input handlers ─────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); flap(); }
    };
    const canvas = canvasRef.current;
    const onMouse = () => flap();
    const onTouch = (e: TouchEvent) => { e.preventDefault(); flap(); };
    window.addEventListener("keydown", onKey);
    canvas?.addEventListener("mousedown", onMouse);
    canvas?.addEventListener("touchstart", onTouch, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      canvas?.removeEventListener("mousedown", onMouse);
      canvas?.removeEventListener("touchstart", onTouch);
    };
  }, [flap]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="block w-full max-w-[420px] aspect-[420/700] rounded-lg shadow-[0_2px_16px_rgba(0,0,0,0.3)] border-2 border-[#5BA829]/40 cursor-pointer touch-none [image-rendering:pixelated]"
    />
  );
}
