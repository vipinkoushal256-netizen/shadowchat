import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
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
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useParams } from "wouter";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import { usePersonas } from "@/hooks/usePersonas";
import {
  type Persona,
  type Message,
  makeConversationId,
  formatTime,
  formatPoints,
  statusLabel,
} from "@/lib/personas";

/* ─── Mobile detection ──────────────────────────────────────────────────── */

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

/* ─── Status dot ─────────────────────────────────────────────────────────── */

const StatusDot = memo(function StatusDot({ status }: { status: Persona["status"] }) {
  const bg =
    status === "online" ? "#4ade80" :
    status === "typing"  ? "#facc15" :
    "#52525b";
  return (
    <span style={{
      display: "block", width: 8, height: 8, borderRadius: "50%", background: bg,
      animation: status === "typing" ? "pulse 2s infinite" : undefined,
    }} />
  );
});

/* ─── Individual message bubble ──────────────────────────────────────────── */

const MessageItem = memo(function MessageItem({
  msg,
  isMe,
  personaAvatar,
  personaDisplayName,
}: {
  msg: Message;
  isMe: boolean;
  personaAvatar: string;
  personaDisplayName: string;
}) {
  return (
    <div
      className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}
      data-testid={`message-${msg.id}`}
    >
      {isMe
        ? <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-black text-xs font-black flex-shrink-0 self-end">Y</div>
        : <img src={personaAvatar} alt={personaDisplayName} className="w-8 h-8 rounded-xl object-cover flex-shrink-0 self-end" />
      }
      <div className={`flex flex-col gap-1 max-w-[72%] ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && <span className="text-[11px] font-bold text-zinc-500 px-1">{msg.persona}</span>}
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
          isMe
            ? "bg-primary text-black font-semibold rounded-tr-sm shadow-[0_0_20px_rgba(250,204,21,0.15)]"
            : "bg-white/5 border border-white/8 text-white/90 rounded-tl-sm"
        }`}>
          {msg.text}
        </div>
        <span className="text-[10px] text-zinc-600 font-medium px-1">{formatTime(msg.timestamp)}</span>
      </div>
    </div>
  );
});

/* ─── Chat messages list — isolated so input keystrokes can't re-render it ─ */

