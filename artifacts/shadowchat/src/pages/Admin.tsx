import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, doc, setDoc, updateDoc, deleteDoc,
  type Timestamp,
} from "firebase/firestore";
import { db, auth, firebaseDiagnostics } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePersonas } from "@/hooks/usePersonas";
import {
  type Persona, type Conversation, type Message,
  DEFAULT_PERSONAS, formatTime,
} from "@/lib/personas";
import {
  Shield, MessageSquare, Users, Send, ArrowLeft,
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  RefreshCw, ChevronDown, Eye, X,
} from "lucide-react";
import type { SignInError } from "@/contexts/AuthContext";

/* ─── Shared style helpers ───────────────────────────────────────────────── */

const inputCss: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  padding: "12px 16px",
  color: "white",
  fontSize: 14,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
        {required && <span style={{ color: "#facc15", fontSize: 10 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

function fmt(ts: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ─── PIN Gate ───────────────────────────────────────────────────────────── */

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin]     = useState("");
  const [shake, setShake] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === "shadow2024") { onUnlock(); return; }
    setShake(true);
    setPin("");
    setTimeout(() => setShake(false), 600);
  }

  return (
    <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#060606" }}>
      <motion.div
        animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}}
        style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 40, width: 340, textAlign: "center" }}
      >
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Shield style={{ width: 24, height: 24, color: "#facc15" }} />
        </div>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: 22, letterSpacing: "0.15em", marginBottom: 8 }}>
          SHADOW<span style={{ color: "#facc15" }}>ADMIN</span>
        </h1>
        <p style={{ color: "#52525b", fontSize: 13, marginBottom: 28 }}>Enter admin PIN to continue</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••••"
            autoFocus
            style={{ ...inputCss, textAlign: "center", fontSize: 18, letterSpacing: "0.3em" }}
          />
          <button type="submit" style={{ padding: "14px 0", borderRadius: 12, background: "#facc15", border: "none", color: "#000", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>
            Unlock
          </button>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Firebase diagnostic panel ─────────────────────────────────────────── */

function FirebaseDiagPanel({ authUser, signInError }: { authUser: import("firebase/auth").User | null; signInError: SignInError | null }) {
  const d  = firebaseDiagnostics;
  const ok = !signInError && !!authUser;
  return (
    <div style={{ background: ok ? "#052e16" : signInError ? "#450a0a" : "#1c1917", borderBottom: "1px solid " + (ok ? "#166534" : signInError ? "#991b1b" : "#3f3f46"), padding: "6px 20px", fontFamily: "monospace", fontSize: 11, display: "flex", flexWrap: "wrap", gap: "6px 20px", alignItems: "center" }}>
      <span style={{ color: authUser ? "#4ade80" : "#f87171", fontWeight: 700 }}>
        {authUser ? `✓ uid:${authUser.uid.slice(0, 8)} anon:${authUser.isAnonymous}` : "✗ no auth"}
      </span>
      <span style={{ color: "#a1a1aa" }}>project: <span style={{ color: d.projectId === "MISSING" ? "#f87171" : "#d4d4d8" }}>{d.projectId}</span></span>
      <span style={{ color: "#a1a1aa" }}>apiKey: <span style={{ color: d.apiKeyChar0 === 65 ? "#d4d4d8" : "#f87171" }}>len={d.apiKeyLen} starts="{d.apiKeyPrefix}"</span></span>
      {signInError && <span style={{ color: "#fca5a5", fontWeight: 700 }}>⚠ {signInError.code}</span>}
    </div>
  );
}

/* ─── Persona form modal ─────────────────────────────────────────────────── */

function PersonaFormModal({
  mode, persona, onClose,
}: {
  mode: "create" | "edit";
  persona?: Persona;
  onClose: () => void;
}) {
  const [displayName,    setDisplayName]    = useState(persona?.displayName    ?? "");
  const [username,       setUsername]       = useState(persona?.username       ?? "");
  const [avatar,         setAvatar]         = useState(persona?.avatar         ?? "");
  const [bio,            setBio]            = useState(persona?.bio            ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(persona?.welcomeMessage ?? "");
  const [status,         setStatus]         = useState<Persona["status"]>(persona?.status ?? "online");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  // Auto-derive username from display name on create
  useEffect(() => {
    if (mode === "create") {
      setUsername(displayName.toLowerCase().replace(/[^a-z0-9]/g, ""));
    }
  }, [displayName, mode]);

  async function handleSave() {
    if (!displayName.trim()) { setError("Display name is required."); return; }
    if (!username.trim())    { setError("Username is required."); return; }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Not signed in — wait a moment and retry.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      displayName:    displayName.trim(),
      username:       username.trim(),
      avatar:         avatar.trim(),
      bio:            bio.trim(),
      welcomeMessage: welcomeMessage.trim(),
      status,
    };

    try {
      if (mode === "create") {
        await addDoc(collection(db, "personas"), { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, "personas", persona!.id), payload);
      }
      onClose();
      window.location.reload();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "unknown";
      const msg  = err instanceof Error ? err.message : String(err);
      console.error("[PersonaForm] write failed:", code, msg);
      setError("[" + code + "] " + msg);
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ color: "white", fontWeight: 900, fontSize: 18 }}>{mode === "create" ? "New Persona" : "Edit Persona"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", padding: 4 }}><X style={{ width: 20, height: 20 }} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Display Name" required>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="MidnightSoul" style={inputCss} autoFocus />
          </Field>

          <Field label="Username" required>
            <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} placeholder="midnightsoul" style={inputCss} readOnly={mode === "edit"} />
          </Field>

          <Field label="Avatar URL">
            <input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." style={inputCss} />
          </Field>

          <Field label="Bio">
            <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short description…" style={inputCss} />
          </Field>

          <Field label="Welcome Message">
            <input value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} placeholder="First thing they say…" style={inputCss} />
          </Field>

          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as Persona["status"])} style={{ ...inputCss, cursor: "pointer", appearance: "none" }}>
              <option value="online">Online</option>
              <option value="typing">Typing…</option>
              <option value="offline">Offline</option>
            </select>
          </Field>
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 12, textAlign: "center" }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "13px 0", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#71717a", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "13px 0", borderRadius: 14, background: saving ? "rgba(250,204,21,0.4)" : "#facc15", border: "none", color: "#000", fontWeight: 900, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving…" : mode === "create" ? "Create Persona" : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Persona manager tab ────────────────────────────────────────────────── */

