/**
 * TestCreatePage.tsx — ISOLATED FIRESTORE WRITE TEST.
 * No modal, no animation, no abstraction, no shared components.
 * Imports app/auth/db from lib/firebase to guarantee ONE shared instance.
 */

import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { app, auth, db } from "@/lib/firebase";

export default function TestCreatePage() {
  const [uid,         setUid]         = useState<string>("(waiting for auth...)");
  const [displayName, setDisplayName] = useState("Test Persona " + Date.now().toString().slice(-4));
  const [username,    setUsername]    = useState("testpersona" + Date.now().toString().slice(-4));
  const [saving,      setSaving]      = useState(false);
  const [status,      setStatus]      = useState("");
  const [error,       setError]       = useState("");
  const [docCount,    setDocCount]    = useState<number | null>(null);
  const [log,         setLog]         = useState<string[]>([]);

  function addLog(msg: string) {
    console.log("[TestPage]", msg);
    setLog((prev) => [...prev.slice(-19), new Date().toISOString().slice(11, 23) + " " + msg]);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    addLog("AUTH LISTENER ATTACHED — app.name=" + app.name + " projectId=" + app.options.projectId);
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        addLog("AUTH SUCCESS uid=" + user.uid.slice(0, 8) + " anon=" + user.isAnonymous);
        setUid(user.uid);
      } else {
        addLog("no session — signInAnonymously...");
        try {
          await signInAnonymously(auth);
        } catch (e: unknown) {
          const code = (e as { code?: string }).code ?? "?";
          addLog("AUTH FAILED code=" + code);
          setUid("AUTH FAILED: " + code);
        }
      }
    });
    return unsub;
  }, []);

  // ── Snapshot listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid || uid.startsWith("(") || uid.startsWith("AUTH")) return;
    addLog("SNAPSHOT LISTEN personas...");
    const unsub = onSnapshot(
      collection(db, "personas"),
      (snap) => {
        addLog("SNAPSHOT docs=" + snap.docs.length + " fromCache=" + snap.metadata.fromCache);
        setDocCount(snap.docs.length);
      },
      (err) => {
        addLog("SNAPSHOT ERROR " + err.code + ": " + err.message);
        setDocCount(-1);
      }
    );
    return unsub;
  }, [uid]);

  // ── Write ─────────────────────────────────────────────────────────────────
  async function handleCreate() {
    addLog("SAVE START displayName=" + displayName + " username=" + username);
    addLog("db.app.name=" + db.app.name + " projectId=" + db.app.options.projectId);
    setSaving(true);
    setStatus("");
    setError("");

    // 5-second hang detector
    const hangTimer = setTimeout(() => {
      console.error("[TestPage] ADDDOC HUNG — no resolve or reject after 5s");
      addLog("⚠️ ADDDOC HUNG — still waiting after 5s");
    }, 5000);

    let succeeded = false;
    try {
      addLog("addDoc START — collection: personas");
      const ref = await addDoc(collection(db, "personas"), {
        displayName,
        username,
        avatar:         "",
        bio:            "isolation test",
        welcomeMessage: "",
        status:         "online",
        createdAt:      serverTimestamp(),
      });
      addLog("addDoc SUCCESS id=" + ref.id);
      succeeded = true;
    } catch (err: unknown) {
      const e   = err as { code?: string; message?: string };
      const msg = "[" + (e.code ?? "unknown") + "] " + (e.message ?? String(err));
      addLog("SAVE ERROR " + msg);
      console.error("[TestPage] FULL ERROR:", err);
      setError(msg);
    } finally {
      clearTimeout(hangTimer);
      addLog("FINALLY RUN — succeeded=" + succeeded);
      setSaving(false);
      if (succeeded) {
        addLog("WRITE SUCCESS ✅");
        setStatus("SUCCESS");
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const authOk = uid.length > 4 && !uid.startsWith("(") && !uid.startsWith("AUTH");

  return (
    <div style={{ padding: 32, background: "#060606", minHeight: "100dvh", color: "white", fontFamily: "monospace", fontSize: 13 }}>
      <h1 style={{ color: "#facc15", marginTop: 0, fontSize: 18 }}>🔬 Firestore Write Isolation Test</h1>

      {/* Status panel */}
      <div style={{ marginBottom: 20, padding: 14, background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        <div>firebase app: <strong style={{ color: "#a78bfa" }}>{app.name} / {String(app.options.projectId)}</strong></div>
        <div>transport: <strong style={{ color: "#facc15" }}>HTTP long-poll (forceLongPolling=true)</strong></div>
        <div>auth uid: <strong style={{ color: authOk ? "#4ade80" : "#f87171" }}>{uid}</strong></div>
        <div>saving: <strong style={{ color: saving ? "#facc15" : "#4ade80" }}>{String(saving)}</strong></div>
        <div>personas in Firestore: <strong style={{ color: "#a78bfa" }}>{docCount === null ? "(loading)" : docCount === -1 ? "ERROR" : docCount}</strong></div>
      </div>

      {/* Form */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ color: "#71717a", display: "block", marginBottom: 4 }}>displayName</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            style={{ padding: "8px 12px", background: "#111", border: "1px solid #333", color: "white", borderRadius: 6, width: 300, fontSize: 13 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#71717a", display: "block", marginBottom: 4 }}>username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            style={{ padding: "8px 12px", background: "#111", border: "1px solid #333", color: "white", borderRadius: 6, width: 300, fontSize: 13 }} />
        </div>
        <button onClick={handleCreate} disabled={saving || !authOk}
          style={{ padding: "11px 28px", background: saving ? "#222" : "#facc15", color: saving ? "#666" : "#000", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Saving... (check log below)" : "Create"}
        </button>
      </div>

      {/* Result */}
      {status === "SUCCESS" && (
        <div style={{ padding: "12px 16px", background: "#052e16", border: "1px solid #4ade80", borderRadius: 8, color: "#4ade80", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          ✅ SUCCESS — persona written to Firestore
        </div>
      )}
      {error && (
        <div style={{ padding: "12px 16px", background: "#450a0a", border: "1px solid #ef4444", borderRadius: 8, color: "#f87171", marginBottom: 12 }}>
          ❌ {error}
        </div>
      )}

      {/* Live log */}
      <div style={{ marginTop: 20 }}>
        <div style={{ color: "#52525b", marginBottom: 6, fontSize: 11 }}>LIVE LOG (last 20 events):</div>
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: 12, minHeight: 120, display: "flex", flexDirection: "column", gap: 3 }}>
          {log.length === 0
            ? <span style={{ color: "#3f3f46" }}>(waiting...)</span>
            : log.map((line, i) => (
                <div key={i} style={{ color: line.includes("SUCCESS") ? "#4ade80" : line.includes("ERROR") || line.includes("HUNG") || line.includes("FAILED") ? "#f87171" : line.includes("FINALLY") || line.includes("START") ? "#facc15" : "#a1a1aa" }}>
                  {line}
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
}
