import { Timestamp } from "firebase/firestore";

export interface Persona {
  id: string;            // Firestore auto-generated doc ID (collection: "personas")
  username: string;      // URL slug, lowercase, no spaces (e.g. "midnightsoul")
  displayName: string;   // Display name (e.g. "MidnightSoul")
  bio: string;
  avatar: string;        // Image URL
  status: "online" | "offline" | "typing";
  accent: string;        // CSS colour (default "#facc15")
  welcomeMessage: string;
  points: number;
  order: number;         // Sort order in sidebar
  createdAt: Timestamp | null;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Timestamp | null;
  persona: string;
}

export function makeConversationId(uid: string, personaUsername: string) {
  return `${uid}_${personaUsername}`;
}

export function formatTime(ts: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatPoints(points: number): string {
  if (points >= 1000) return `${(points / 1000).toFixed(1)}k`;
  return String(points);
}

export function statusLabel(status: Persona["status"]): string {
  return status === "online" ? "Online" : status === "typing" ? "Typing..." : "Away";
}

/** Default personas used to seed an empty Firestore collection. */
export const DEFAULT_PERSONAS: Omit<Persona, "id" | "createdAt">[] = [
  {
    username: "midnightsoul",
    displayName: "MidnightSoul",
    bio: "Wandering the digital shadows since forever.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    status: "online",
    accent: "#facc15",
    welcomeMessage: "Hey there. You found me.",
    points: 12400,
    order: 1,
  },
  {
    username: "velvetghost",
    displayName: "VelvetGhost",
    bio: "Between words and silence.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop",
    status: "typing",
    accent: "#facc15",
    welcomeMessage: "I was wondering when you'd show up.",
    points: 9100,
    order: 2,
  },
  {
    username: "neoneyes",
    displayName: "NeonEyes",
    bio: "Sees everything. Says little.",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop",
    status: "online",
    accent: "#facc15",
    welcomeMessage: "I see you.",
    points: 17800,
    order: 3,
  },
  {
    username: "crimsonveil",
    displayName: "CrimsonVeil",
    bio: "Hidden behind every curtain.",
    avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=200&auto=format&fit=crop",
    status: "online",
    accent: "#facc15",
    welcomeMessage: "You pulled back the veil.",
    points: 5300,
    order: 4,
  },
  {
    username: "silentdrift",
    displayName: "SilentDrift",
    bio: "Drifting through encrypted channels.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
    status: "offline",
    accent: "#facc15",
    welcomeMessage: "...",
    points: 8800,
    order: 5,
  },
  {
    username: "obsidianwolf",
    displayName: "ObsidianWolf",
    bio: "Apex predator of the dark web.",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop",
    status: "online",
    accent: "#facc15",
    welcomeMessage: "The wolf is always watching.",
    points: 22100,
    order: 6,
  },
];
