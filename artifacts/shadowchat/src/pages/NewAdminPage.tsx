/**
 * NewAdminPage.tsx — fully isolated, no old code.
 * Auth via authReady promise from firebase.ts (module-level eager sign-in).
 * PIN: shadow2024
 */

import { useState, useEffect, useRef } from "react";
import { authReady } from "@/lib/firebase";
import {
  subscribePersonas, subscribeConversations, subscribeMessages,
  createPersona, updatePersona, deletePersona, setPersonaStatus,
  sendAdminReply,
  type FSPersona, type FSConversation, type FSMessage,
} from "@/services/firestoreService";

/* ── Shared styles ───────────────────────────────────────────────────────── */

const S = {
  page:      { height: "100dvh", display: "flex", flexDirection: "column" as const, background: "#060606", color: "white", fontFamily: "system-ui, sans-serif", overflow: "hidden" },
  header:    { display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.6)", flexShrink: 0 },
  title:     { fontSize: 18, fontWeight: 900, letterSpacing: "0.12em", margin: 0 },
  body:      { display: "flex", flex: 1, overflow: "hidden", minHeight: 0 },
  input:     { padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" as const },
  label:     { fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: 5 },
  btn:       (v: "primary" | "danger" | "ghost"): React.CSSProperties => ({ padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: v === "primary" ? "#facc15" : v === "danger" ? "#ef4444" : "rgba(255,255,255,0.07)", color: v === "primary" ? "#000" : "white" }),
  errBanner: { padding: "6px 16px", background: "#450a0a", fontSize: 12, color: "#fca5a5", textAlign: "center" as const },
};

function fmtTime(ts: { toDate: () => Date } | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ── PIN Gate ────────────────────────────────────────────────────────────── */

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === "shadow2024") { onUnlock(); return; }
    setErr(true); setPin("");
    setTimeout(() => setErr(false), 1500);
  }

  return (
    <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#060606" }}>
      <form onSubmit={submit} style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 36, width: 320, textAlign: "center", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.12em" }}>SHADOW<span style={{ color: "#facc15" }}>ADMIN</span></div>
        <p style={{ fontSize: 13, color: "#52525b", margin: 0 }}>Enter admin PIN</p>
        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••••••" autoFocus
          style={{ ...S.input, textAlign: "center", fontSize: 18, letterSpacing: "0.25em", borderColor: err ? "#ef4444" : "rgba(255,255,255,0.1)" }} />
        {err && <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>Wrong PIN</p>}
        <button type="submit" style={S.btn("primary")}>Unlock</button>
      </form>
    </div>
  );
}

/* ── NewPersonaModal ─────────────────────────────────────────────────────── */

