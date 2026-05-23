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

// Diagnostic: log which config values are present (never log apiKey value).
console.log("[Firebase] initializeApp — config check:", {
  apiKey:            firebaseConfig.apiKey      ? `set (len=${firebaseConfig.apiKey.length})`      : "MISSING",
  authDomain:        firebaseConfig.authDomain  ? firebaseConfig.authDomain                         : "MISSING",
  projectId:         firebaseConfig.projectId   ? firebaseConfig.projectId                          : "MISSING",
  appId:             firebaseConfig.appId       ? `set (len=${firebaseConfig.appId.length})`        : "MISSING",
  currentOrigin:     typeof window !== "undefined" ? window.location.origin : "(non-browser)",
});

const app = initializeApp(firebaseConfig);
console.log("[Firebase] initializeApp OK — name:", app.name, "projectId:", app.options.projectId);

export const auth = getAuth(app);
console.log("[Firebase] getAuth OK — app:", auth.app.name, "currentUser at init:", auth.currentUser?.uid ?? "null (expected)");

export const db = getFirestore(app);
console.log("[Firebase] getFirestore OK");
