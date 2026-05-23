import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useParams } from "wouter";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import { PERSONAS, type Persona, type Message, makeChatId, formatTime } from "@/lib/personas";

/* ─── Status dot ─────────────────────────────────────────────────────────── */

function StatusDot({ status }: { status: string }) {
  const color =
    status === "Online" ? "bg-green-400" :
    status === "Typing..." ? "bg-yellow-400 animate-pulse" :
    "bg-zinc-600";
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />;
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

  console.log("[ChatPanel] mounted persona:", persona.slug, "cid:", cid);

  /* Upsert chat metadata so admin can discover this room */
  useEffect(() => {
    setDoc(
      doc(db, "chats", cid),
      { uid, username, personaName: persona.name, personaSlug: persona.slug, personaImage: persona.image, updatedAt: serverTimestamp() },
      { merge: true }
    ).catch((e) => console.error("[ChatPanel] metadata error:", e));
  }, [cid, uid, username, persona]);

  /* Live messages */
  useEffect(() => {
    const q = query(collection(db, "chats", cid, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      console.log("[ChatPanel] snapshot count:", snap.size);
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) })));
    }, (err) => console.error("[ChatPanel] snapshot error:", err));
    return unsub;
  }, [cid]);

  /* Auto-scroll */
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  /* Focus input on persona switch */
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 150); }, [cid]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      await addDoc(collection(db, "chats", cid, "messages"), {
        senderId: uid, text, timestamp: serverTimestamp(), persona: persona.name,
      });
      await setDoc(doc(db, "chats", cid), { lastMessage: text, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.error("[ChatPanel] send error:", e);
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, cid, uid, persona.name]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
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
          <img src={persona.image} alt={persona.name} className="w-10 h-10 rounded-xl object-cover" />
          <span className="absolute -bottom-0.5 -right-0.5"><StatusDot status={persona.status} /></span>
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
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10">
              <img src={persona.image} alt={persona.name} className="w-full h-full object-cover grayscale opacity-60" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">{persona.name} is waiting.</p>
              <p className="text-zinc-500 text-sm mt-1">Break the silence. Say something.</p>
            </div>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === uid;
          const pFor = PERSONAS.find((p) => p.name === msg.persona) ?? persona;
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`} data-testid={`message-${msg.id}`}>
              {isMe
                ? <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-black text-xs font-black flex-shrink-0 self-end">Y</div>
                : <img src={pFor.image} alt={pFor.name} className="w-8 h-8 rounded-xl object-cover flex-shrink-0 self-end" />
              }
              <div className={`flex flex-col gap-1 max-w-[72%] ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && <span className="text-[11px] font-bold text-zinc-500 px-1">{msg.persona}</span>}
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${isMe ? "bg-primary text-black font-semibold rounded-tr-sm shadow-[0_0_20px_rgba(250,204,21,0.15)]" : "bg-white/5 border border-white/8 text-white/90 rounded-tl-sm"}`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-zinc-600 font-medium px-1">{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${persona.name}...`}
            rows={1}
            style={{ minHeight: 50, maxHeight: 128 }}
            className="flex-1 bg-white/5 border border-white/10 focus:border-primary/50 rounded-2xl px-5 py-3 text-sm text-white placeholder:text-zinc-600 resize-none outline-none transition-all"
            data-testid="input-message"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 p-3.5 rounded-2xl bg-primary text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 shadow-[0_0_20px_rgba(250,204,21,0.2)]"
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-zinc-700 font-medium mt-2 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

/* ─── Main Chat page ─────────────────────────────────────────────────────── */