const ChatMessages = memo(function ChatMessages({
  messages,
  uid,
  persona,
  personasMap,
}: {
  messages: Message[];
  uid: string;
  persona: Persona;
  personasMap: Map<string, Persona>;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({
      behavior: isFirstRender.current ? "auto" : "smooth",
    });
    isFirstRender.current = false;
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4" data-testid="messages-container">
      {messages.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: 16, padding: "80px 0" }}>
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10">
            <img src={persona.avatar} alt={persona.displayName} className="w-full h-full object-cover grayscale opacity-60" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">
              {persona.welcomeMessage || `${persona.displayName} is waiting.`}
            </p>
            <p className="text-zinc-500 text-sm mt-1">Break the silence. Say something.</p>
          </div>
        </div>
      )}
      {messages.map((msg) => {
        const isMe = msg.senderId === uid;
        const pFor = personasMap.get(msg.persona ?? "") ?? persona;
        return (
          <MessageItem
            key={msg.id}
            msg={msg}
            isMe={isMe}
            personaAvatar={pFor.avatar}
            personaDisplayName={pFor.displayName}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
});

/* ─── Chat input — isolated so typing NEVER re-renders the message list ──── */

const ChatInput = memo(function ChatInput({
  cid,
  uid,
  personaDisplayName,
  personaPlaceholder,
  isMobile,
  onBack,
}: {
  cid: string;
  uid: string;
  personaDisplayName: string;
  personaPlaceholder: string;
  isMobile: boolean;
  onBack: () => void;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus immediately on mount / persona change
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [cid]);

  // Use a ref to always capture the latest input/sending without stale closure
  const inputRef2 = useRef(input);
  const sendingRef = useRef(sending);
  useEffect(() => { inputRef2.current = input; }, [input]);
  useEffect(() => { sendingRef.current = sending; }, [sending]);

  const send = useCallback(async () => {
    const text = inputRef2.current.trim();
    if (!text || sendingRef.current) return;

    // Instant clear — don't wait for async
    setInput("");
    setSending(true);

    try {
      await addDoc(collection(db, "conversations", cid, "messages"), {
        senderId: uid,
        text,
        timestamp: serverTimestamp(),
        persona: personaDisplayName,
      });
      await setDoc(
        doc(db, "conversations", cid),
        { lastMessage: text, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      if (import.meta.env.DEV) console.error("[ChatInput] send error:", e);
      setInput(text); // restore on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [cid, uid, personaDisplayName]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }, [send]);

  return (
    <div className="flex-shrink-0 px-4 py-4 border-t border-white/5 bg-black/60 backdrop-blur-xl">
      <div className="flex gap-3 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${personaPlaceholder}...`}
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
      {isMobile && (
        <p className="text-[10px] text-zinc-700 font-medium mt-2 text-center">Enter to send · Shift+Enter for new line</p>
      )}
    </div>
  );
});

/* ─── Chat panel header ──────────────────────────────────────────────────── */

const ChatHeader = memo(function ChatHeader({
  persona,
  isMobile,
  onBack,
}: {
  persona: Persona;
  isMobile: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 md:px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-xl flex-shrink-0">
      {isMobile && (
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
          data-testid="button-back-to-personas"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <div className="relative flex-shrink-0">
        <img src={persona.avatar} alt={persona.displayName} className="w-10 h-10 rounded-xl object-cover" />
        <span className="absolute -bottom-0.5 -right-0.5"><StatusDot status={persona.status} /></span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-white text-base leading-none">{persona.displayName}</div>
        <div className="text-xs text-zinc-500 mt-1 font-medium">{statusLabel(persona.status)}</div>
      </div>
      <div className="text-right">
        <div className="text-xs font-black text-primary">{formatPoints(persona.points)}</div>
        <div className="text-[9px] text-zinc-600 uppercase tracking-wide font-bold">pts</div>
      </div>
    </div>
  );
});

/* ─── Chat panel — holds messages state; input/header/messages are isolated ─ */

const ChatPanel = memo(function ChatPanel({
  persona,
  personas,
  uid,
  username,
  onBack,
  isMobile,
}: {
  persona: Persona;
  personas: Persona[];
  uid: string;
  username: string;
  onBack: () => void;
  isMobile: boolean;
}) {
  const cid = makeConversationId(uid, persona.username);
  const [messages, setMessages] = useState<Message[]>([]);

  // Build a displayName→Persona map for O(1) lookup per message bubble
  const personasMap = useMemo(
    () => new Map(personas.map((p) => [p.displayName, p])),
    [personas]
  );

  // Write/merge conversation metadata once when the conversation opens
  useEffect(() => {
    setDoc(
      doc(db, "conversations", cid),
      {
        uid, username,
        personaName: persona.displayName,
        personaSlug: persona.username,
        personaImage: persona.avatar,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((e) => {
      if (import.meta.env.DEV) console.error("[ChatPanel] metadata error:", e);
    });
  }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Firestore real-time listener — limited to last 100 messages
  useEffect(() => {
    const q = query(
      collection(db, "conversations", cid, "messages"),
      orderBy("timestamp", "asc"),
      limit(100)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) })));
      },
      (err) => {
        if (import.meta.env.DEV) console.error("[ChatPanel] snapshot error:", err);
      }
    );
    return unsub;
  }, [cid]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <ChatHeader persona={persona} isMobile={isMobile} onBack={onBack} />
      <ChatMessages messages={messages} uid={uid} persona={persona} personasMap={personasMap} />
      <ChatInput
        cid={cid}
        uid={uid}
        personaDisplayName={persona.displayName}
        personaPlaceholder={persona.displayName}
        isMobile={isMobile}
        onBack={onBack}
      />
    </div>
  );
});

/* ─── Persona sidebar item ───────────────────────────────────────────────── */

const PersonaItem = memo(function PersonaItem({
  persona,
  isSelected,
  onSelect,
}: {
  persona: Persona;
  isSelected: boolean;
  onSelect: (p: Persona) => void;
}) {
  const handleClick = useCallback(() => onSelect(persona), [onSelect, persona]);

  return (
    <button
      onClick={handleClick}
      data-testid={`persona-${persona.username}`}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        background: isSelected ? "rgba(255,255,255,0.05)" : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {isSelected && (
        <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2, height: 32, background: "var(--primary)", borderRadius: "0 2px 2px 0" }} />
      )}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {persona.avatar
          ? <img
              src={persona.avatar}
              alt={persona.displayName}
              style={{
                width: 48, height: 48, borderRadius: 12, objectFit: "cover",
                filter: isSelected ? "none" : "grayscale(100%)",
                opacity: isSelected ? 1 : 0.7,
                transition: "filter 0.2s, opacity 0.2s",
              }}
            />
          : <div style={{
              width: 48, height: 48, borderRadius: 12, background: "rgba(250,204,21,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 900, color: "#facc15",
              filter: isSelected ? "none" : "grayscale(100%)",
              opacity: isSelected ? 1 : 0.5,
            }}>{persona.displayName[0]}</div>
        }
        <span style={{ position: "absolute", bottom: -2, right: -2 }}>
          <StatusDot status={persona.status} />
        </span>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? "white" : "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {persona.displayName}
        </div>
        <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>{statusLabel(persona.status)}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "var(--primary)" }}>{formatPoints(persona.points)}</div>
        <div style={{ fontSize: 9, color: "#3f3f46", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>pts</div>
      </div>
    </button>
  );
});

/* ─── Sidebar persona list ───────────────────────────────────────────────── */

const PersonaList = memo(function PersonaList({
  personas,
  loading,
  selectedUsername,
  onSelect,
}: {
  personas: Persona[];
  loading: boolean;
  selectedUsername: string | null;
  onSelect: (p: Persona) => void;
}) {
  const showSkeletons = loading && personas.length === 0;

  if (showSkeletons) {
    return (
      <>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.06)", flexShrink: 0, animation: "pulse 2s infinite" }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ height: 12, width: "60%", borderRadius: 6, background: "rgba(255,255,255,0.06)", animation: "pulse 2s infinite" }} />
              <div style={{ height: 10, width: "40%", borderRadius: 6, background: "rgba(255,255,255,0.04)", animation: "pulse 2s infinite" }} />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (personas.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 20px", textAlign: "center", gap: 12 }}>
        <MessageSquare style={{ width: 32, height: 32, color: "#3f3f46" }} />
        <p style={{ color: "#52525b", fontSize: 13 }}>No personas yet. The admin needs to create some.</p>
      </div>
    );
  }

  return (
    <>
      {personas.map((persona) => (
        <PersonaItem
          key={persona.username}
          persona={persona}
          isSelected={selectedUsername === persona.username}
          onSelect={onSelect}
        />
      ))}
    </>
  );
});

/* ─── Main Chat page ─────────────────────────────────────────────────────── */

export default function Chat() {
  const { userData, uid } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ persona?: string }>();
  const isMobile = useIsMobile();
  const { personas, loading: personasLoading } = usePersonas();

  const [selectedChat, setSelectedChat] = useState<Persona | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Seed from URL params — retry until persona is found or limit reached
  const didSeed = useRef(false);
  const seedAttempts = useRef(0);
  const seedSlug = useRef<string | null>(params.persona ?? null);
  useEffect(() => {
    if (didSeed.current) return;
    const slug = seedSlug.current;
    if (!slug) { didSeed.current = true; return; }
    seedAttempts.current++;
    const found = personas.find((x) => x.username === slug) ?? null;
    if (found) {
      didSeed.current = true;
      setSelectedChat(found);
      setChatOpen(true);
    } else if (seedAttempts.current >= 3) {
      didSeed.current = true;
    }
  }, [personas]);

  const openPersona = useCallback((p: Persona) => {
    setSelectedChat(p);
    setChatOpen(true);
  }, []);

  const goBack = useCallback(() => {
    setChatOpen(false);
  }, []);

  const onlineCount = useMemo(
    () => personas.filter((p) => p.status === "online" || p.status === "typing").length,
    [personas]
  );

  const showChatPanel = selectedChat !== null && uid !== "";
  const showSidebar   = !isMobile || !chatOpen;
  const showChatArea  = !isMobile || chatOpen;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--background)", color: "var(--foreground)" }}>
      {/* Nav */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, once: true } as Parameters<typeof motion.header>[0]["transition"]}
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
        <aside
          style={{
            display: showSidebar ? "flex" : "none",
            flexDirection: "column",
            width: isMobile ? "100%" : 320,
            flexShrink: 0,
            borderRight: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Private Rooms</span>
            <span className="text-xs font-bold text-primary">{onlineCount} online</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingTop: 8, paddingBottom: 8 }}>
            <PersonaList
              personas={personas}
              loading={personasLoading}
              selectedUsername={selectedChat?.username ?? null}
              onSelect={openPersona}
            />
          </div>

          <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ borderRadius: 16, padding: 16, background: "linear-gradient(135deg, var(--primary), #f97316)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, right: 0, width: 64, height: 64, background: "rgba(255,255,255,0.2)", borderRadius: "50%", filter: "blur(16px)", transform: "translate(12px,-12px)" }} />
              <div style={{ position: "relative", zIndex: 1, color: "#000" }}>
                <div style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.7 }}>Bonus System</div>
                <div style={{ fontSize: 14, fontWeight: 900, marginTop: 2 }}>Earn More Points</div>
                <p style={{ fontSize: 10, opacity: 0.7, marginTop: 2, fontWeight: 500 }}>Active chats multiply rewards.</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Chat area */}
        <div
          style={{
            display: showChatArea ? "flex" : "none",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {showChatPanel ? (
            <ChatPanel
              key={selectedChat.username}
              persona={selectedChat}
              personas={personas}
              uid={uid}
              username={userData?.username ?? uid}
              onBack={goBack}
              isMobile={isMobile}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: 24, padding: "0 32px" }}>
              <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageSquare style={{ width: 36, height: 36, color: "var(--primary)" }} />
              </div>
              <div>
                <p style={{ color: "white", fontWeight: 700, fontSize: 20 }}>Select a persona</p>
                <p style={{ color: "#71717a", fontSize: 14, marginTop: 8, maxWidth: 280, lineHeight: 1.6 }}>Choose from the left to open a private anonymous chat room.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
