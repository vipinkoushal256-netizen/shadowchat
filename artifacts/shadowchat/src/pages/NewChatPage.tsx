/**
 * NewChatPage.tsx — fully isolated, no old code.
 * Auth via authReady promise from firebase.ts (module-level eager sign-in).
 * Firestore via firestoreService only.
 */

import { useState, useEffect, useRef } from "react";
import { authReady } from "@/lib/firebase";
import {
  subscribePersonas, subscribeMessages,
  sendUserMessage, touchConversation,
  type FSPersona, type FSMessage,
} from "@/services/firestoreService";

/* ── Styles ─────────────────────────────────────────────────────────────── */

const S = {
  page: { height: "100dvh", display: "flex", flexDirection: "column" as const, background: "#060606", color: "white", fontFamily: "system-ui, sans-serif", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.6)", flexShrink: 0 },
  title: { fontSize: 18, fontWeight: 900, letterSpacing: "0.12em", margin: 0 },
  body: { display: "flex", flex: 1, overflow: "hidden", minHeight: 0 },
  sidebar: { width: 280, flexShrink: 0, display: "flex", flexDirection: "column" as const, borderRight: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.3)", overflow: "hidden" },
  sidebarLabel: { padding: "10px 16px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.15em", color: "#52525b", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  sidebarList: { flex: 1, overflowY: "auto" as const },
  personaBtn: (active: boolean): React.CSSProperties => ({
    width: "100%", display: "flex", alignItems: "center", gap: 12,
    padding: "12px 16px", border: "none", cursor: "pointer", textAlign: "left",
    background: active ? "rgba(250,204,21,0.07)" : "transparent",
    borderLeft: active ? "2px solid #facc15" : "2px solid transparent",
  }),
  avatar: { width: 44, height: 44, borderRadius: 12, objectFit: "cover" as const, flexShrink: 0, background: "#1a1a1a" },
  dot: (status: string): React.CSSProperties => ({ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: status === "online" ? "#4ade80" : status === "typing" ? "#facc15" : "#52525b" }),
  chatArea: { flex: 1, display: "flex", flexDirection: "column" as const, minWidth: 0 },
  chatHeader: { display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.4)", flexShrink: 0 },
  messages: { flex: 1, overflowY: "auto" as const, padding: "20px 24px", display: "flex", flexDirection: "column" as const, gap: 12 },
  bubble: (isMe: boolean): React.CSSProperties => ({ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "68%", padding: "10px 16px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? "#facc15" : "rgba(255,255,255,0.07)", color: isMe ? "#000" : "white", fontSize: 14, lineHeight: 1.5, fontWeight: isMe ? 600 : 400, wordBreak: "break-word" as const }),
  time: { fontSize: 10, color: "#52525b", marginTop: 2 },
  inputRow: { display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.5)", flexShrink: 0 },
  input: { flex: 1, padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14, outline: "none" },
  sendBtn: (disabled: boolean): React.CSSProperties => ({ padding: "12px 20px", borderRadius: 14, border: "none", background: disabled ? "rgba(250,204,21,0.3)" : "#facc15", color: "#000", fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", fontSize: 14 }),
  errBanner: { padding: "6px 16px", background: "#450a0a", fontSize: 12, color: "#fca5a5", textAlign: "center" as const },
  center: { flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", color: "#52525b", gap: 8, textAlign: "center" as const },
};

function fmtTime(ts: { toDate: () => Date } | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function convId(uid: string, personaUsername: string) {
  return `${uid}_${personaUsername}`;
}

/* ── ChatPanel ───────────────────────────────────────────────────────────── */

function ChatPanel({ persona, uid }: { persona: FSPersona; uid: string }) {
  const cid = convId(uid, persona.username);
  const [messages, setMessages] = useState<FSMessage[]>([]);
  const [text,     setText]     = useState("");
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    touchConversation(cid, uid, persona).catch((e: unknown) =>
      console.error("[NewChatPage] touch failed:", (e as { code?: string }).code)
    );
    const unsub = subscribeMessages(cid, setMessages, (code) => setError("Read failed: " + code));
    return unsub;
  }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, [persona.username]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setText("");
    setSending(true);
    setError("");
    try {
      await sendUserMessage(cid, uid, t);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "unknown";
      console.error("[NewChatPage] send failed:", code, e);
      setError("Send failed: " + code);
      setText(t);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div style={S.chatArea}>
      <div style={S.chatHeader}>
        {persona.avatar && <img src={persona.avatar} alt={persona.displayName} style={{ ...S.avatar, width: 40, height: 40 }} />}
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{persona.displayName}</div>
          <div style={{ fontSize: 11, color: persona.status === "online" ? "#4ade80" : persona.status === "typing" ? "#facc15" : "#52525b" }}>
            {persona.status === "online" ? "Online" : persona.status === "typing" ? "Typing…" : "Away"}
          </div>
        </div>
      </div>

      {error && <div style={S.errBanner}>{error}</div>}

      <div style={S.messages}>
        {messages.length === 0 && (
          <div style={{ alignSelf: "center", color: "#3f3f46", fontSize: 13, marginTop: 40 }}>
            {persona.welcomeMessage || "Say something…"}
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender === uid;
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              <div style={S.bubble(isMe)}>{msg.text}</div>
              <div style={{ ...S.time, textAlign: isMe ? "right" : "left" }}>{fmtTime(msg.createdAt)}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={S.inputRow}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`Message ${persona.displayName}…`}
          style={S.input}
        />
        <button onClick={send} disabled={!text.trim() || sending} style={S.sendBtn(!text.trim() || sending)}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

/* ── NewChatPage ─────────────────────────────────────────────────────────── */

export default function NewChatPage() {
  const [uid,      setUid]      = useState<string | null>(null);
  const [authErr,  setAuthErr]  = useState("");
  const [personas, setPersonas] = useState<FSPersona[]>([]);
  const [fsErr,    setFsErr]    = useState("");
  const [selected, setSelected] = useState<FSPersona | null>(null);

  // Wait for module-level auth to complete, then start Firestore subscription
  useEffect(() => {
    authReady
      .then((user) => {
        console.log("[NewChatPage] auth ready uid=", user.uid.slice(0, 8));
        setUid(user.uid);
      })
      .catch((err: unknown) => {
        const code = (err as { code?: string }).code ?? "unknown";
        console.error("[NewChatPage] auth failed:", code);
        setAuthErr("Sign-in failed: " + code);
      });
  }, []);

  useEffect(() => {
    if (!uid) return;
    console.log("[NewChatPage] subscribing personas uid=", uid.slice(0, 8));
    return subscribePersonas(
      (list) => { setPersonas(list); setFsErr(""); },
      (code) => setFsErr(
        code === "permission-denied"
          ? "Firestore permission-denied — update security rules in Firebase Console"
          : "Firestore error: " + code
      )
    );
  }, [uid]);

  if (authErr) {
    return <div style={{ ...S.page, alignItems: "center", justifyContent: "center" }}><p style={{ color: "#f87171" }}>{authErr}</p></div>;
  }

  if (!uid) {
    return <div style={{ ...S.page, alignItems: "center", justifyContent: "center", fontSize: 14, color: "#52525b" }}>Connecting…</div>;
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>SHADOW<span style={{ color: "#facc15" }}>CHAT</span></h1>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", padding: "4px 12px", borderRadius: 20, background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.2)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#facc15" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#facc15" }}>LIVE</span>
        </div>
      </div>

      {fsErr && <div style={S.errBanner}>{fsErr}</div>}

      <div style={S.body}>
        <aside style={S.sidebar}>
          <div style={S.sidebarLabel}>Private Rooms</div>
          <div style={S.sidebarList}>
            {personas.length === 0 ? (
              <div style={{ padding: "24px 16px", fontSize: 13, color: "#3f3f46", textAlign: "center" }}>
                {fsErr ? "No access to personas" : "Loading personas…"}
              </div>
            ) : personas.map((p) => (
              <button key={p.id} onClick={() => setSelected(p)} style={S.personaBtn(selected?.id === p.id)}>
                {p.avatar
                  ? <img src={p.avatar} alt={p.displayName} style={S.avatar} />
                  : <div style={{ ...S.avatar, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#facc15" }}>{p.displayName[0]}</div>
                }
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: selected?.id === p.id ? "white" : "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.displayName}</div>
                  <div style={{ fontSize: 11, color: "#52525b" }}>{p.bio?.slice(0, 30)}</div>
                </div>
                <span style={S.dot(p.status)} />
              </button>
            ))}
          </div>
        </aside>

        {selected ? (
          <ChatPanel key={selected.id} persona={selected} uid={uid} />
        ) : (
          <div style={S.center}>
            <div style={{ fontSize: 32 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#71717a" }}>Select a persona to start chatting</div>
          </div>
        )}
      </div>
    </div>
  );
}