export default function Chat() {
  const { user, userData } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ persona?: string }>();

  // selectedChat is the single source of truth for rendering.
  // It is set immediately on click — no waiting for router params.
  const [selectedChat, setSelectedChat] = useState<Persona | null>(null);
  // Controls sidebar visibility on mobile.
  const [chatOpen, setChatOpen] = useState(false);

  // Seed from URL on first mount only (handles direct links & page refresh).
  const didSeed = useRef(false);
  useEffect(() => {
    if (didSeed.current) return;
    didSeed.current = true;
    const slug = params.persona;
    console.log("[Chat] seed check — params.persona:", slug);
    if (slug) {
      const p = PERSONAS.find((x) => x.slug === slug) ?? null;
      console.log("[Chat] seed found:", p?.name ?? "null");
      setSelectedChat(p);
      setChatOpen(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  console.log("[Chat] render — selectedChat:", selectedChat?.slug ?? "null", "chatOpen:", chatOpen, "user:", !!user, "userData:", userData?.username);

  function openPersona(p: Persona) {
    console.log("[Chat] openPersona:", p.slug);
    setSelectedChat(p);   // ← immediate render, no routing delay
    setChatOpen(true);
    // Update URL so the link is shareable; this does NOT drive rendering.
    navigate(`/chat/${p.slug}`);
  }

  function goBack() {
    console.log("[Chat] goBack");
    setChatOpen(false);
    navigate("/chat");
  }

  const showChatPanel = selectedChat !== null && user !== null;

  console.log("[Chat] showChatPanel:", showChatPanel, "chatOpen:", chatOpen);

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
          <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-400 hover:text-white" data-testid="button-back-home">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black tracking-[0.15em]">SHADOW<span className="text-primary">CHAT</span></h1>
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-primary text-xs font-bold tracking-wider">LIVE</span>
          </div>
        </div>
        {userData && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-sm font-semibold text-zinc-300 max-w-[120px] truncate">{userData.username}</span>
          </div>
        )}
      </motion.header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Sidebar — hidden on mobile when chat is open */}
        <aside
          className={`flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl flex-shrink-0 w-full md:w-80 ${chatOpen ? "hidden md:flex" : "flex"}`}
        >
          <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Private Rooms</span>
            <span className="text-xs font-bold text-primary">{PERSONAS.filter((p) => p.status === "Online").length} online</span>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {PERSONAS.map((persona) => (
              <button
                key={persona.slug}
                onClick={() => openPersona(persona)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-all text-left group relative ${selectedChat?.slug === persona.slug ? "bg-white/5" : ""}`}
                data-testid={`persona-${persona.slug}`}
              >
                {selectedChat?.slug === persona.slug && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-r" />
                )}
                <div className="relative flex-shrink-0">
                  <img
                    src={persona.image}
                    alt={persona.name}
                    className={`w-12 h-12 rounded-2xl object-cover transition-all ${selectedChat?.slug === persona.slug ? "grayscale-0 opacity-100" : "grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100"}`}
                  />
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <span className={`w-2 h-2 rounded-full block ${persona.status === "Online" ? "bg-green-400" : persona.status === "Typing..." ? "bg-yellow-400 animate-pulse" : "bg-zinc-600"}`} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`font-bold text-sm truncate transition-colors ${selectedChat?.slug === persona.slug ? "text-white" : "text-white/70 group-hover:text-white"}`}>{persona.name}</div>
                  <div className="text-xs text-zinc-500 font-medium mt-0.5">{persona.status}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-black text-primary">{persona.points}</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide font-bold">pts</div>
                </div>
              </button>
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
        </aside>

        {/* Chat area — always visible on desktop; only visible on mobile when chatOpen */}
        <div
          style={{ display: chatOpen ? "flex" : undefined }}
          className={`flex-1 overflow-hidden min-h-0 flex-col ${chatOpen ? "" : "hidden md:flex"}`}
        >
          {showChatPanel ? (
            <ChatPanel
              key={selectedChat.slug}
              persona={selectedChat}
              uid={user!.uid}
              username={userData?.username ?? user!.uid}
              onBack={goBack}
            />
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full gap-6 text-center px-8">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MessageSquare className="w-9 h-9 text-primary" />
              </div>
              <div>
                <p className="text-white font-bold text-xl">Select a persona</p>
                <p className="text-zinc-500 text-sm mt-2 max-w-xs leading-relaxed">Choose from the left to open a private anonymous chat room.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
