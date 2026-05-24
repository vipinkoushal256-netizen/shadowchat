import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/* ── Config ──────────────────────────────────────────────────────────────── */

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const _ak     = firebaseConfig.apiKey;
const _akDiag = _ak == null ? "UNDEFINED/NULL"
  : typeof _ak !== "string" ? `WRONG TYPE: ${typeof _ak}`
  : _ak.length === 0 ? "EMPTY STRING"
  : [`len=${_ak.length}`, `starts="${_ak.slice(0, 8)}"`, `char0=${_ak.charCodeAt(0)}(${_ak[0]})`, `trimMatch=${_ak === _ak.trim()}`, `hasNewline=${_ak.includes("\n") || _ak.includes("\r")}`].join(" | ");

console.log("[Firebase] config:", { apiKey: _akDiag, authDomain: firebaseConfig.authDomain ?? "MISSING", projectId: firebaseConfig.projectId ?? "MISSING", origin: typeof window !== "undefined" ? window.location.origin : "(ssr)" });

const app = initializeApp(firebaseConfig);
console.log("[Firebase] initializeApp OK — project:", app.options.projectId);

/* ── Auth — eager anonymous sign-in ─────────────────────────────────────── */

export const auth = getAuth(app);

// authReady resolves with the Firebase User once anonymous sign-in completes.
// Every component and service must await this before touching Firestore.
let _resolveAuth!: (user: User) => void;
let _rejectAuth!:  (err: unknown) => void;

export const authReady: Promise<User> = new Promise((resolve, reject) => {
  _resolveAuth = resolve;
  _rejectAuth  = reject;
});

console.log("[AUTH] START — waiting for Firebase Auth state...");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("[AUTH] SUCCESS — uid:", user.uid.slice(0, 8), "| anon:", user.isAnonymous);
    _resolveAuth(user);
  } else {
    console.log("[AUTH] no session — calling signInAnonymously...");
    try {
      await signInAnonymously(auth);
      // onAuthStateChanged fires again with the new user → resolves authReady
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "unknown";
      console.error("[AUTH] FAILED — code:", code, err);
      _rejectAuth(err);
    }
  }
});

/* ── Firestore ───────────────────────────────────────────────────────────── */

export const db = getFirestore(app);
console.log("[Firebase] getFirestore OK");

/* ── Diagnostics ─────────────────────────────────────────────────────────── */

export const firebaseDiagnostics = {
  apiKeyDiag:   _akDiag,
  authDomain:   firebaseConfig.authDomain ?? "MISSING",
  projectId:    firebaseConfig.projectId  ?? "MISSING",
  appIdPresent: !!firebaseConfig.appId,
  apiKeyPrefix: typeof _ak === "string" && _ak.length >= 8 ? _ak.slice(0, 8) : "(n/a)",
  apiKeyChar0:  typeof _ak === "string" && _ak.length > 0  ? _ak.charCodeAt(0) : -1,
  apiKeyLen:    typeof _ak === "string" ? _ak.length : -1,
  apiKeyTrimOk: typeof _ak === "string" ? _ak === _ak.trim() : false,
  origin:       typeof window !== "undefined" ? window.location.origin : "",
};
