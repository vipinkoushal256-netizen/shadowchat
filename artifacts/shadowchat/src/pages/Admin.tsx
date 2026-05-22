import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  Timestamp,
  setDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Send, ArrowLeft, Shield, Users, MessageSquare, ChevronDown, Eye } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface AdminMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: Timestamp | null;
  persona: string;
}

interface AdminPersona {
  name: string;
  slug: string;
  image: string;
}

interface ChatMeta {
  id: string;
  uid: string;
  username: string;
  personaName: string;
  personaSlug: string;
  personaImage: string;
  lastMessage?: string;
  updatedAt: Timestamp | null;
}

/* ─── Persona list (standalone copy — no Chat.tsx import) ───────────────── */

const ADMIN_PERSONAS: AdminPersona[] = [
  {
    name: "MidnightSoul",
    slug: "midnightsoul",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
  },
  {
    name: "VelvetGhost",
    slug: "velvetghost",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop",
  },
  {
    name: "NeonEyes",
    slug: "neoneyes",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop",
  },
  {
    name: "CrimsonVeil",
    slug: "crimsonveil",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=200&auto=format&fit=crop",
  },
  {
    name: "SilentDrift",
    slug: "silentdrift",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
  },
  {
    name: "ObsidianWolf",
    slug: "obsidianwolf",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop",
  },
];

function fmt(ts: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ─── PIN Gate ───────────────────────────────────────────────────────────── */

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === "shadow2024") {
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setPin("");
      setTimeout(() => { setError(false); setShake(false); }, 1500);
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(250,204,21,0.06),transparent)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center gap-5 mb-8">
            <div className="w-20 h-20 rounded-2xl bg-[hsl(48,96%,53%)]/10 border border-[hsl(48,96%,53%)]/20 flex items-center justify-center">
              <Shield className="w-10 h-10 text-[hsl(48,96%,53%)]" />
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-3xl font-black tracking-[0.12em] text-white">
                SHADOW<span className="text-[hsl(48,96%,53%)]">ADMIN</span>
              </h1>
              <p className="text-zinc-500 text-sm">Restricted access. Authorised personnel only.</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="• • • • • • • •"
                autoFocus
                className={`w-full bg-white/5 border rounded-2xl px-5 py-4 text-white text-center text-xl font-bold tracking-[0.4em] placeholder:text-zinc-700 outline-none transition-all duration-200
                  ${error
                    ? "border-red-500/60 bg-red-500/5"
                    : "border-white/10 focus:border-[hsl(48,96%,53%)]/50 focus:bg-white/[0.06]"
                  }
                  ${shake ? "animate-pulse" : ""}
                `}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-xs text-center font-semibold"
                >
                  Incorrect PIN — access denied.
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-[hsl(48,96%,53%)] text-black font-black text-sm tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_0_30px_rgba(250,204,21,0.2)]"
            >
              Enter Dashboard
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Admin Chat Panel ───────────────────────────────────────────────────── */

