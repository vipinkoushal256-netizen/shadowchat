import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { type Persona, DEFAULT_PERSONAS } from "@/lib/personas";

/**
 * Real-time personas hook.
 *
 * Reads from the flat `personas` collection — one document per persona.
 * Starts with DEFAULT_PERSONAS so the sidebar is always instantly populated.
 * Firestore data replaces defaults ~1-3 s after auth resolves (long-polling
 * on Vercel means ACKs arrive on the next poll cycle, not immediately).
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

      console.log(`[usePersonas] subscribing to personas collection (uid=${user.uid.slice(0, 8)})`);

      firestoreUnsub = onSnapshot(
        collection(db, "personas"),
        (snap) => {
          console.log(`[usePersonas] snapshot — docs:${snap.docs.length}`);

          const list: Persona[] = snap.docs
            .filter((d) => {
              const data = d.data();
              return typeof data.username === "string" && typeof data.displayName === "string";
            })
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Persona, "id">) }));

          list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          console.log(
            `[usePersonas] setPersonas(${list.length}):`,
            list.map((p) => `${p.username}(${p.id.slice(0, 6)})`).join(", ")
          );

          // Always update — even empty list clears stale defaults once
          // Firestore is confirmed reachable.
          setPersonas(list.length > 0 ? list : DEFAULT_PERSONAS.map(
            (p): Persona => ({ ...p, id: p.username, createdAt: null })
          ));
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
