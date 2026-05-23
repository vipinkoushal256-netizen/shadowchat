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

/* ─── Mobile detection (no Tailwind responsive classes needed) ─────────────── */

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    setMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

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
  isMobile,
}: {
  persona: Persona;
  uid: string;
  username: string;
  onBack: () => void;
  isMobile: boolean;
}) {
  const cid = makeChatId(uid, persona.slug);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  console.log("[ChatPanel] render — persona:", persona.slug, "cid:", cid);

  useEffect(() => {
    setDoc(
      doc(db, "chats", cid),
      { uid, username, personaName: persona.name, personaSlug: persona.slug, personaImage: persona.image, updatedAt: serverTimestamp() },
      { merge: true }
    ).catch((e) => console.error("[ChatPanel] metadata error:", e));
  }, [cid, uid, username, persona]);

  useEffect(() => {
    const q = query(collection(db, "chats", cid, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      console.log("[ChatPanel] snapshot count:", snap.size);
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) })));
    }, (err) => console.error("[ChatPanel] snapshot error:", err));
    return unsub;
  }, [cid]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
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
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4" data-testid="messages-container">
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: 16, padding: "80px 0" }}>
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
      <div className="flex-shrink-0 px-4 py-4 border-t border-white/5 bg-black/60 backdrop-blur-xl">
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
  const isMobile = useIsMobile();

  // selectedChat + chatOpen are the ONLY drivers of what renders.
  // No navigate() is called on click — that was causing wouter remounts.
  const [selectedChat, setSelectedChat] = useState<Persona | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Seed once on mount from URL params (supports direct links / browser refresh)
  const didSeed = useRef(false);
  useEffect(() => {
    if (didSeed.current) return;
    didSeed.current = true;
    const slug = params.persona;
    console.log("[Chat] seed — params.persona:", slug);
    if (slug) {
      const found = PERSONAS.find((x) => x.slug === slug) ?? null;
      console.log("[Chat] seed found:", found?.name ?? "null");
      setSelectedChat(found);
      setChatOpen(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openPersona(p: Persona) {
    console.log("[Chat] openPersona:", p.slug, "isMobile:", isMobile, "user:", !!user);
    setSelectedChat(p);
    setChatOpen(true);
    // navigate() NOT called here — it causes wouter to remount and wipe state
  }

  function goBack() {
    console.log("[Chat] goBack");
    setChatOpen(false);
  }

  const showChatPanel = selectedChat !== null && user !== null;

  console.log("[Chat] render — selectedChat:", selectedChat?.slug ?? "null", "chatOpen:", chatOpen, "showChatPanel:", showChatPanel, "isMobile:", isMobile, "user:", !!user);

  // Layout logic (pure JS — zero reliance on Tailwind responsive classes):
  // Mobile: show sidebar XOR chat panel depending on chatOpen
  // Desktop: always show sidebar; show chat panel on right
  const showSidebar = !isMobile || !chatOpen;
  const showChatArea = !isMobile || chatOpen;

  console.log("[Chat] layout — showSidebar:", showSidebar, "showChatArea:", showChatArea);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--background)", color: "var(--foreground)" }}>
      {/* Nav */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
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

      {/* Body — pure inline-style layout, zero Tailwind responsive classes */}
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
            <span className="text-xs font-bold text-primary">{PERSONAS.filter((p) => p.status === "Online").length} online</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingTop: 8, paddingBottom: 8 }}>
            {PERSONAS.map((persona) => (
              <button
                key={persona.slug}
                onClick={() => openPersona(persona)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  background: selectedChat?.slug === persona.slug ? "rgba(255,255,255,0.05)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  position: "relative",
                  transition: "background 0.2s",
                }}
                data-testid={`persona-${persona.slug}`}
                onMouseEnter={(e) => { if (selectedChat?.slug !== persona.slug) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { if (selectedChat?.slug !== persona.slug) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {selectedChat?.slug === persona.slug && (
                  <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2, height: 32, background: "var(--primary)", borderRadius: "0 2px 2px 0" }} />
                )}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={persona.image}
                    alt={persona.name}
                    style={{
                      width: 48, height: 48, borderRadius: 12, objectFit: "cover",
                      filter: selectedChat?.slug === persona.slug ? "none" : "grayscale(100%)",
                      opacity: selectedChat?.slug === persona.slug ? 1 : 0.7,
                      transition: "all 0.3s",
                    }}
                  />
                  <span style={{ position: "absolute", bottom: -2, right: -2 }}>
                    <span style={{
                      display: "block", width: 8, height: 8, borderRadius: "50%",
                      background: persona.status === "Online" ? "#4ade80" : persona.status === "Typing..." ? "#facc15" : "#52525b",
                    }} />
                  </span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: selectedChat?.slug === persona.slug ? "white" : "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{persona.name}</div>
                  <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>{persona.status}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "var(--primary)" }}>{persona.points}</div>
                  <div style={{ fontSize: 9, color: "#3f3f46", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>pts</div>
                </div>
              </button>
            ))}
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

        {/* Chat area — visible on desktop always; on mobile only when chatOpen */}
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
              key={selectedChat.slug}
              persona={selectedChat}
              uid={user!.uid}
              username={userData?.username ?? user!.uid}
              onBack={goBack}
              isMobile={isMobile}
            />
          ) : (
            /* Desktop placeholder — only shown when no persona selected */
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
