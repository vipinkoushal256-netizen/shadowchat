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
import { db, auth } from "@/lib/firebase";

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

export function subscribePersonas(
  onData: (list: FSPersona[]) => void,
  onError?: (code: string) => void
): () => void {
  const col = collection(db, "personas");
  console.log("[subscribePersonas] LISTEN — path:", col.path, "| db.app:", db.app.name, "| project:", db.app.options.projectId);

  // NOTE: intentionally NO { includeMetadataChanges: true } here.
  // With experimentalForceLongPolling the metadata-change events compete with
  // write ACKs on the same long-poll channel, causing addDoc to never resolve.
  return onSnapshot(
    col,
    (snap) => {
      console.log(
        "[subscribePersonas] SNAP — docs:", snap.docs.length,
        "| fromCache:", snap.metadata.fromCache,
        "| hasPendingWrites:", snap.metadata.hasPendingWrites,
      );
      const list = snap.docs
        .filter((d) => d.data().username && d.data().displayName)
        .map((d) => ({ id: d.id, ...d.data() } as FSPersona));
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      onData(list);
    },
    (err) => {
      console.error("[subscribePersonas] ERROR — code:", err.code, "| msg:", err.message);
      onError?.(err.code);
    }
  );
}

export async function createPersona(data: Omit<FSPersona, "id">): Promise<void> {
  const col = collection(db, "personas");
  const cu  = auth.currentUser;

  console.log(
    "[createPersona] START",
    "| path:", col.path,
    "| db.app:", db.app.name, "| project:", db.app.options.projectId,
    "| auth:", cu ? `uid=${cu.uid.slice(0,8)} anon=${cu.isAnonymous}` : "NULL",
  );

  if (!cu) {
    const err = Object.assign(new Error("no auth at write time"), { code: "unauthenticated" });
    console.error("[createPersona] ABORT — auth.currentUser is null");
    throw err;
  }

  const hangTimer = setTimeout(() => {
    console.error(
      "[createPersona] HUNG >5s — addDoc pending.",
      "| db.app:", db.app.name,
      "| Cause: includeMetadataChanges conflicts with long-poll write ACK (should be fixed now).",
    );
  }, 5000);

  try {
    const ref = await addDoc(col, { ...data, createdAt: serverTimestamp() });
    clearTimeout(hangTimer);
    console.log("[createPersona] SUCCESS — id:", ref.id, "| db.app:", db.app.name);
  } catch (err: unknown) {
    clearTimeout(hangTimer);
    const e = err as { code?: string; message?: string };
    console.error("[createPersona] REJECTED — code:", e.code, "| msg:", e.message);
    throw err;
  }
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
