import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import { initializeFirestore, getFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";

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

console.log("[Firebase] config:", {
  apiKey:    _akDiag,
  authDomain: firebaseConfig.authDomain ?? "MISSING",
  projectId:  firebaseConfig.projectId  ?? "MISSING",
  origin:     typeof window !== "undefined" ? window.location.origin : "(ssr)",
});

/* ── App — single instance ───────────────────────────────────────────────── */

// Guard against HMR re-evaluation creating duplicate app instances.
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
console.log("[Firebase] app OK — project:", app.options.projectId, "name:", app.name, "| new:", getApps().length === 1);

/* ── Auth — eager anonymous sign-in ─────────────────────────────────────── */

export const auth = getAuth(app);

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
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "unknown";
      console.error("[AUTH] FAILED — code:", code, err);
      _rejectAuth(err);
    }
  }
});

/* ── Firestore — force HTTP long-polling (bypasses WebChannel/proxy issues) ─
 *
 * experimentalForceLongPolling: true  — use HTTP long-poll instead of gRPC-Web
 * useFetchStreams: false              — disable fetch-based streaming fallback
 * cacheSizeBytes: CACHE_SIZE_UNLIMITED — no cache eviction
 *
 * This must be called ONCE, before any getFirestore() call anywhere in the app.
 * All other files must import `db` from here — never call getFirestore() again.
 * ─────────────────────────────────────────────────────────────────────────── */

// initializeFirestore throws "failed-precondition" if called again after HMR.
// Fall back to getFirestore() which returns the already-configured instance.
let _db: ReturnType<typeof getFirestore>;
try {
  _db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  });
  console.log("[Firebase] Firestore OK — transport: HTTP long-poll (new instance) | project:", app.options.projectId);
} catch {
  _db = getFirestore(app);
  console.log("[Firebase] Firestore OK — transport: reused existing instance | project:", app.options.projectId);
}
export const db = _db;

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
