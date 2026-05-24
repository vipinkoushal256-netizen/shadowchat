import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// ─── Production diagnostics ───────────────────────────────────────────────────
// Logs char-level detail so quote/whitespace corruption is detectable even in
// minified production bundles. Never logs the full key value.
const _ak = firebaseConfig.apiKey;
const _akDiag = _ak == null
  ? "UNDEFINED/NULL"
  : typeof _ak !== "string"
    ? `WRONG TYPE: ${typeof _ak}`
    : _ak.length === 0
      ? "EMPTY STRING"
      : [
          `len=${_ak.length}`,
          `starts="${_ak.slice(0, 8)}"`,
          `char0=${_ak.charCodeAt(0)}(${_ak[0]})`, // 65=A ok | 34=" = extra quote | 32= space
          `trimMatch=${_ak === _ak.trim()}`,         // false → leading/trailing whitespace
          `hasNewline=${_ak.includes("\n") || _ak.includes("\r")}`,
        ].join(" | ");

console.log("[Firebase] config diagnostics:", {
  apiKey:            _akDiag,
  authDomain:        firebaseConfig.authDomain   ?? "MISSING",
  projectId:         firebaseConfig.projectId    ?? "MISSING",
  appId:             firebaseConfig.appId        ? `set(len=${firebaseConfig.appId.length})` : "MISSING",
  origin:            typeof window !== "undefined" ? window.location.origin : "(ssr)",
  NODE_ENV:          import.meta.env.MODE,
});

const app = initializeApp(firebaseConfig);
console.log("[Firebase] initializeApp OK — project:", app.options.projectId);

export const auth = getAuth(app);
console.log("[Firebase] getAuth OK — currentUser:", auth.currentUser?.uid ?? "null (expected on cold load)");

export const db = getFirestore(app);
console.log("[Firebase] getFirestore OK");

// Export raw diagnostics so Admin can render them on-screen.
export const firebaseDiagnostics = {
  apiKeyDiag:   _akDiag,
  authDomain:   firebaseConfig.authDomain   ?? "MISSING",
  projectId:    firebaseConfig.projectId    ?? "MISSING",
  appIdPresent: !!firebaseConfig.appId,
  // First 8 chars of the apiKey — safe to show (not the full key).
  apiKeyPrefix: typeof _ak === "string" && _ak.length >= 8 ? _ak.slice(0, 8) : "(n/a)",
  apiKeyChar0:  typeof _ak === "string" && _ak.length > 0  ? _ak.charCodeAt(0) : -1,
  apiKeyLen:    typeof _ak === "string" ? _ak.length : -1,
  apiKeyTrimOk: typeof _ak === "string" ? _ak === _ak.trim() : false,
  origin:       typeof window !== "undefined" ? window.location.origin : "",
};
