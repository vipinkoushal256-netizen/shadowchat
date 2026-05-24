/**
 * TestCreatePage.tsx — ISOLATED FIRESTORE WRITE TEST.
 * No modal, no animation, no abstraction, no shared components.
 * Pure science: does addDoc work or not?
 */

import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ── Inline Firebase init (fully self-contained, no imports from lib/) ──────

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app  = getApps()[0] ?? initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Component ──────────────────────────────────────────────────────────────

export default function TestCreatePage() {
  const [uid,         setUid]         = useState<string>("(waiting...)");
  const [displayName, setDisplayName] = useState("Test Persona");
  const [username,    setUsername]    = useState("testpersona");
  const [saving,      setSaving]      = useState(false);
  const [status,      setStatus]      = useState("");
  const [error,       setError]       = useState("");
  const [docCount,    setDocCount]    = useState<number | null>(null);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("[TestCreatePage] AUTH uid=", user.uid);
        setUid(user.uid);
      } else {
        console.log("[TestCreatePage] no user — signInAnonymously...");
        try {
          await signInAnonymously(auth);
        } catch (e: unknown) {
          console.error("[TestCreatePage] auth failed:", e);
          setUid("AUTH FAILED");
        }
      }
    });
    return unsub;
  }, []);

  // ── Snapshot listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (uid === "(waiting...)" || uid === "AUTH FAILED") return;
    console.log("[TestCreatePage] subscribing to personas...");
    const unsub = onSnapshot(
      collection(db, "personas"),
      (snap) => {
        console.log("[TestCreatePage] snapshot docs:", snap.docs.length);
        setDocCount(snap.docs.length);
      },
      (err) => {
        console.error("[TestCreatePage] snapshot error:", err.code, err.message);
        setDocCount(-1);
      }
    );
    return unsub;
  }, [uid]);

  // ── Write ─────────────────────────────────────────────────────────────────
  async function handleCreate() {
    console.log("SAVE START displayName=", displayName, "username=", username);
    setSaving(true);
    setStatus("");
    setError("");

    let succeeded = false;
    try {
      console.log("addDoc START");
      const ref = await addDoc(collection(db, "personas"), {
        displayName,
        username,
        avatar: "",
        bio: "Auto test",
        welcomeMessage: "Hello from test",
        status: "online",
        createdAt: serverTimestamp(),
      });
      console.log("addDoc SUCCESS id=", ref.id);
      succeeded = true;
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.error("SAVE ERROR code=", e.code, "message=", e.message, err);
      setError("[" + (e.code ?? "unknown") + "] " + (e.message ?? String(err)));
    } finally {
      console.log("FINALLY RUN — succeeded:", succeeded);
      setSaving(false);
      if (succeeded) {
        console.log("WRITE SUCCESS");
        setStatus("SUCCESS");
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 40, background: "#060606", minHeight: "100dvh", color: "white", fontFamily: "monospace", fontSize: 14 }}>
      <h1 style={{ color: "#facc15", marginTop: 0 }}>🔬 Firestore Write Test</h1>

      <div style={{ marginBottom: 24, padding: 16, background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }}>
        <div>auth uid: <strong style={{ color: uid.startsWith("(") || uid === "AUTH FAILED" ? "#f87171" : "#4ade80" }}>{uid}</strong></div>
        <div>saving: <strong style={{ color: saving ? "#facc15" : "#4ade80" }}>{String(saving)}</strong></div>
        <div>personas in Firestore: <strong style={{ color: "#a78bfa" }}>{docCount === null ? "(loading)" : docCount === -1 ? "ERROR" : docCount}</strong></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", color: "#71717a", marginBottom: 4 }}>displayName</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ padding: "8px 12px", background: "#111", border: "1px solid #333", color: "white", borderRadius: 6, width: 280, fontSize: 14 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", color: "#71717a", marginBottom: 4 }}>username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: "8px 12px", background: "#111", border: "1px solid #333", color: "white", borderRadius: 6, width: 280, fontSize: 14 }}
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={saving || !displayName.trim() || !username.trim()}
          style={{ padding: "12px 28px", background: saving ? "#333" : "#facc15", color: saving ? "#888" : "#000", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: saving ? "not-allowed" : "pointer" }}
        >
          {saving ? "Saving..." : "Create"}
        </button>
      </div>

      {status === "SUCCESS" && (
        <div style={{ padding: "12px 20px", background: "#052e16", border: "1px solid #4ade80", borderRadius: 8, color: "#4ade80", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
          ✅ SUCCESS — persona written to Firestore
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 20px", background: "#450a0a", border: "1px solid #ef4444", borderRadius: 8, color: "#f87171", marginBottom: 12 }}>
          ❌ {error}
        </div>
      )}

      <div style={{ marginTop: 32, color: "#3f3f46", fontSize: 12 }}>
        Open DevTools → Console to see full log sequence:<br />
        SAVE START → addDoc START → addDoc SUCCESS → FINALLY RUN → WRITE SUCCESS
      </div>
    </div>
  );
}
