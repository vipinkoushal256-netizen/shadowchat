import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { type Persona, DEFAULT_PERSONAS } from "@/lib/personas";

/**
 * Real-time personas hook.
 *
 * DESIGN RATIONALE — why we start with DEFAULT_PERSONAS and loading=false:
 *
 * The previous design started with loading=true and only set it false after
 * Firestore responded.  This caused an infinite loading state in two cases:
 *
 *   1. signInAnonymously() fails (no VITE_FIREBASE_* env vars on Vercel, or
 *      network error).  Firebase Auth fires onAuthStateChanged(null) once and
 *      never fires again — the Firestore listener is never attached.
 *
 *   2. Auth resolves but Firestore is unreachable — permission-denied or
 *      network timeout.  loading stays true forever.
 *
 * The fix: initialise state with DEFAULT_PERSONAS and loading=false so the
 * sidebar ALWAYS renders instantly.  Firestore data silently replaces the
 * defaults within ~1 s when auth + network are healthy.  If either fails, the
 * user still sees the full persona list — functional, not broken.
 */
export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>(() => {
    const defaults = DEFAULT_PERSONAS.map(
      (p): Persona => ({ ...p, id: p.username, createdAt: null })
    );
    console.log("[usePersonas] initial state — DEFAULT_PERSONAS:", defaults.length);
    return defaults;
  });

  // loading is permanently false — DEFAULT_PERSONAS are available immediately.
  // Callers that previously gated on loading=true will never see a skeleton.
  const [loading] = useState(false);

  useEffect(() => {
    let firestoreUnsub: (() => void) | undefined;

    console.log("[usePersonas] effect mounted — sidebar pre-populated with defaults");

    const authUnsub = onAuthStateChanged(auth, (user) => {
      // Tear down stale Firestore listener whenever auth changes.
      if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = undefined;
      }

      if (!user) {
        // Auth not resolved yet.  Keep DEFAULT_PERSONAS; sidebar stays functional.
        console.log("[usePersonas] auth: no user — keeping defaults");
        return;
      }

      console.log(
        "[usePersonas] auth ready uid:",
        user.uid.slice(0, 8),
        "— attaching Firestore listener"
      );

      firestoreUnsub = onSnapshot(
        doc(db, "chats", "_personas_config_"),
        (snap) => {
          console.log(
            "[usePersonas] snapshot received — exists:",
            snap.exists()
          );

          if (!snap.exists()) {
            // Config doc not created yet — keep DEFAULT_PERSONAS.
            console.log(
              "[usePersonas] _personas_config_ absent — keeping defaults"
            );
            return;
          }

          const raw = snap.data() as Record<string, unknown>;
          console.log(
            "[usePersonas] raw field count:",
            Object.keys(raw).length,
            "keys:",
            Object.keys(raw)
          );

          const list: Persona[] = [];
          for (const [key, val] of Object.entries(raw)) {
            if (
              typeof val === "object" &&
              val !== null &&
              "username" in val &&
              "displayName" in val
            ) {
              list.push({ id: key, ...(val as Omit<Persona, "id">) });
            } else {
              console.log("[usePersonas] skipped field:", key, typeof val);
            }
          }

          list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          console.log(
            "[usePersonas] parsed",
            list.length,
            "Firestore personas:",
            list.map((p) => p.username)
          );

          if (list.length > 0) {
            setPersonas(list);
            console.log(
              "[usePersonas] state updated — sidebar will re-render with",
              list.length,
              "Firestore personas"
            );
          } else {
            console.log(
              "[usePersonas] Firestore list empty — keeping defaults"
            );
          }
        },
        (err) => {
          // Firestore unavailable — keep DEFAULT_PERSONAS.  Sidebar stays functional.
          console.error(
            "[usePersonas] snapshot error:",
            err.code,
            err.message
          );
          console.log("[usePersonas] falling back to DEFAULT_PERSONAS");
        }
      );
    });

    return () => {
      console.log("[usePersonas] effect cleanup");
      authUnsub();
      if (firestoreUnsub) firestoreUnsub();
    };
  }, []);

  return { personas, loading };
}
