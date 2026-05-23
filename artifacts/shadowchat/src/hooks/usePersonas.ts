import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Persona } from "@/lib/personas";

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "personas"), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPersonas(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Persona, "id">) }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("[usePersonas] Firestore error:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { personas, loading };
}
