import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { motion } from "framer-motion";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, doc, setDoc, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useParams } from "wouter";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import { usePersonas } from "@/hooks/usePersonas";
import {
  type Persona, type Message,
  convId, formatTime, statusLabel,
} from "@/lib/personas";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const h = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return mobile;
}

/* ─── Status dot ─────────────────────────────────────────────────────────── */

const StatusDot = memo(function StatusDot({ status }: { status: Persona["status"] }) {
  const bg = status === "online" ? "#4ade80" : status === "typing" ? "#facc15" : "#52525b";
  return (
    <span style={{
      display: "block", width: 8, height: 8, borderRadius: "50%", background: bg,
      animation: status === "typing" ? "pulse 2s infinite" : undefined,
    }} />
  );
});

/* ─── Message bubble ─────────────────────────────────────────────────────── */

const MessageBubble = memo(function MessageBubble({
  msg, isMe, persona,
}: {
  msg: Message; isMe: boolean; persona: Persona;
}) {
  return (
    <div className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`} data-testid={`message-${msg.id}`}>
      {isMe
        ? <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-black text-xs font-black flex-shrink-0 self-end">Y</div>
        : <img src={persona.avatar} alt={persona.displayName} className="w-8 h-8 rounded-xl object-cover flex-shrink-0 self-end" />
      }
      <div className={`flex flex-col gap-1 max-w-[72%] ${isMe ? "items-end" : "items-start"}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
          isMe
            ? "bg-primary text-black font-semibold rounded-tr-sm shadow-[0_0_20px_rgba(250,204,21,0.15)]"
            : "bg-white/5 border border-white/8 text-white/90 rounded-tl-sm"
        }`}>
          {msg.text}
        </div>
        <span className="text-[10px] text-zinc-600 px-1">{formatTime(msg.createdAt)}</span>
      </div>
    </div>
  );
});

/* ─── Chat input ─────────────────────────────────────────────────────────── */

const ChatInput = memo(function ChatInput({
  cid, uid, persona, isMobile,
}: {
  cid: string; uid: string; persona: Persona; isMobile: boolean;
}) {
  const [text, setText]     = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [cid]);

  const send = useCallback(async () => {
    const t = text.trim();
    if (!t || sending) return;
    setText("");
    setSending(true);
    try {
      await addDoc(collection(db, "conversations", cid, "messages"), {
        sender: uid,
        text: t,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, "conversations", cid),
        { lastMessage: t, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "unknown";
      console.error("[ChatInput] send failed:", code, err);
      setText(t);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [cid, uid, text, sending]);

  const onKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  return (
    <div className="flex-shrink-0 px-4 py-4 border-t border-white/5 bg-black/60 backdrop-blur-xl">
      <div className="flex gap-3 items-end">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Message ${persona.displayName}...`}
          rows={1}
          style={{ minHeight: 50, maxHeight: 128 }}
          className="flex-1 bg-white/5 border border-white/10 focus:border-primary/50 rounded-2xl px-5 py-3 text-sm text-white placeholder:text-zinc-600 resize-none outline-none transition-all"
          data-testid="input-message"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="flex-shrink-0 p-3.5 rounded-2xl bg-primary text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
          data-testid="button-send"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      {isMobile && (
        <p className="text-[10px] text-zinc-700 mt-2 text-center">Enter to send · Shift+Enter for new line</p>
      )}
    </div>
  );
});

/* ─── Chat panel ─────────────────────────────────────────────────────────── */

