import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { type Persona, DEFAULT_PERSONAS } from "@/lib/personas";

/**
 * Real-time personas hook.
 *
 * Starts with DEFAULT_PERSONAS (loading=false) so the sidebar is always
 * instantly populated. Firestore data silently replaces defaults ~1 s after
 * auth resolves. No blocking spinner ever shown.
 */
export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>(() =>
    DEFAULT_PERSONAS.map((p): Persona => ({ ...p, id: p.username, createdAt: null }))
  );

  useEffect(() => {
    let firestoreUnsub: (() => void) | undefined;

    const authUnsub = onAuthStateChanged(auth, (user) => {
      firestoreUnsub?.();
      firestoreUnsub = undefined;

      if (!user) return;

      console.log(`[usePersonas] subscribing to config/personas (uid=${user.uid.slice(0,8)})`);

      firestoreUnsub = onSnapshot(
        doc(db, "config", "personas"),
        (snap) => {
          console.log(`[usePersonas] snapshot received — exists:${snap.exists()} keys:${snap.exists() ? Object.keys(snap.data() ?? {}).length : 0}`);

          if (!snap.exists()) return;

          const raw = snap.data() as Record<string, unknown>;
          const list: Persona[] = [];

          for (const [key, val] of Object.entries(raw)) {
            if (
              typeof val === "object" &&
              val !== null &&
              "username" in val &&
              "displayName" in val
            ) {
              list.push({ id: key, ...(val as Omit<Persona, "id">) });
            }
          }

          list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          console.log(`[usePersonas] setPersonas(${list.length} items):`, list.map(p => p.username).join(", "));
          if (list.length > 0) setPersonas(list);
        },
        (err) => {
          console.error("[usePersonas] snapshot error:", err.code, err.message);
        }
      );
    });

    return () => {
      authUnsub();
      firestoreUnsub?.();
    };
  }, []);

  return { personas, loading: false as const };
}
