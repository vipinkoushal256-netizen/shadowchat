/**
 * firestoreService.ts
 * Pure Firestore functions. No wrappers, no retries, no fallbacks.
 * Every function either resolves or throws a plain Firestore error.
 */

import {
  collection, doc,
  addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface FSPersona {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  welcomeMessage: string;
  status: "online" | "offline" | "typing";
}

export interface FSConversation {
  id: string;
  userId: string;
  personaUsername: string;
  personaName: string;
  personaAvatar: string;
  lastMessage: string;
  updatedAt: { toDate: () => Date } | null;
}

export interface FSMessage {
  id: string;
  sender: string;   // uid for user, persona.username for admin reply
  text: string;
  createdAt: { toDate: () => Date } | null;
}

/* ── Personas ────────────────────────────────────────────────────────────── */

const SEED_PERSONA = {
  username:       "shadowhost",
  displayName:    "Shadow Host",
  avatar:         "",
  bio:            "Your mysterious host. Say hello.",
  welcomeMessage: "Welcome to the shadows. What's on your mind?",
  status:         "online" as const,
};

let _seeded = false;

export function subscribePersonas(
  onData: (list: FSPersona[]) => void,
  onError?: (code: string) => void
): () => void {
  const col = collection(db, "personas");
  console.log("LISTENING TO:", col.path, "| db.app.name:", db.app.name, "| projectId:", db.app.options.projectId);

  return onSnapshot(
    col,
    { includeMetadataChanges: true },   // fires twice: once from cache, once from server
    (snap) => {
      console.log(
        "SNAPSHOT SUCCESS personas — docs:", snap.docs.length,
        "| empty:", snap.empty,
        "| fromCache:", snap.metadata.fromCache,
        "| hasPendingWrites:", snap.metadata.hasPendingWrites
      );
      snap.docs.forEach((d, i) =>
        console.log("  doc[" + i + "]", d.id, JSON.stringify(d.data()))
      );

      // Server confirmed (fromCache === false) the collection is genuinely empty.
      // Seed a starter persona so the UI is never blank on first run.
      if (!snap.metadata.fromCache && snap.empty && !_seeded) {
        _seeded = true;
        console.log("[firestoreService] SERVER confirmed empty — seeding starter persona...");
        addDoc(col, { ...SEED_PERSONA, createdAt: serverTimestamp() })
          .then((ref) => console.log("[firestoreService] seed persona created:", ref.id))
          .catch((err: unknown) => {
            const e = err as { code?: string; message?: string };
            console.error("[firestoreService] seed FAILED:", e.code, e.message);
            console.error("[firestoreService] seed FULL ERROR:", JSON.stringify({ code: e.code, message: e.message }));
          });
        return; // don't call onData with empty list — wait for the write to echo back
      }

      // Skip metadata-only events (hasPendingWrites changes etc.) after we have data
      const list = snap.docs
        .filter((d) => d.data().username && d.data().displayName)
        .map((d) => ({ id: d.id, ...d.data() } as FSPersona));
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      onData(list);
    },
    (err) => {
      console.error("SNAPSHOT ERROR personas — FULL ERROR:", JSON.stringify({ code: err.code, message: err.message, name: err.name, stack: err.stack?.split("\n")[0] }));
      console.error("SNAPSHOT ERROR raw:", err);
      onError?.(err.code);
    }
  );
}

export async function createPersona(data: Omit<FSPersona, "id">): Promise<void> {
  await addDoc(collection(db, "personas"), { ...data, createdAt: serverTimestamp() });
}

export async function updatePersona(id: string, data: Partial<Omit<FSPersona, "id">>): Promise<void> {
  await updateDoc(doc(db, "personas", id), data);
}

export async function deletePersona(id: string): Promise<void> {
  await deleteDoc(doc(db, "personas", id));
}

export async function setPersonaStatus(id: string, status: FSPersona["status"]): Promise<void> {
  await updateDoc(doc(db, "personas", id), { status });
}

/* ── Conversations ───────────────────────────────────────────────────────── */

export function subscribeConversations(
  onData: (list: FSConversation[]) => void,
  onError?: (code: string) => void
): () => void {
  return onSnapshot(
    query(collection(db, "conversations"), orderBy("updatedAt", "desc")),
    (snap) => {
      const list = snap.docs
        .filter((d) => d.data().userId)
        .map((d) => ({ id: d.id, ...d.data() } as FSConversation));
      onData(list);
    },
    (err) => {
      console.error("[firestoreService] conversations:", err.code, err.message);
      onError?.(err.code);
    }
  );
}

export async function touchConversation(
  convId: string,
  uid: string,
  persona: FSPersona
): Promise<void> {
  await setDoc(
    doc(db, "conversations", convId),
    {
      userId:          uid,
      personaUsername: persona.username,
      personaName:     persona.displayName,
      personaAvatar:   persona.avatar,
      updatedAt:       serverTimestamp(),
    },
    { merge: true }
  );
}

/* ── Messages ────────────────────────────────────────────────────────────── */

export function subscribeMessages(
  convId: string,
  onData: (list: FSMessage[]) => void,
  onError?: (code: string) => void
): () => void {
  return onSnapshot(
    query(
      collection(db, "conversations", convId, "messages"),
      orderBy("createdAt", "asc"),
      limit(200)
    ),
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FSMessage)));
    },
    (err) => {
      console.error("[firestoreService] messages:", err.code, err.message);
      onError?.(err.code);
    }
  );
}

export async function sendUserMessage(convId: string, uid: string, text: string): Promise<void> {
  await addDoc(collection(db, "conversations", convId, "messages"), {
    sender: uid, text, createdAt: serverTimestamp(),
  });
  await setDoc(
    doc(db, "conversations", convId),
    { lastMessage: text, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function sendAdminReply(convId: string, personaUsername: string, text: string): Promise<void> {
  await addDoc(collection(db, "conversations", convId, "messages"), {
    sender: personaUsername, text, createdAt: serverTimestamp(),
  });
  await setDoc(
    doc(db, "conversations", convId),
    { lastMessage: `${personaUsername}: ${text}`, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
