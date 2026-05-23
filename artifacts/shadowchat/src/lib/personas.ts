import { Timestamp } from "firebase/firestore";

export interface Persona {
  name: string;
  slug: string;
  status: string;
  points: string;
  image: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Timestamp | null;
  persona: string;
}

export const PERSONAS: Persona[] = [
  {
    name: "MidnightSoul",
    slug: "midnightsoul",
    status: "Online",
    points: "12.4k",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
  },
  {
    name: "VelvetGhost",
    slug: "velvetghost",
    status: "Typing...",
    points: "9.1k",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop",
  },
  {
    name: "NeonEyes",
    slug: "neoneyes",
    status: "Online",
    points: "17.8k",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop",
  },
  {
    name: "CrimsonVeil",
    slug: "crimsonveil",
    status: "Online",
    points: "5.3k",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=200&auto=format&fit=crop",
  },
  {
    name: "SilentDrift",
    slug: "silentdrift",
    status: "Away",
    points: "8.8k",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
  },
  {
    name: "ObsidianWolf",
    slug: "obsidianwolf",
    status: "Online",
    points: "22.1k",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop",
  },
];

export function makeChatId(uid: string, personaSlug: string) {
  return `${uid}_${personaSlug}`;
}

export function formatTime(ts: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
