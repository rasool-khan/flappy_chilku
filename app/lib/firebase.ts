import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBH-t54kpEWdbjVeFMZUZ_D9GvzvsyYdhw",
  authDomain: "flappy-chilku.firebaseapp.com",
  databaseURL:
    "https://flappy-chilku-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "flappy-chilku",
  storageBucket: "flappy-chilku.firebasestorage.app",
  messagingSenderId: "685118045834",
  appId: "1:685118045834:web:11d37dc871913bdd687773",
  measurementId: "G-SD9N5KL38F",
};

let app: FirebaseApp | null = null;
let db: Database | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseDb(): Database {
  if (!db) {
    db = getDatabase(getFirebaseApp());
  }
  return db;
}

export const LEADERBOARD_PATH = "leaderboard";
export const UNIQUE_LEADERBOARD_PATH = "leaderboardBestByPlayer";

export const X_LEADERBOARD_PATH = "xmode_leaderboard";
export const X_UNIQUE_LEADERBOARD_PATH = "xmode_leaderboardBestByPlayer";