function NewPersonaModal({ mode, persona, onClose }: { mode: "create" | "edit"; persona?: FSPersona; onClose: () => void }) {
  const [displayName,    setDisplayName]    = useState(persona?.displayName    ?? "");
  const [username,       setUsername]       = useState(persona?.username       ?? "");
  const [avatar,         setAvatar]         = useState(persona?.avatar         ?? "");
  const [bio,            setBio]            = useState(persona?.bio            ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(persona?.welcomeMessage ?? "");
  const [status,         setStatus]         = useState<FSPersona["status"]>(persona?.status ?? "online");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    if (mode === "create") setUsername(displayName.toLowerCase().replace(/[^a-z0-9]/g, ""));
  }, [displayName, mode]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { setError("Display name is required"); return; }
    if (!username.trim())    { setError("Username is required"); return; }
    setSaving(true); setError("");
    try {
      const data = { displayName: displayName.trim(), username: username.trim(), avatar: avatar.trim(), bio: bio.trim(), welcomeMessage: welcomeMessage.trim(), status };
      if (mode === "create") await createPersona(data);
      else                   await updatePersona(persona!.id, data);
      onClose();
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "unknown";
      const msg  = e instanceof Error ? e.message : String(e);
      console.error("[NewPersonaModal] save failed:", code, msg);
      setError("[" + code + "] " + msg);
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{mode === "create" ? "New Persona" : "Edit Persona"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: 20 }}>×</button>
        </div>
        <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={S.label}>Display Name *</label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="MidnightSoul" style={S.input} autoFocus /></div>
          <div><label style={S.label}>Username *</label><input value={username} onChange={(e) => mode === "create" && setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} placeholder="midnightsoul" style={{ ...S.input, opacity: mode === "edit" ? 0.5 : 1 }} readOnly={mode === "edit"} /></div>
          <div><label style={S.label}>Avatar URL</label><input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" style={S.input} /></div>
          <div><label style={S.label}>Bio</label><input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short description" style={S.input} /></div>
          <div><label style={S.label}>Welcome Message</label><input value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} placeholder="First thing they see" style={S.input} /></div>
          <div>
            <label style={S.label}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as FSPersona["status"])} style={{ ...S.input, cursor: "pointer" }}>
              <option value="online">Online</option>
              <option value="typing">Typing…</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          {error && <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={{ ...S.btn("ghost"), flex: 1 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...S.btn("primary"), flex: 2, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── PersonasTab ─────────────────────────────────────────────────────────── */

function PersonasTab({ personas }: { personas: FSPersona[] }) {
  const [modal,    setModal]    = useState<{ mode: "create" } | { mode: "edit"; p: FSPersona } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this persona? This cannot be undone.")) return;
    setDeleting(id);
    try { await deletePersona(id); }
    catch (e: unknown) { console.error("[PersonasTab] delete failed:", (e as { code?: string }).code, e); alert("Delete failed — check console for the error code."); }
    finally { setDeleting(null); }
  }

  async function handleToggle(p: FSPersona) {
    const next: FSPersona["status"] = p.status === "offline" ? "online" : "offline";
    try { await setPersonaStatus(p.id, next); }
    catch (e: unknown) { console.error("[PersonasTab] toggle failed:", (e as { code?: string }).code, e); }
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Personas</div>
          <div style={{ fontSize: 12, color: "#52525b" }}>{personas.length} on platform</div>
        </div>
        <button onClick={() => setModal({ mode: "create" })} style={S.btn("primary")}>+ New Persona</button>
      </div>

      {personas.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#3f3f46", fontSize: 14 }}>No personas yet. Create one to get started.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {personas.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14 }}>
            {p.avatar
              ? <img src={p.avatar} alt={p.displayName} style={{ width: 50, height: 50, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
              : <div style={{ width: 50, height: 50, borderRadius: 12, background: "rgba(250,204,21,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, color: "#facc15", flexShrink: 0 }}>{p.displayName[0]}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.displayName}</span>
                <span style={{ fontSize: 10, color: "#3f3f46", fontFamily: "monospace" }}>/{p.username}</span>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.status === "online" ? "#4ade80" : p.status === "typing" ? "#facc15" : "#52525b", flexShrink: 0 }} />
              </div>
              {p.bio && <div style={{ fontSize: 11, color: "#52525b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.bio}</div>}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => handleToggle(p)} title="Toggle status" style={{ ...S.btn("ghost"), padding: "8px 10px", color: p.status !== "offline" ? "#4ade80" : "#52525b" }}>
                {p.status !== "offline" ? "🟢" : "⚫"}
              </button>
              <button onClick={() => setModal({ mode: "edit", p })} style={{ ...S.btn("ghost"), padding: "8px 10px" }}>✏️</button>
              <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} style={{ ...S.btn("danger"), padding: "8px 10px", opacity: deleting === p.id ? 0.5 : 1 }}>
                {deleting === p.id ? "…" : "🗑"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <NewPersonaModal
          mode={modal.mode}
          persona={modal.mode === "edit" ? modal.p : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/* ── AdminChatWindow ─────────────────────────────────────────────────────── */

function AdminChatWindow({ conv, personas }: { conv: FSConversation; personas: FSPersona[] }) {
  const [messages, setMessages] = useState<FSMessage[]>([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState("");
  const [replyAs,  setReplyAs]  = useState<FSPersona | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (personas.length === 0) return;
    setReplyAs((cur) => cur ?? (personas.find((p) => p.username === conv.personaUsername) ?? personas[0]));
  }, [personas, conv.personaUsername]);

  useEffect(() => {
    return subscribeMessages(conv.id, setMessages, (code) => setError("Messages failed: " + code));
  }, [conv.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, [conv.id]);

  async function send() {
    if (!replyAs) return;
    const t = input.trim();
    if (!t || sending) return;
    setInput(""); setSending(true); setError("");
    try {
      await sendAdminReply(conv.id, replyAs.username, t);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "unknown";
      console.error("[AdminChatWindow] send failed:", code, e);
      setError("Send failed: " + code);
      setInput(t);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const isUser = (msg: FSMessage) => msg.sender === conv.userId;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.4)", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
        {conv.personaAvatar && <img src={conv.personaAvatar} alt={conv.personaName} style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: "#facc15" }}>{conv.personaName}</span>
            <span style={{ color: "#3f3f46", margin: "0 6px" }}>↔</span>
            <span style={{ fontFamily: "monospace", color: "#71717a", fontSize: 11 }}>{conv.userId.slice(0, 12)}…</span>
          </div>
          <div style={{ fontSize: 10, color: "#52525b" }}>{fmtTime(conv.updatedAt)}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80" }}>LIVE</span>
        </div>
      </div>

      {error && <div style={S.errBanner}>{error}</div>}

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && <div style={{ textAlign: "center", color: "#3f3f46", fontSize: 13, marginTop: 40 }}>No messages yet.</div>}
        {messages.map((msg) => {
          const user = isUser(msg);
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: user ? "flex-start" : "flex-end" }}>
              <div style={{ fontSize: 10, color: "#52525b", marginBottom: 2 }}>{user ? "user" : msg.sender}</div>
              <div style={{ maxWidth: "68%", padding: "10px 16px", borderRadius: user ? "16px 16px 16px 4px" : "16px 16px 4px 16px", background: user ? "rgba(255,255,255,0.07)" : "#facc15", color: user ? "white" : "#000", fontSize: 14, fontWeight: user ? 400 : 600, wordBreak: "break-word" }}>
                {msg.text}
              </div>
              <div style={{ fontSize: 10, color: "#3f3f46", marginTop: 2 }}>{fmtTime(msg.createdAt)}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.5)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {personas.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#71717a", flexShrink: 0 }}>Reply as:</span>
            <select value={replyAs?.id ?? ""} onChange={(e) => setReplyAs(personas.find((p) => p.id === e.target.value) ?? null)}
              style={{ ...S.input, width: "auto", flex: 1, padding: "8px 12px", color: "#facc15" }}>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </div>
        )}
        {replyAs && personas.length === 1 && (
          <div style={{ fontSize: 11, color: "#71717a" }}>Reply as: <span style={{ color: "#facc15", fontWeight: 700 }}>{replyAs.displayName}</span></div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={replyAs ? `Reply as ${replyAs.displayName}…` : "Select a persona first"}
            disabled={!replyAs} style={{ ...S.input, flex: 1, opacity: replyAs ? 1 : 0.5 }} />
          <button onClick={send} disabled={!input.trim() || sending || !replyAs} style={{ ...S.btn("primary"), opacity: !input.trim() || sending || !replyAs ? 0.4 : 1 }}>
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ConversationsTab ────────────────────────────────────────────────────── */

function ConversationsTab({ personas }: { personas: FSPersona[] }) {
  const [convs,      setConvs]      = useState<FSConversation[]>([]);
  const [activeConv, setActiveConv] = useState<FSConversation | null>(null);
  const [error,      setError]      = useState("");

  useEffect(() => {
    return subscribeConversations(setConvs, (code) => setError("Conversations failed: " + code));
  }, []);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 10, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.15em" }}>
          Conversations ({convs.length})
        </div>
        {error && <div style={S.errBanner}>{error}</div>}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {convs.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "#3f3f46", fontSize: 13 }}>{error ? "No access" : "No conversations yet."}</div>
          ) : convs.map((c) => (
            <button key={c.id} onClick={() => setActiveConv(c)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", border: "none", cursor: "pointer", textAlign: "left", background: activeConv?.id === c.id ? "rgba(250,204,21,0.05)" : "transparent", borderLeft: activeConv?.id === c.id ? "2px solid #facc15" : "2px solid transparent" }}>
              {c.personaAvatar
                ? <img src={c.personaAvatar} alt={c.personaName} style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(250,204,21,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#facc15", flexShrink: 0 }}>{(c.personaName || "?")[0]}</div>
              }
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: "#facc15" }}>{c.personaName || c.personaUsername}</span>
                  <span style={{ fontSize: 10, color: "#3f3f46", flexShrink: 0 }}>{fmtTime(c.updatedAt)}</span>
                </div>
                <div style={{ fontSize: 11, color: "#71717a", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.userId.slice(0, 14)}…</div>
                {c.lastMessage && <div style={{ fontSize: 11, color: "#52525b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{c.lastMessage}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {activeConv
          ? <AdminChatWindow key={activeConv.id} conv={activeConv} personas={personas} />
          : <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#3f3f46", gap: 8 }}>
              <div style={{ fontSize: 36 }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Select a conversation</div>
            </div>
        }
      </div>
    </div>
  );
}

/* ── NewAdminPage ─────────────────────────────────────────────────────────── */

export default function NewAdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [tab,      setTab]      = useState<"conversations" | "personas">("conversations");
  const [personas, setPersonas] = useState<FSPersona[]>([]);
  const [uid,      setUid]      = useState<string | null>(null);
  const [fsError,  setFsError]  = useState("");

  // Auth — wait for module-level eager sign-in to complete
  useEffect(() => {
    authReady
      .then((user) => {
        console.log("[NewAdminPage] auth ready uid=", user.uid.slice(0, 8));
        setUid(user.uid);
      })
      .catch((err: unknown) => {
        const code = (err as { code?: string }).code ?? "unknown";
        console.error("[NewAdminPage] auth failed:", code);
      });
  }, []);

  // Personas — start only after auth
  useEffect(() => {
    if (!uid) return;
    console.log("[NewAdminPage] subscribing personas uid=", uid.slice(0, 8));
    return subscribePersonas(
      (list) => { setPersonas(list); setFsError(""); },
      (code) => setFsError(
        code === "permission-denied"
          ? "Firestore permission-denied — update security rules in Firebase Console"
          : "Firestore error: " + code
      )
    );
  }, [uid]);

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;

  if (!uid) {
    return <div style={{ ...S.page, alignItems: "center", justifyContent: "center", fontSize: 14, color: "#52525b" }}>Connecting…</div>;
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>🛡️</div>
        <h1 style={S.title}>SHADOW<span style={{ color: "#facc15" }}>ADMIN</span></h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 3 }}>
          {(["conversations", "personas"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: tab === t ? "rgba(250,204,21,0.12)" : "transparent", color: tab === t ? "#facc15" : "#52525b" }}>
              {t === "personas" ? `Personas (${personas.length})` : "Conversations"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#facc15" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#facc15" }}>LIVE</span>
        </div>
      </div>

      {fsError && <div style={S.errBanner}>{fsError}</div>}

      <div style={S.body}>
        {tab === "conversations" && <ConversationsTab personas={personas} />}
        {tab === "personas"      && <PersonasTab personas={personas} />}
      </div>
    </div>
  );
}
