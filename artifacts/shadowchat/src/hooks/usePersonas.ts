import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { type Persona } from "@/lib/personas";

/**
 * Subscribes to the `personas` collection.
 * Returns only Firestore data — no fake local state, no defaults injected.
 * Loading is true until the first snapshot (or error) arrives.
 */
export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let firestoreUnsub: (() => void) | undefined;

    const authUnsub = onAuthStateChanged(auth, (user) => {
      firestoreUnsub?.();
      firestoreUnsub = undefined;
      if (!user) { setLoading(true); return; }

      firestoreUnsub = onSnapshot(
        collection(db, "personas"),
        (snap) => {
          const list = snap.docs
            .filter((d) => d.data().username && d.data().displayName)
            .map((d) => ({ id: d.id, ...d.data() } as Persona));
          list.sort((a, b) => a.displayName.localeCompare(b.displayName));
          setPersonas(list);
          setLoading(false);
        },
        (err) => {
          console.error("[usePersonas]", err.code, err.message);
          setLoading(false);
        }
      );
    });

    return () => { authUnsub(); firestoreUnsub?.(); };
  }, []);

  return { personas, loading };
}
