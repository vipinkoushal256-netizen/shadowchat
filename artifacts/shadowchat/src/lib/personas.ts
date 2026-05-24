import { Timestamp } from "firebase/firestore";

/* ─── Domain types ──────────────────────────────────────────────────────────── */

export interface Persona {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  welcomeMessage: string;
  status: "online" | "offline" | "typing";
  createdAt: Timestamp | null;
}

export interface Conversation {
  id: string;
  personaId: string;
  userId: string;
  lastMessage: string;
  updatedAt: Timestamp | null;
}

export interface Message {
  id: string;
  sender: string;   // uid for user messages; persona.username for admin replies
  text: string;
  createdAt: Timestamp | null;
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

export function convId(uid: string, personaUsername: string): string {
  return `${uid}_${personaUsername}`;
}

export function formatTime(ts: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function statusLabel(status: Persona["status"]): string {
  return status === "online" ? "Online" : status === "typing" ? "Typing..." : "Away";
}

/* ─── Seed data ─────────────────────────────────────────────────────────────── */

export const DEFAULT_PERSONAS: Omit<Persona, "id" | "createdAt">[] = [
  {
    username: "midnightsoul", displayName: "MidnightSoul",
    bio: "Wandering the digital shadows since forever.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    status: "online", welcomeMessage: "Hey there. You found me.",
  },
  {
    username: "velvetghost", displayName: "VelvetGhost",
    bio: "Between words and silence.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop",
    status: "typing", welcomeMessage: "I was wondering when you'd show up.",
  },
  {
    username: "neoneyes", displayName: "NeonEyes",
    bio: "Sees everything. Says little.",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop",
    status: "online", welcomeMessage: "I see you.",
  },
  {
    username: "crimsonveil", displayName: "CrimsonVeil",
    bio: "Hidden behind every curtain.",
    avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=200&auto=format&fit=crop",
    status: "online", welcomeMessage: "You pulled back the veil.",
  },
  {
    username: "silentdrift", displayName: "SilentDrift",
    bio: "Drifting through encrypted channels.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
    status: "offline", welcomeMessage: "...",
  },
  {
    username: "obsidianwolf", displayName: "ObsidianWolf",
    bio: "Apex predator of the dark web.",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop",
    status: "online", welcomeMessage: "The wolf is always watching.",
  },
];