function PersonasTab({ personas }: { personas: Persona[] }) {
  const [form, setForm]       = useState<{ mode: "create" } | { mode: "edit"; persona: Persona } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "personas", deleteId));
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "unknown";
      console.error("[PersonasTab] delete failed:", code, err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  async function toggleStatus(p: Persona) {
    const next = p.status === "offline" ? "online" : "offline";
    try {
      await updateDoc(doc(db, "personas", p.id), { status: next });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "unknown";
      console.error("[PersonasTab] status toggle failed:", code, err);
    }
  }

  async function restoreDefaults() {
    try {
      await Promise.all(
        DEFAULT_PERSONAS.map((p) =>
          addDoc(collection(db, "personas"), { ...p, createdAt: serverTimestamp() })
        )
      );
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "unknown";
      console.error("[PersonasTab] restore defaults failed:", code, err);
    }
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: "white", letterSpacing: "0.1em" }}>PERSONAS</h2>
          <p style={{ fontSize: 12, color: "#52525b", marginTop: 2 }}>{personas.length} on platform</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {personas.length === 0 && (
            <button onClick={restoreDefaults} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12, background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", color: "#facc15", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              <RefreshCw style={{ width: 13, height: 13 }} /> Restore Defaults
            </button>
          )}
          <button onClick={() => setForm({ mode: "create" })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, background: "#facc15", border: "none", color: "#000", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>
            <Plus style={{ width: 14, height: 14 }} /> New Persona
          </button>
        </div>
      </div>

      {personas.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 240, gap: 16 }}>
          <Users style={{ width: 40, height: 40, color: "#27272a" }} />
          <p style={{ color: "#52525b", fontSize: 14 }}>No personas yet. Create one or restore defaults.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {personas.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16 }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                {p.avatar
                  ? <img src={p.avatar} alt={p.displayName} style={{ width: 52, height: 52, borderRadius: 14, objectFit: "cover" }} />
                  : <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(250,204,21,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#facc15" }}>{p.displayName[0]}</div>
                }
                <span style={{ position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: "50%", background: p.status === "online" ? "#4ade80" : p.status === "typing" ? "#facc15" : "#52525b", border: "2px solid #0a0a0a" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 800, color: "white", fontSize: 14 }}>{p.displayName}</span>
                  <span style={{ fontSize: 10, color: "#3f3f46", fontFamily: "monospace" }}>/{p.username}</span>
                </div>
                {p.bio && <p style={{ fontSize: 11, color: "#52525b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.bio}</p>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => toggleStatus(p)} title={p.status !== "offline" ? "Set Offline" : "Set Online"} style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: p.status !== "offline" ? "#4ade80" : "#52525b", display: "flex" }}>
                  {p.status !== "offline" ? <ToggleRight style={{ width: 16, height: 16 }} /> : <ToggleLeft style={{ width: 16, height: 16 }} />}
                </button>
                <button onClick={() => setForm({ mode: "edit", persona: p })} style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#facc15", display: "flex" }}>
                  <Pencil style={{ width: 16, height: 16 }} />
                </button>
                <button onClick={() => setDeleteId(p.id)} style={{ padding: 8, borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", cursor: "pointer", color: "#f87171", display: "flex" }}>
                  <Trash2 style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ background: "#0a0a0a", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: 28, maxWidth: 360, width: "100%", textAlign: "center" }}>
              <Trash2 style={{ width: 32, height: 32, color: "#f87171", margin: "0 auto 16px" }} />
              <p style={{ fontWeight: 800, color: "white", fontSize: 16 }}>Delete Persona?</p>
              <p style={{ color: "#52525b", fontSize: 13, marginTop: 6 }}>This is permanent.</p>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#71717a", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={confirmDelete} disabled={deleting} style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "#ef4444", border: "none", color: "white", fontWeight: 900, cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Form modal */}
      <AnimatePresence>
        {form && (
          <PersonaFormModal
            key={form.mode === "edit" ? form.persona.id : "create"}
            mode={form.mode}
            persona={form.mode === "edit" ? form.persona : undefined}
            onClose={() => setForm(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Admin chat window ──────────────────────────────────────────────────── */

interface ConvMeta extends Conversation {
  personaName:   string;
  personaAvatar: string;
  personaUsername: string;
}

function AdminChatWindow({ conv, personas, onBack }: { conv: ConvMeta; personas: Persona[]; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [replyAs,  setReplyAs]  = useState<Persona | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (personas.length === 0) return;
    setReplyAs((cur) => cur ?? (personas.find((p) => p.username === conv.personaUsername) ?? personas[0]));
  }, [personas, conv.personaUsername]);

  useEffect(() => {
    const q = query(
      collection(db, "conversations", conv.id, "messages"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    }, (err: unknown) => {
      const code = (err as { code?: string }).code ?? "unknown";
      console.error("[AdminChatWindow] messages failed:", code);
    });
  }, [conv.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, [conv.id]);

  const send = useCallback(async () => {
    if (!replyAs) return;
    const t = input.trim();
    if (!t || sending) return;
    setSending(true);
    setInput("");
    try {
      await addDoc(collection(db, "conversations", conv.id, "messages"), {
        sender: replyAs.username,
        text: t,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, "conversations", conv.id),
        { lastMessage: `${replyAs.displayName}: ${t}`, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "unknown";
      console.error("[AdminChatWindow] send failed:", code, err);
      setInput(t);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, conv.id, replyAs]);

  const isUserMsg = (msg: Message) => msg.sender === conv.userId;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-white/5 bg-black/50 backdrop-blur-xl flex-shrink-0">
        <button onClick={onBack} className="md:hidden p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={conv.personaAvatar} alt={conv.personaName} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{conv.userId.slice(0, 8)}…</span>
            <span className="text-zinc-600 text-xs">↔</span>
            <span className="text-primary text-xs font-bold">{conv.personaName}</span>
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5">{fmt(conv.updatedAt)}</div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-[10px] font-bold">LIVE</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Eye className="w-8 h-8 text-zinc-700" />
            <p className="text-zinc-500 text-sm">No messages yet.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const user = isUserMsg(msg);
            const pAvatar = personas.find((p) => p.username === msg.sender)?.avatar ?? conv.personaAvatar;
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                className={`flex gap-3 ${user ? "flex-row" : "flex-row-reverse"}`}>
                {user
                  ? <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-black text-zinc-300 flex-shrink-0 self-end">U</div>
                  : <img src={pAvatar} alt={msg.sender} className="w-8 h-8 rounded-xl object-cover flex-shrink-0 self-end" />
                }
                <div className={`flex flex-col gap-1 max-w-[68%] ${user ? "items-start" : "items-end"}`}>
                  <span className="text-[10px] font-bold text-zinc-500 px-1">{user ? "user" : msg.sender}</span>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${user ? "bg-white/6 border border-white/8 text-white/90 rounded-tl-sm" : "bg-primary text-black font-semibold rounded-tr-sm"}`}>
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-zinc-700 px-1">{fmt(msg.createdAt)}</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-white/5 bg-black/70 backdrop-blur-xl space-y-3">
        {/* Persona selector */}
        {personas.length > 0 && (
          <div className="relative">
            <button onClick={() => setDropOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/30 transition-colors text-left">
              {replyAs?.avatar
                ? <img src={replyAs.avatar} alt={replyAs.displayName} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-xs font-black">{replyAs?.displayName?.[0] ?? "?"}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Replying as</div>
                <div className="text-sm font-bold text-primary truncate">{replyAs?.displayName ?? "Select persona…"}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${dropOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {dropOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-30 max-h-56 overflow-y-auto"
                >
                  {personas.map((p) => (
                    <button key={p.id} onClick={() => { setReplyAs(p); setDropOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${replyAs?.id === p.id ? "bg-primary/8" : "hover:bg-white/5"}`}>
                      {p.avatar
                        ? <img src={p.avatar} alt={p.displayName} className="w-9 h-9 rounded-xl object-cover" />
                        : <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">{p.displayName[0]}</div>
                      }
                      <span className={`text-sm font-bold ${replyAs?.id === p.id ? "text-primary" : "text-white/80"}`}>{p.displayName}</span>
                      {replyAs?.id === p.id && <span className="ml-auto text-primary font-black">✓</span>}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={replyAs ? `Type as ${replyAs.displayName}…` : "Select a persona…"}
            disabled={!replyAs}
            rows={1}
            style={{ minHeight: 50, maxHeight: 120 }}
            className="flex-1 bg-white/5 border border-white/10 focus:border-primary/50 rounded-2xl px-5 py-3 text-sm text-white placeholder:text-zinc-600 resize-none outline-none transition-all disabled:opacity-40"
          />
          <button onClick={send} disabled={!input.trim() || sending || !replyAs}
            className="flex-shrink-0 p-3.5 rounded-2xl bg-primary text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Conversations tab ──────────────────────────────────────────────────── */

function ConversationsTab({ personas }: { personas: Persona[] }) {
  const [convs,       setConvs]       = useState<ConvMeta[]>([]);
  const [activeConv,  setActiveConv]  = useState<ConvMeta | null>(null);
  const [showPanel,   setShowPanel]   = useState(false);

  useEffect(() => {
    const q = query(collection(db, "conversations"), orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .filter((d) => d.data().userId)
        .map((d) => ({ id: d.id, ...d.data() } as ConvMeta));
      setConvs(list);
    }, (err: unknown) => {
      const code = (err as { code?: string }).code ?? "unknown";
      console.error("[ConversationsTab] snapshot failed:", code);
    });
  }, []);

  return (
    <>
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        className={`flex-col w-full md:w-80 border-r border-white/5 bg-black/30 ${showPanel ? "hidden md:flex" : "flex"}`}
      >
        <div className="px-4 py-3 border-b border-white/5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Conversations ({convs.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-20 px-6 text-center">
              <MessageSquare className="w-10 h-10 text-zinc-800" />
              <p className="text-zinc-500 text-sm">No conversations yet.</p>
            </div>
          ) : (
            convs.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => { setActiveConv(c); setShowPanel(true); }}
                className={`w-full flex items-center gap-3 px-4 py-4 border-b border-white/[0.03] text-left transition-all relative group ${activeConv?.id === c.id ? "bg-white/5" : "hover:bg-white/[0.03]"}`}
              >
                {activeConv?.id === c.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-10 bg-primary rounded-r" />}
                <div className="relative flex-shrink-0">
                  {c.personaAvatar
                    ? <img src={c.personaAvatar} alt={c.personaName} className="w-11 h-11 rounded-xl object-cover" />
                    : <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">{(c.personaName ?? "?")[0]}</div>
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-bold text-sm text-white/75 group-hover:text-white/90 truncate">{c.userId.slice(0, 12)}…</span>
                    <span className="text-[9px] text-zinc-600 flex-shrink-0">{fmt(c.updatedAt)}</span>
                  </div>
                  <div className="text-xs font-semibold text-primary/70 mb-0.5">↔ {c.personaName ?? c.personaUsername}</div>
                  {c.lastMessage && <div className="text-[11px] text-zinc-600 truncate">{c.lastMessage}</div>}
                </div>
              </motion.button>
            ))
          )}
        </div>
      </motion.aside>

      {/* Chat window */}
      <div className={`flex-1 overflow-hidden ${showPanel ? "flex" : "hidden md:flex"} flex-col`}>
        {activeConv ? (
          <AnimatePresence mode="wait">
            <motion.div key={activeConv.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="h-full">
              <AdminChatWindow conv={activeConv} personas={personas} onBack={() => setShowPanel(false)} />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
            <MessageSquare className="w-12 h-12 text-primary/20" />
            <div>
              <p className="text-white font-bold text-xl">Select a conversation</p>
              <p className="text-zinc-500 text-sm mt-2">Choose one from the sidebar to view messages and reply.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Admin (main export) ────────────────────────────────────────────────── */

export default function Admin() {
  const [unlocked,   setUnlocked]   = useState(false);
  const [activeTab,  setActiveTab]  = useState<"conversations" | "personas">("conversations");
  const { user: authUser, signInError } = useAuth();
  const { personas } = usePersonas();

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="h-screen bg-[hsl(0,0%,4%)] text-white flex flex-col overflow-hidden">

      {/* Top nav */}
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/5 bg-black/60 backdrop-blur-xl z-40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-[0.15em] leading-none">SHADOW<span className="text-primary">ADMIN</span></h1>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">Command Center</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 4 }}>
          {(["conversations", "personas"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "8px 16px", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer", border: "none",
              background: activeTab === tab ? "rgba(250,204,21,0.12)" : "transparent",
              color: activeTab === tab ? "#facc15" : "#52525b",
              transition: "all 0.15s", textTransform: "capitalize",
            }}>
              {tab === "conversations" ? "Conversations" : `Personas (${personas.length})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-primary text-xs font-bold tracking-wider">LIVE</span>
        </div>
      </motion.header>

      {/* Firebase diagnostics */}
      <FirebaseDiagPanel authUser={authUser} signInError={signInError} />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === "conversations" && <ConversationsTab personas={personas} />}
        {activeTab === "personas"      && <PersonasTab personas={personas} />}
      </div>
    </div>
  );
}
