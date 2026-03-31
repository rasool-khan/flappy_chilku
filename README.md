# Flappy Chilku

A browser-based Flappy Bird clone built with Next.js, rendered on an HTML5 canvas, with a real-time global leaderboard powered by Firebase Realtime Database.

## Features

- Canvas-based game with physics (gravity, flap, pipe collision)
- Username entry with local persistence (`localStorage`)
- Global leaderboard — all scores, updated in real time
- Personal best leaderboard — one entry per player (best score only), using Firebase transactions
- Deployed on Vercel

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Firebase Realtime Database |
| Deployment | Vercel |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Firebase Setup

The app reads Firebase config from `app/lib/firebase.ts`. For self-hosting:

1. Copy `firebase-config.example.js` and fill in your project's credentials.
2. Update `app/lib/firebase.ts` with your own `firebaseConfig` values.

Firebase Realtime Database paths used:

| Path | Purpose |
|---|---|
| `leaderboard` | All submitted scores |
| `leaderboardBestByPlayer` | Best score per unique player (keyed by username) |

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Project Structure

```
app/
  page.tsx              # Root page — mounts the Game component
  layout.tsx            # Root layout
  globals.css           # Global styles
  components/
    Game.tsx            # Game shell: username, leaderboard, score submission
    GameCanvas.tsx      # Canvas renderer and game loop
  lib/
    firebase.ts         # Firebase initialization and DB path constants
```