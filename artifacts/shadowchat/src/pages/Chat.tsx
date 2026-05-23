import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Timestamp | null;
  persona: string;
}

export interface Persona {
  name: string;
  slug: string;
  status: string;
  points: string;
  image: string;
}

/* ─── Persona data (shared export for Admin) ─────────────────────────────── */

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

/* ─── Helpers ────────────────────────────────────────────────────────────── */

export function makeChatId(uid: string, personaSlug: string) {
  return `${uid}_${personaSlug}`;
}

export function formatTime(ts: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "Online"
      ? "bg-green-400"
      : status === "Typing..."
      ? "bg-yellow-400 animate-pulse"
      : "bg-zinc-600";
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />;
}

/* ─── Chat panel ─────────────────────────────────────────────────────────── */

function ChatPanel({
  persona,
  uid,
  username,
  onBack,
}: {
  persona: Persona;
  uid: string;
  username: string;
  onBack: () => void;
}) {
  const cid = makeChatId(uid, persona.slug);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Ensure chat metadata doc exists so admin can discover this room */
  useEffect(() => {
    setDoc(
      doc(db, "chats", cid),
      {
        uid,
        username,
        personaName: persona.name,
        personaSlug: persona.slug,
        personaImage: persona.image,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});
  }, [cid, uid, username, persona]);

  /* Real-time listener */
  useEffect(() => {
    const q = query(
      collection(db, "chats", cid, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) }))
      );
    });
    return () => unsub();
  }, [cid]);

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Focus input */
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [cid]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      await addDoc(collection(db, "chats", cid, "messages"), {
        senderId: uid,
        text,
        timestamp: serverTimestamp(),
        persona: persona.name,
      });
      /* Update chat metadata with last message */
      await setDoc(
        doc(db, "chats", cid),
        { lastMessage: text, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.error("Send failed:", e);
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, cid, uid, persona.name]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 md:px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-xl flex-shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
          data-testid="button-back-to-personas"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative flex-shrink-0">
          <img
            src={persona.image}
            alt={persona.name}
            className="w-10 h-10 rounded-xl object-cover"
          />
          <span className="absolute -bottom-0.5 -right-0.5">
            <StatusDot status={persona.status} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-white text-base leading-none">{persona.name}</div>
          <div className="text-xs text-zinc-500 mt-1 font-medium">{persona.status}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black text-primary">{persona.points}</div>
          <div className="text-[9px] text-zinc-600 uppercase tracking-wide font-bold">pts</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4" data-testid="messages-container">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center gap-4 py-20"
          >
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10">
              <img src={persona.image} alt={persona.name} className="w-full h-full object-cover grayscale opacity-60" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">{persona.name} is waiting.</p>
              <p className="text-zinc-500 text-sm mt-1">Break the silence. Say something.</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.senderId === uid;
            const personaForMsg = PERSONAS.find((p) => p.name === msg.persona) ?? persona;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                data-testid={`message-${msg.id}`}
              >
                {isMe ? (
                  <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-black text-xs font-black flex-shrink-0 self-end">
                    Y
                  </div>
                ) : (
                  <img
                    src={personaForMsg.image}
                    alt={personaForMsg.name}
                    className="w-8 h-8 rounded-xl object-cover flex-shrink-0 self-end"
                  />
                )}

                <div className={`flex flex-col gap-1 max-w-[72%] ${isMe ? "items-end" : "items-start"}`}>
                  {!isMe && (
                    <span className="text-[11px] font-bold text-zinc-500 px-1">{msg.persona}</span>
                  )}
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
                      isMe
                        ? "bg-primary text-black font-semibold rounded-tr-sm shadow-[0_0_20px_rgba(250,204,21,0.15)]"
                        : "bg-white/5 border border-white/8 text-white/90 rounded-tl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-zinc-600 font-medium px-1">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${persona.name}...`}
            rows={1}
            style={{ minHeight: "50px", maxHeight: "128px" }}
            className="flex-1 bg-white/5 border border-white/10 focus:border-primary/50 rounded-2xl px-5 py-3 text-sm text-white placeholder:text-zinc-600 resize-none outline-none transition-all duration-200"
            data-testid="input-message"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 p-3.5 rounded-2xl bg-primary text-black hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:scale-100 shadow-[0_0_20px_rgba(250,204,21,0.2)]"
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-zinc-700 font-medium mt-2 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

/* ─── Main Chat page ─────────────────────────────────────────────────────── */

export default function Chat() {
  const { user, userData } = useAuth();
  const [, setLocation] = useLocation();
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [showChat, setShowChat] = useState(false);

  function openPersona(p: Persona) {
    setActivePersona(p);
    setShowChat(true);
  }

  return (
    <div className="h-[100dvh] bg-background text-foreground flex flex-col overflow-hidden">
      {/* Nav */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/5 bg-black/60 backdrop-blur-xl z-40 flex-shrink-0"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/")}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black tracking-[0.15em]">
            SHADOW<span className="text-primary">CHAT</span>
          </h1>
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-primary text-xs font-bold tracking-wider">LIVE</span>
          </div>
        </div>
        {userData && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-sm font-semibold text-zinc-300 max-w-[120px] truncate">
              {userData.username}
            </span>
          </div>
        )}
      </motion.header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Persona sidebar */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className={`flex-col w-full md:w-80 border-r border-white/5 bg-black/40 backdrop-blur-xl ${
            showChat ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="px-4 py-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Private Rooms</span>
              <span className="text-xs font-bold text-primary">
                {PERSONAS.filter((p) => p.status === "Online").length} online
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {PERSONAS.map((persona, i) => (
              <motion.button
                key={persona.slug}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => openPersona(persona)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-all duration-200 text-left group relative ${
                  activePersona?.slug === persona.slug ? "bg-white/5" : ""
                }`}
                data-testid={`persona-${persona.slug}`}
              >
                {activePersona?.slug === persona.slug && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-r" />
                )}
                <div className="relative flex-shrink-0">
                  <img
                    src={persona.image}
                    alt={persona.name}
                    className={`w-12 h-12 rounded-2xl object-cover transition-all duration-300 ${
                      activePersona?.slug === persona.slug
                        ? "grayscale-0 opacity-100"
                        : "grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100"
                    }`}
                  />
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      persona.status === "Online" ? "bg-green-400" :
                      persona.status === "Typing..." ? "bg-yellow-400 animate-pulse" : "bg-zinc-600"
                    }`} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`font-bold text-sm truncate transition-colors ${
                    activePersona?.slug === persona.slug ? "text-white" : "text-white/70 group-hover:text-white"
                  }`}>
                    {persona.name}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-0.5">{persona.status}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-black text-primary">{persona.points}</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide font-bold">pts</div>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="p-4 border-t border-white/5">
            <div className="rounded-2xl p-4 bg-gradient-to-br from-primary to-orange-500 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/20 rounded-full blur-xl -translate-y-3 translate-x-3" />
              <div className="relative z-10 text-black">
                <div className="text-[9px] font-black uppercase tracking-widest opacity-70">Bonus System</div>
                <div className="text-sm font-black mt-0.5">Earn More Points</div>
                <p className="text-[10px] opacity-70 mt-0.5 font-medium">Active chats multiply rewards.</p>
              </div>
            </div>
          </div>
        </motion.aside>

        {/* Chat area */}
        <div className={`flex-1 overflow-hidden min-h-0 ${showChat ? "flex" : "hidden md:flex"} flex-col`}>
          {activePersona && user && userData ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activePersona.slug}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 flex flex-col min-h-0"
              >
                <ChatPanel
                  persona={activePersona}
                  uid={user.uid}
                  username={userData.username}
                  onBack={() => setShowChat(false)}
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="hidden md:flex flex-col items-center justify-center h-full gap-6 text-center px-8"
            >
              <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MessageSquare className="w-9 h-9 text-primary" />
              </div>
              <div>
                <p className="text-white font-bold text-xl">Select a persona</p>
                <p className="text-zinc-500 text-sm mt-2 max-w-xs leading-relaxed">
                  Choose from the left to open a private anonymous chat room.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