function AdminChatPanel({
  chat,
  onBack,
}: {
  chat: ChatMeta;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyAs, setReplyAs] = useState<AdminPersona>(
    ADMIN_PERSONAS.find((p) => p.slug === chat.personaSlug) ?? ADMIN_PERSONAS[0]
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Real-time messages */
  useEffect(() => {
    const q = query(
      collection(db, "chats", chat.id, "messages"),
      orderBy("timestamp", "asc")
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminMessage, "id">) })));
    });
  }, [chat.id]);

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Re-focus input when chat changes */
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [chat.id]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      await addDoc(collection(db, "chats", chat.id, "messages"), {
        senderId: `persona_${replyAs.slug}`,
        text,
        timestamp: serverTimestamp(),
        persona: replyAs.name,
      });
      await setDoc(
        doc(db, "chats", chat.id),
        { lastMessage: `${replyAs.name}: ${text}`, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Admin send failed:", err);
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, chat.id, replyAs]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const msgPersonaImg = (msg: AdminMessage) =>
    ADMIN_PERSONAS.find((p) => p.name === msg.persona)?.image ?? chat.personaImage;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-white/5 bg-black/50 backdrop-blur-xl flex-shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative flex-shrink-0">
          <img src={chat.personaImage} alt={chat.personaName} className="w-10 h-10 rounded-xl object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{chat.username}</span>
            <span className="text-zinc-600 text-xs">↔</span>
            <span className="text-[hsl(48,96%,53%)] text-xs font-bold">{chat.personaName}</span>
          </div>
          <div className="text-[10px] text-zinc-600 font-mono mt-0.5 truncate">uid: {chat.uid.slice(0, 20)}…</div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-[10px] font-bold">LIVE</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20 text-center">
            <Eye className="w-8 h-8 text-zinc-700" />
            <div>
              <p className="text-zinc-500 text-sm font-medium">No messages yet.</p>
              <p className="text-zinc-700 text-xs mt-1">Waiting for the user to start the conversation.</p>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isUser = msg.senderId === chat.uid;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className={`flex gap-3 ${isUser ? "flex-row" : "flex-row-reverse"}`}
              >
                {/* Avatar */}
                {isUser ? (
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-black text-zinc-300 flex-shrink-0 self-end">
                    {chat.username.slice(0, 1).toUpperCase()}
                  </div>
                ) : (
                  <img
                    src={msgPersonaImg(msg)}
                    alt={msg.persona}
                    className="w-8 h-8 rounded-xl object-cover flex-shrink-0 self-end"
                  />
                )}

                {/* Bubble */}
                <div className={`flex flex-col gap-1 max-w-[68%] ${isUser ? "items-start" : "items-end"}`}>
                  <span className="text-[10px] font-bold text-zinc-500 px-1">
                    {isUser ? chat.username : msg.persona}
                    {!isUser && <span className="ml-1 text-[hsl(48,96%,53%)]/60">(admin)</span>}
                  </span>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
                      isUser
                        ? "bg-white/6 border border-white/8 text-white/90 rounded-tl-sm"
                        : "bg-[hsl(48,96%,53%)] text-black font-semibold rounded-tr-sm shadow-[0_0_20px_rgba(250,204,21,0.12)]"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-zinc-700 px-1">{fmt(msg.timestamp)}</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Reply area */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-white/5 bg-black/70 backdrop-blur-xl space-y-3">

        {/* Persona selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[hsl(48,96%,53%)]/30 transition-colors text-left"
          >
            <img src={replyAs.image} alt={replyAs.name} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Replying as</div>
              <div className="text-sm font-bold text-[hsl(48,96%,53%)] truncate">{replyAs.name}</div>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-30"
              >
                {ADMIN_PERSONAS.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => { setReplyAs(p); setDropdownOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      replyAs.slug === p.slug ? "bg-[hsl(48,96%,53%)]/8" : "hover:bg-white/5"
                    }`}
                  >
                    <img src={p.image} alt={p.name} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                    <span className={`text-sm font-bold ${replyAs.slug === p.slug ? "text-[hsl(48,96%,53%)]" : "text-white/80"}`}>
                      {p.name}
                    </span>
                    {replyAs.slug === p.slug && (
                      <span className="ml-auto text-[hsl(48,96%,53%)] font-black text-sm">✓</span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Text + send */}
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Type as ${replyAs.name}…`}
            rows={1}
            style={{ minHeight: "50px", maxHeight: "120px" }}
            className="flex-1 bg-white/5 border border-white/10 focus:border-[hsl(48,96%,53%)]/50 rounded-2xl px-5 py-3 text-sm text-white placeholder:text-zinc-600 resize-none outline-none transition-all duration-200"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 p-3.5 rounded-2xl bg-[hsl(48,96%,53%)] text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 shadow-[0_0_20px_rgba(250,204,21,0.15)]"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-zinc-700 text-center font-medium">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

/* ─── Admin Dashboard ────────────────────────────────────────────────────── */

export default function Admin() {
  const [unlocked, setUnlocked] = useState(false);
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [activeChat, setActiveChat] = useState<ChatMeta | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  /* Subscribe to all chats once unlocked */
  useEffect(() => {
    if (!unlocked) return;
    const q = query(collection(db, "chats"), orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snap) => {
      setChats(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMeta, "id">) })));
    });
  }, [unlocked]);

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="h-screen bg-[hsl(0,0%,4%)] text-white flex flex-col overflow-hidden">

      {/* Top nav */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/5 bg-black/60 backdrop-blur-xl z-40 flex-shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[hsl(48,96%,53%)]/10 border border-[hsl(48,96%,53%)]/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[hsl(48,96%,53%)]" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-[0.15em] leading-none">
              SHADOW<span className="text-[hsl(48,96%,53%)]">ADMIN</span>
            </h1>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold mt-0.5">Command Center</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <Users className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-sm font-bold text-white">{chats.length}</span>
            <span className="text-xs text-zinc-500 hidden sm:inline">active rooms</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(48,96%,53%)]/10 border border-[hsl(48,96%,53%)]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(48,96%,53%)] animate-pulse" />
            <span className="text-[hsl(48,96%,53%)] text-xs font-bold tracking-wider">LIVE</span>
          </div>
        </div>
      </motion.header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Conversation list */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.35 }}
          className={`flex-col w-full md:w-80 border-r border-white/5 bg-black/30 ${showPanel ? "hidden md:flex" : "flex"}`}
        >
          <div className="px-4 py-3 border-b border-white/5">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              Active Conversations
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-20 px-6 text-center">
                <MessageSquare className="w-10 h-10 text-zinc-800" />
                <div>
                  <p className="text-zinc-500 text-sm font-semibold">No conversations yet</p>
                  <p className="text-zinc-700 text-xs mt-1 leading-relaxed">
                    Users need to open a persona chat room first. Their messages will appear here in real-time.
                  </p>
                </div>
              </div>
            ) : (
              chats.map((chat, i) => (
                <motion.button
                  key={chat.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => { setActiveChat(chat); setShowPanel(true); }}
                  className={`w-full flex items-center gap-3 px-4 py-4 border-b border-white/[0.03] text-left transition-all duration-200 relative group ${
                    activeChat?.id === chat.id ? "bg-white/5" : "hover:bg-white/[0.03]"
                  }`}
                >
                  {activeChat?.id === chat.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-10 bg-[hsl(48,96%,53%)] rounded-r" />
                  )}
                  <div className="relative flex-shrink-0">
                    <img
                      src={chat.personaImage}
                      alt={chat.personaName}
                      className="w-11 h-11 rounded-xl object-cover"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[hsl(0,0%,4%)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`font-bold text-sm truncate ${
                        activeChat?.id === chat.id ? "text-white" : "text-white/75 group-hover:text-white/90"
                      }`}>
                        {chat.username}
                      </span>
                      <span className="text-[9px] text-zinc-600 flex-shrink-0 font-medium">
                        {fmt(chat.updatedAt)}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[hsl(48,96%,53%)]/70 mb-0.5">
                      ↔ {chat.personaName}
                    </div>
                    {chat.lastMessage && (
                      <div className="text-[11px] text-zinc-600 truncate leading-tight">{chat.lastMessage}</div>
                    )}
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </motion.aside>

        {/* Right panel */}
        <div className={`flex-1 overflow-hidden ${showPanel ? "flex" : "hidden md:flex"} flex-col`}>
          {activeChat ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeChat.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <AdminChatPanel chat={activeChat} onBack={() => setShowPanel(false)} />
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="hidden md:flex flex-col items-center justify-center h-full gap-6 text-center px-8"
            >
              <div className="w-24 h-24 rounded-3xl bg-[hsl(48,96%,53%)]/8 border border-[hsl(48,96%,53%)]/15 flex items-center justify-center">
                <Shield className="w-11 h-11 text-[hsl(48,96%,53%)]/60" />
              </div>
              <div>
                <p className="text-white font-bold text-xl">Select a conversation</p>
                <p className="text-zinc-500 text-sm mt-2 max-w-xs leading-relaxed">
                  Choose a user chat from the sidebar to view the full history and reply as any persona.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {ADMIN_PERSONAS.slice(0, 3).map((p) => (
                  <div key={p.slug} className="flex flex-col items-center gap-2">
                    <img src={p.image} alt={p.name} className="w-12 h-12 rounded-2xl object-cover grayscale opacity-30" />
                    <span className="text-[10px] text-zinc-700 font-medium">{p.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
