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
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  type Persona,
  DEFAULT_PERSONAS,
  formatPoints,
} from "@/lib/personas";
import { usePersonas } from "@/hooks/usePersonas";
import {
  Send, ArrowLeft, Shield, Users, MessageSquare,
  ChevronDown, Eye, Plus, Pencil, Trash2,
  ToggleLeft, ToggleRight, RefreshCw, X,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface AdminMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: Timestamp | null;
  persona: string;
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

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmt(ts: Timestamp | null): string {
  if (!ts) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

function Field({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
        {required && <span style={{ color: "#facc15", fontSize: 10 }}>*</span>}
        {hint && <span style={{ fontSize: 10, color: "#3f3f46", marginLeft: "auto" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
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
      setError(true); setShake(true); setPin("");
      setTimeout(() => { setError(false); setShake(false); }, 1500);
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(250,204,21,0.06),transparent)]" />
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-5 mb-8">
            <div className="w-20 h-20 rounded-2xl bg-[hsl(48,96%,53%)]/10 border border-[hsl(48,96%,53%)]/20 flex items-center justify-center">
              <Shield className="w-10 h-10 text-[hsl(48,96%,53%)]" />
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-3xl font-black tracking-[0.12em] text-white">SHADOW<span className="text-[hsl(48,96%,53%)]">ADMIN</span></h1>
              <p className="text-zinc-500 text-sm">Restricted access. Authorised personnel only.</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <input
              type="password" value={pin} onChange={(e) => setPin(e.target.value)}
              placeholder="• • • • • • • •" autoFocus
              className={`w-full bg-white/5 border rounded-2xl px-5 py-4 text-white text-center text-xl font-bold tracking-[0.4em] placeholder:text-zinc-700 outline-none transition-all duration-200
                ${error ? "border-red-500/60 bg-red-500/5" : "border-white/10 focus:border-[hsl(48,96%,53%)]/50 focus:bg-white/[0.06]"}
                ${shake ? "animate-pulse" : ""}`}
            />
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-red-400 text-xs text-center font-semibold">
                  Incorrect PIN — access denied.
                </motion.p>
              )}
            </AnimatePresence>
            <button type="submit" className="w-full py-4 rounded-2xl bg-[hsl(48,96%,53%)] text-black font-black text-sm tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_0_30px_rgba(250,204,21,0.2)]">
              Enter Dashboard
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Persona Form Modal ─────────────────────────────────────────────────── */

function PersonaFormModal({
  mode, persona, onClose, onSave,
}: {
  mode: "create" | "edit";
  persona?: Persona;
  onClose: () => void;
  onSave: () => void;
}) {
  const [displayName, setDisplayName] = useState(persona?.displayName ?? "");
  const [username, setUsername] = useState(persona?.username ?? "");
  const [bio, setBio] = useState(persona?.bio ?? "");
  const [avatar, setAvatar] = useState(persona?.avatar ?? "");
  const [status, setStatus] = useState<Persona["status"]>(persona?.status ?? "online");
  const [accent, setAccent] = useState(persona?.accent ?? "#facc15");
  const [welcomeMessage, setWelcomeMessage] = useState(persona?.welcomeMessage ?? "");
  const [points, setPoints] = useState(persona?.points ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Visible debug panel — each field updates as the save progresses.
  const [dbg, setDbg] = useState<{
    step: string; writeOk: boolean | null; errMsg: string;
  }>({ step: "idle", writeOk: null, errMsg: "" });

  // Keep a ref so the timeout guard can call setSaving even if something throws.
  const savingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mode === "create") {
      setUsername(displayName.toLowerCase().replace(/[^a-z0-9]/g, ""));
    }
  }, [displayName, mode]);

  // Cleanup timeout on unmount.
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  function resetSaving(errMsg = "") {
    savingRef.current = false;
    setSaving(false);
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (errMsg) setError(errMsg);
  }

  async function handleSave() {
    if (!displayName.trim()) { setError("Display name is required."); return; }
    if (!username.trim()) { setError("Username is required."); return; }
    if (savingRef.current) return; // guard double-click

    // ── step 1: mark saving ───────────────────────────────────────────────
    savingRef.current = true;
    setSaving(true);
    setError("");
    setDbg({ step: "1-started", writeOk: null, errMsg: "" });

    // ── step 2: hard-timeout safety net (6 s) ────────────────────────────
    timeoutRef.current = setTimeout(() => {
      if (!savingRef.current) return; // already resolved
      console.error("[Admin] TIMEOUT — Firestore write took >6 s, aborting");
      setDbg(d => ({ ...d, step: "TIMEOUT", errMsg: "Firestore write timed out (>6 s)" }));
      resetSaving("Firestore write timed out. Check your connection.");
    }, 6000);

    // ── step 3: build payload — strip all undefined / NaN ────────────────
    const slug = username.trim();
    const payload = {
      username:       slug,
      displayName:    displayName.trim(),
      bio:            bio.trim() || "",
      avatar:         avatar.trim() || "",
      status:         status,
      accent:         accent || "#facc15",
      welcomeMessage: welcomeMessage.trim() || "",
      points:         isNaN(Number(points)) ? 0 : Number(points),
      order:          mode === "create" ? Date.now() : (persona?.order ?? Date.now()),
    };
    console.log("[Admin] handleSave — step 3 payload:", JSON.stringify(payload));
    setDbg(d => ({ ...d, step: "3-payload-built" }));

    // ── step 4: reference ─────────────────────────────────────────────────
    const CONFIG = doc(db, "chats", "_personas_config_");
    console.log("[Admin] handleSave — step 4 doc path:", CONFIG.path);
    setDbg(d => ({ ...d, step: "4-ref-created" }));

    // ── step 5: fire write ────────────────────────────────────────────────
    console.log("[Admin] handleSave — step 5 firing write, mode:", mode);
    setDbg(d => ({ ...d, step: "5-write-fired" }));

    try {
      if (mode === "create") {
        await setDoc(CONFIG, { [slug]: payload }, { merge: true });
      } else {
        await updateDoc(CONFIG, { [persona!.id]: payload });
      }

      // ── step 6: write resolved ──────────────────────────────────────────
      console.log("[Admin] handleSave — step 6 WRITE SUCCESS, slug:", slug);
      setDbg(d => ({ ...d, step: "6-write-ok", writeOk: true }));

      resetSaving();
      onSave(); // closes modal in parent

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Admin] handleSave — step 6 WRITE ERROR:", msg, err);
      setDbg(d => ({ ...d, step: "6-write-error", writeOk: false, errMsg: msg }));
      resetSaving(`Save failed: ${msg}`);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 32, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "white", letterSpacing: "0.05em" }}>
              {mode === "create" ? "New Persona" : "Edit Persona"}
            </h2>
            <p style={{ fontSize: 12, color: "#52525b", marginTop: 2 }}>
              {mode === "create" ? "Add a new persona to the platform" : `Editing ${persona?.displayName}`}
            </p>
          </div>
          <button onClick={onClose} style={{ padding: 8, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#71717a" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {avatar && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <img src={avatar} alt="preview" style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", border: "2px solid rgba(255,255,255,0.1)" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}

          <Field label="Display Name" required>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. MidnightSoul" style={inputCss} />
          </Field>

          <Field label="Username" required hint={mode === "edit" ? "Locked after creation" : "Auto-derived"}>
            <input
              value={username}
              onChange={(e) => mode === "create" && setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
              placeholder="midnightsoul"
              readOnly={mode === "edit"}
              style={{ ...inputCss, opacity: mode === "edit" ? 0.5 : 1, cursor: mode === "edit" ? "not-allowed" : "text" }}
            />
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as Persona["status"])}
                style={{ ...inputCss, cursor: "pointer", appearance: "none" }}>
                <option value="online">Online</option>
                <option value="typing">Typing…</option>
                <option value="offline">Offline</option>
              </select>
            </Field>
            <Field label="Points">
              <input type="number" min={0} value={points} onChange={(e) => setPoints(Number(e.target.value))} placeholder="0" style={inputCss} />
            </Field>
          </div>

          <Field label="Accent Colour" hint="Hex">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
                style={{ width: 46, height: 42, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", cursor: "pointer", padding: 4, flexShrink: 0 }} />
              <input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#facc15" style={{ ...inputCss, flex: 1 }} />
            </div>
          </Field>
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 12, textAlign: "center" }}>{error}</p>}

        {/* ── debug panel ── always visible during save ── */}
        {dbg.step !== "idle" && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.15)", fontFamily: "monospace", fontSize: 11, color: "#a1a1aa" }}>
            <div>step: <span style={{ color: dbg.writeOk === true ? "#4ade80" : dbg.writeOk === false ? "#f87171" : "#facc15" }}>{dbg.step}</span></div>
            <div>saving: {String(saving)}</div>
            {dbg.errMsg && <div style={{ color: "#f87171", wordBreak: "break-all" }}>err: {dbg.errMsg}</div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "14px 0", borderRadius: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#71717a", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ flex: 2, padding: "14px 0", borderRadius: 16, background: saving ? "rgba(250,204,21,0.4)" : "#facc15", border: "none", color: "#000", fontWeight: 900, fontSize: 14, cursor: "pointer" }}
          >
            {saving ? "Saving…" : mode === "create" ? "Create Persona" : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Persona Manager ────────────────────────────────────────────────────── */

function PersonaManager({
  personas, onEdit, onCreate, onRestoreDefaults,
}: {
  personas: Persona[];
  onEdit: (p: Persona) => void;
  onCreate: () => void;
  onRestoreDefaults: () => void;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await updateDoc(doc(db, "chats", "_personas_config_"), {
        [deleteId]: deleteField(),
      });
    }
    catch (err) { console.error("Delete error:", err); }
    finally { setDeleting(false); setDeleteId(null); }
  }

  async function toggleStatus(p: Persona) {
    const next = p.status === "offline" ? "online" : "offline";
    await updateDoc(doc(db, "chats", "_personas_config_"), {
      [`${p.id}.status`]: next,
    }).catch(console.error);
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: "white", letterSpacing: "0.1em" }}>PERSONA MANAGER</h2>
          <p style={{ fontSize: 12, color: "#52525b", marginTop: 2 }}>{personas.length} persona{personas.length !== 1 ? "s" : ""} on platform</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {personas.length === 0 && (
            <button onClick={onRestoreDefaults}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12, background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", color: "#facc15", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              <RefreshCw style={{ width: 13, height: 13 }} />
              Restore Defaults
            </button>
          )}
          <button onClick={onCreate}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, background: "#facc15", border: "none", color: "#000", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>
            <Plus style={{ width: 14, height: 14 }} />
            New Persona
          </button>
        </div>
      </div>

      {personas.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 16, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users style={{ width: 28, height: 28, color: "#3f3f46" }} />
          </div>
          <div>
            <p style={{ color: "#52525b", fontWeight: 600, fontSize: 14 }}>No personas configured</p>
            <p style={{ color: "#3f3f46", fontSize: 12, marginTop: 4 }}>Create your first persona or restore the 6 defaults.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {personas.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: "white", fontSize: 14 }}>{p.displayName}</span>
                  <span style={{ fontSize: 10, color: "#3f3f46", fontFamily: "monospace" }}>/{p.username}</span>
                </div>
                {p.bio && <p style={{ fontSize: 11, color: "#52525b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.bio}</p>}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: p.status === "online" ? "#4ade80" : p.status === "typing" ? "#facc15" : "#52525b" }}>
                    {p.status === "online" ? "Online" : p.status === "typing" ? "Typing…" : "Offline"}
                  </span>
                  <span style={{ color: "#3f3f46", fontSize: 10 }}>·</span>
                  <span style={{ fontSize: 10, color: "#facc15", fontWeight: 700 }}>{formatPoints(p.points)} pts</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => toggleStatus(p)} title={p.status !== "offline" ? "Set Offline" : "Set Online"}
                  style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: p.status !== "offline" ? "#4ade80" : "#52525b", display: "flex" }}>
                  {p.status !== "offline"
                    ? <ToggleRight style={{ width: 16, height: 16 }} />
                    : <ToggleLeft style={{ width: 16, height: 16 }} />}
                </button>
                <button onClick={() => onEdit(p)} title="Edit"
                  style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#facc15", display: "flex" }}>
                  <Pencil style={{ width: 16, height: 16 }} />
                </button>
                <button onClick={() => setDeleteId(p.id)} title="Delete"
                  style={{ padding: 8, borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", cursor: "pointer", color: "#f87171", display: "flex" }}>
                  <Trash2 style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteId && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ background: "#0a0a0a", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: 28, maxWidth: 360, width: "100%", textAlign: "center" }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Trash2 style={{ width: 24, height: 24, color: "#f87171" }} />
              </div>
              <p style={{ fontWeight: 800, color: "white", fontSize: 16 }}>Delete Persona?</p>
              <p style={{ color: "#52525b", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                This permanently removes the persona. Existing chat histories are preserved.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#71717a", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={confirmDelete} disabled={deleting} style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "#ef4444", border: "none", color: "white", fontWeight: 900, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Admin Chat Panel ───────────────────────────────────────────────────── */

function AdminChatPanel({
  chat, personas, onBack,
}: {
  chat: ChatMeta;
  personas: Persona[];
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyAs, setReplyAs] = useState<Persona | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (personas.length === 0) return;
    setReplyAs((cur) => cur ?? (personas.find((p) => p.username === chat.personaSlug) ?? personas[0]));
  }, [personas, chat.personaSlug]);

  useEffect(() => {
    const q = query(collection(db, "chats", chat.id, "messages"), orderBy("timestamp", "asc"));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminMessage, "id">) })));
    });
  }, [chat.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, [chat.id]);

  const send = useCallback(async () => {
    if (!replyAs) return;
    const text = input.trim();
    if (!text || sending) return;
    setSending(true); setInput("");
    try {
      await addDoc(collection(db, "chats", chat.id, "messages"), {
        senderId: `persona_${replyAs.username}`,
        text, timestamp: serverTimestamp(), persona: replyAs.displayName,
      });
      await setDoc(doc(db, "chats", chat.id), { lastMessage: `${replyAs.displayName}: ${text}`, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error("Admin send failed:", err); setInput(text);
    } finally {
      setSending(false); inputRef.current?.focus();
    }
  }, [input, sending, chat.id, replyAs]);

  const msgPersonaImg = (msg: AdminMessage) =>
    personas.find((p) => p.displayName === msg.persona)?.avatar ?? chat.personaImage;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-white/5 bg-black/50 backdrop-blur-xl flex-shrink-0">
        <button onClick={onBack} className="md:hidden p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-400 hover:text-white">
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
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                className={`flex gap-3 ${isUser ? "flex-row" : "flex-row-reverse"}`}>
                {isUser
                  ? <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-black text-zinc-300 flex-shrink-0 self-end">{chat.username.slice(0, 1).toUpperCase()}</div>
                  : <img src={msgPersonaImg(msg)} alt={msg.persona} className="w-8 h-8 rounded-xl object-cover flex-shrink-0 self-end" />
                }
                <div className={`flex flex-col gap-1 max-w-[68%] ${isUser ? "items-start" : "items-end"}`}>
                  <span className="text-[10px] font-bold text-zinc-500 px-1">
                    {isUser ? chat.username : msg.persona}
                    {!isUser && <span className="ml-1 text-[hsl(48,96%,53%)]/60">(admin)</span>}
                  </span>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${isUser ? "bg-white/6 border border-white/8 text-white/90 rounded-tl-sm" : "bg-[hsl(48,96%,53%)] text-black font-semibold rounded-tr-sm shadow-[0_0_20px_rgba(250,204,21,0.12)]"}`}>
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

      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-white/5 bg-black/70 backdrop-blur-xl space-y-3">
        {/* Persona selector */}
        {personas.length > 0 && (
          <div className="relative">
            <button onClick={() => setDropdownOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[hsl(48,96%,53%)]/30 transition-colors text-left">
              {replyAs?.avatar
                ? <img src={replyAs.avatar} alt={replyAs.displayName} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-xs font-black flex-shrink-0">{replyAs?.displayName?.[0] ?? "?"}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Replying as</div>
                <div className="text-sm font-bold text-[hsl(48,96%,53%)] truncate">{replyAs?.displayName ?? "Select persona…"}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.14 }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-30 max-h-64 overflow-y-auto">
                  {personas.map((p) => (
                    <button key={p.id} onClick={() => { setReplyAs(p); setDropdownOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${replyAs?.id === p.id ? "bg-[hsl(48,96%,53%)]/8" : "hover:bg-white/5"}`}>
                      {p.avatar
                        ? <img src={p.avatar} alt={p.displayName} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                        : <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-black flex-shrink-0">{p.displayName[0]}</div>
                      }
                      <span className={`text-sm font-bold ${replyAs?.id === p.id ? "text-[hsl(48,96%,53%)]" : "text-white/80"}`}>{p.displayName}</span>
                      {replyAs?.id === p.id && <span className="ml-auto text-[hsl(48,96%,53%)] font-black text-sm">✓</span>}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex gap-3 items-end">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={replyAs ? `Type as ${replyAs.displayName}…` : "Select a persona first…"}
            disabled={!replyAs}
            rows={1} style={{ minHeight: "50px", maxHeight: "120px" }}
            className="flex-1 bg-white/5 border border-white/10 focus:border-[hsl(48,96%,53%)]/50 rounded-2xl px-5 py-3 text-sm text-white placeholder:text-zinc-600 resize-none outline-none transition-all duration-200 disabled:opacity-40" />
          <button onClick={send} disabled={!input.trim() || sending || !replyAs}
            className="flex-shrink-0 p-3.5 rounded-2xl bg-[hsl(48,96%,53%)] text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100">
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
  const [activeTab, setActiveTab] = useState<"conversations" | "personas">("conversations");
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [activeChat, setActiveChat] = useState<ChatMeta | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [formState, setFormState] = useState<{ mode: "create" } | { mode: "edit"; persona: Persona } | null>(null);

  const { personas } = usePersonas();

  useEffect(() => {
    if (!unlocked) return;
    const q = query(collection(db, "chats"), orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snap) => {
      setChats(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMeta, "id">) })));
    });
  }, [unlocked]);

  async function restoreDefaults() {
    const data: Record<string, object> = {};
    DEFAULT_PERSONAS.forEach((p) => {
      data[p.username] = { ...p };
    });
    await setDoc(doc(db, "chats", "_personas_config_"), data, { merge: true }).catch(console.error);
  }

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="h-screen bg-[hsl(0,0%,4%)] text-white flex flex-col overflow-hidden">

      {/* Top nav */}
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/5 bg-black/60 backdrop-blur-xl z-40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[hsl(48,96%,53%)]/10 border border-[hsl(48,96%,53%)]/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[hsl(48,96%,53%)]" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-[0.15em] leading-none">SHADOW<span className="text-[hsl(48,96%,53%)]">ADMIN</span></h1>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold mt-0.5">Command Center</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 4 }}>
          {(["conversations", "personas"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 16px", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer", border: "none",
                background: activeTab === tab ? "rgba(250,204,21,0.12)" : "transparent",
                color: activeTab === tab ? "#facc15" : "#52525b",
                transition: "all 0.15s",
                letterSpacing: "0.05em", textTransform: "capitalize",
              }}>
              {tab === "conversations" ? `Conversations (${chats.length})` : `Personas (${personas.length})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(48,96%,53%)]/10 border border-[hsl(48,96%,53%)]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(48,96%,53%)] animate-pulse" />
            <span className="text-[hsl(48,96%,53%)] text-xs font-bold tracking-wider">LIVE</span>
          </div>
        </div>
      </motion.header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Conversations tab */}
        {activeTab === "conversations" && (
          <>
            <motion.aside initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.35 }}
              className={`flex-col w-full md:w-80 border-r border-white/5 bg-black/30 ${showPanel ? "hidden md:flex" : "flex"}`}>
              <div className="px-4 py-3 border-b border-white/5">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Active Conversations</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-20 px-6 text-center">
                    <MessageSquare className="w-10 h-10 text-zinc-800" />
                    <div>
                      <p className="text-zinc-500 text-sm font-semibold">No conversations yet</p>
                      <p className="text-zinc-700 text-xs mt-1 leading-relaxed">Users need to open a persona chat room first.</p>
                    </div>
                  </div>
                ) : (
                  chats.map((chat, i) => (
                    <motion.button key={chat.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      onClick={() => { setActiveChat(chat); setShowPanel(true); }}
                      className={`w-full flex items-center gap-3 px-4 py-4 border-b border-white/[0.03] text-left transition-all duration-200 relative group ${activeChat?.id === chat.id ? "bg-white/5" : "hover:bg-white/[0.03]"}`}>
                      {activeChat?.id === chat.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-10 bg-[hsl(48,96%,53%)] rounded-r" />}
                      <div className="relative flex-shrink-0">
                        <img src={chat.personaImage} alt={chat.personaName} className="w-11 h-11 rounded-xl object-cover" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[hsl(0,0%,4%)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`font-bold text-sm truncate ${activeChat?.id === chat.id ? "text-white" : "text-white/75 group-hover:text-white/90"}`}>{chat.username}</span>
                          <span className="text-[9px] text-zinc-600 flex-shrink-0 font-medium">{fmt(chat.updatedAt)}</span>
                        </div>
                        <div className="text-xs font-semibold text-[hsl(48,96%,53%)]/70 mb-0.5">↔ {chat.personaName}</div>
                        {chat.lastMessage && <div className="text-[11px] text-zinc-600 truncate leading-tight">{chat.lastMessage}</div>}
                      </div>
                    </motion.button>
                  ))
                )}
              </div>
            </motion.aside>

            <div className={`flex-1 overflow-hidden ${showPanel ? "flex" : "hidden md:flex"} flex-col`}>
              {activeChat ? (
                <AnimatePresence mode="wait">
                  <motion.div key={activeChat.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="h-full">
                    <AdminChatPanel chat={activeChat} personas={personas} onBack={() => setShowPanel(false)} />
                  </motion.div>
                </AnimatePresence>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-[hsl(48,96%,53%)]/5 border border-[hsl(48,96%,53%)]/10 flex items-center justify-center">
                    <MessageSquare className="w-9 h-9 text-[hsl(48,96%,53%)]/30" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-xl">Select a conversation</p>
                    <p className="text-zinc-500 text-sm mt-2 max-w-xs leading-relaxed">Choose a user chat from the sidebar to view the full history and reply as any persona.</p>
                  </div>
                  {personas.length > 0 && (
                    <div className="flex gap-3 mt-2">
                      {personas.slice(0, 3).map((p) => (
                        <div key={p.id} className="flex flex-col items-center gap-2">
                          {p.avatar
                            ? <img src={p.avatar} alt={p.displayName} className="w-12 h-12 rounded-2xl object-cover grayscale opacity-30" />
                            : <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 font-black">{p.displayName[0]}</div>
                          }
                          <span className="text-[10px] text-zinc-700 font-medium">{p.displayName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </>
        )}

        {/* Personas tab */}
        {activeTab === "personas" && (
          <PersonaManager
            personas={personas}
            onEdit={(p) => setFormState({ mode: "edit", persona: p })}
            onCreate={() => setFormState({ mode: "create" })}
            onRestoreDefaults={restoreDefaults}
          />
        )}
      </div>

      {/* Persona form modal */}
      <AnimatePresence>
        {formState && (
          <PersonaFormModal
            key={formState.mode === "edit" ? formState.persona.id : "create"}
            mode={formState.mode}
            persona={formState.mode === "edit" ? formState.persona : undefined}
            onClose={() => setFormState(null)}
            onSave={() => setFormState(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