const ChatPanel = memo(function ChatPanel({
  persona, uid, username, isMobile, onBack,
}: {
  persona: Persona; uid: string; username: string; isMobile: boolean; onBack: () => void;
}) {
  const cid = convId(uid, persona.username);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Create / touch the conversation document
  useEffect(() => {
    setDoc(
      doc(db, "conversations", cid),
      {
        personaId: persona.id,
        userId: uid,
        personaUsername: persona.username,
        personaName: persona.displayName,
        personaAvatar: persona.avatar,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((err: unknown) => {
      const code = (err as { code?: string }).code ?? "unknown";
      console.error("[ChatPanel] conversation touch failed:", code);
    });
  }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime messages listener
  useEffect(() => {
    const q = query(
      collection(db, "conversations", cid, "messages"),
      orderBy("createdAt", "asc"),
      limit(100)
    );
    return onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
      },
      (err: unknown) => {
        const code = (err as { code?: string }).code ?? "unknown";
        console.error("[ChatPanel] messages snapshot failed:", code);
      }
    );
  }, [cid]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: firstRender.current ? "auto" : "smooth" });
    firstRender.current = false;
  }, [messages.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-4 md:px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-xl flex-shrink-0">
        {isMobile && (
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-400 hover:text-white" data-testid="button-back-to-personas">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="relative flex-shrink-0">
          <img src={persona.avatar} alt={persona.displayName} className="w-10 h-10 rounded-xl object-cover" />
          <span className="absolute -bottom-0.5 -right-0.5"><StatusDot status={persona.status} /></span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-white text-base leading-none">{persona.displayName}</div>
          <div className="text-xs text-zinc-500 mt-1">{statusLabel(persona.status)}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4" data-testid="messages-container">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
            <img src={persona.avatar} alt={persona.displayName} className="w-16 h-16 rounded-2xl object-cover grayscale opacity-60" />
            <div>
              <p className="text-white font-bold text-lg">{persona.welcomeMessage || `${persona.displayName} is waiting.`}</p>
              <p className="text-zinc-500 text-sm mt-1">Break the silence. Say something.</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMe={msg.sender === uid}
            persona={persona}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <ChatInput cid={cid} uid={uid} persona={persona} isMobile={isMobile} />
    </div>
  );
});

/* ─── Persona sidebar item ───────────────────────────────────────────────── */

const PersonaItem = memo(function PersonaItem({
  persona, selected, onSelect,
}: {
  persona: Persona; selected: boolean; onSelect: (p: Persona) => void;
}) {
  return (
    <button
      onClick={() => onSelect(persona)}
      data-testid={`persona-${persona.username}`}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", background: selected ? "rgba(255,255,255,0.05)" : "transparent",
        border: "none", cursor: "pointer", textAlign: "left", position: "relative",
      }}
    >
      {selected && (
        <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2, height: 32, background: "var(--primary)", borderRadius: "0 2px 2px 0" }} />
      )}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <img
          src={persona.avatar}
          alt={persona.displayName}
          style={{
            width: 48, height: 48, borderRadius: 12, objectFit: "cover",
            filter: selected ? "none" : "grayscale(100%)",
            opacity: selected ? 1 : 0.7,
            transition: "filter 0.2s, opacity 0.2s",
          }}
        />
        <span style={{ position: "absolute", bottom: -2, right: -2 }}>
          <StatusDot status={persona.status} />
        </span>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: selected ? "white" : "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {persona.displayName}
        </div>
        <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>{statusLabel(persona.status)}</div>
      </div>
    </button>
  );
});

/* ─── Main Chat page ─────────────────────────────────────────────────────── */

export default function Chat() {
  const { userData, uid } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ persona?: string }>();
  const isMobile = useIsMobile();
  const { personas, loading } = usePersonas();

  const [selected, setSelected] = useState<Persona | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Seed from URL param once personas load
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !params.persona || personas.length === 0) return;
    const found = personas.find((p) => p.username === params.persona);
    if (found) { setSelected(found); setChatOpen(true); seeded.current = true; }
    else if (!loading) { seeded.current = true; }
  }, [personas, params.persona, loading]);

  const openPersona = useCallback((p: Persona) => {
    setSelected(p);
    setChatOpen(true);
  }, []);

  const onlineCount = useMemo(
    () => personas.filter((p) => p.status === "online" || p.status === "typing").length,
    [personas]
  );

  const showSidebar  = !isMobile || !chatOpen;
  const showChat     = !isMobile || chatOpen;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--background)", color: "var(--foreground)" }}>

      {/* Nav */}
      <motion.header
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-black/60 backdrop-blur-xl z-40 flex-shrink-0"
      >
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-400 hover:text-white" data-testid="button-back-home">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black tracking-[0.15em]">SHADOW<span className="text-primary">CHAT</span></h1>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
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
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* Sidebar */}
        <aside style={{
          display: showSidebar ? "flex" : "none",
          flexDirection: "column",
          width: isMobile ? "100%" : 320,
          flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(24px)",
        }}>
          <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Private Rooms</span>
            <span className="text-xs font-bold text-primary">{onlineCount} online</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingTop: 8, paddingBottom: 8 }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.06)", flexShrink: 0, animation: "pulse 2s infinite" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ height: 12, width: "60%", borderRadius: 6, background: "rgba(255,255,255,0.06)", animation: "pulse 2s infinite" }} />
                    <div style={{ height: 10, width: "40%", borderRadius: 6, background: "rgba(255,255,255,0.04)", animation: "pulse 2s infinite" }} />
                  </div>
                </div>
              ))
            ) : personas.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 20px", textAlign: "center", gap: 12 }}>
                <MessageSquare style={{ width: 32, height: 32, color: "#3f3f46" }} />
                <p style={{ color: "#52525b", fontSize: 13 }}>No personas yet.</p>
              </div>
            ) : (
              personas.map((p) => (
                <PersonaItem key={p.id} persona={p} selected={selected?.username === p.username} onSelect={openPersona} />
              ))
            )}
          </div>
        </aside>

        {/* Chat area */}
        <div style={{ display: showChat ? "flex" : "none", flex: 1, flexDirection: "column", minWidth: 0 }}>
          {selected && uid ? (
            <ChatPanel
              key={selected.username}
              persona={selected}
              uid={uid}
              username={userData?.username ?? ""}
              isMobile={isMobile}
              onBack={() => setChatOpen(false)}
            />
          ) : (
            <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
              <MessageSquare style={{ width: 48, height: 48, color: "#27272a" }} />
              <div>
                <p style={{ color: "white", fontWeight: 700, fontSize: 18 }}>Select a persona</p>
                <p style={{ color: "#52525b", fontSize: 14, marginTop: 6 }}>Choose someone from the left to start chatting.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
