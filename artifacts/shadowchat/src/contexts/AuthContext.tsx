import { createContext, useContext, useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface UserData {
  uid: string;
  username: string;
  points: number;
  createdAt: unknown;
}

export interface SignInError {
  code: string;
  message: string;
}

interface AuthContextValue {
  user: User | null;
  userData: UserData | null;
  /** Always a non-empty string — Firebase uid when auth succeeds,
   *  localStorage-based fallback when Firebase auth fails. */
  uid: string;
  loading: boolean;
  /** Generic Firestore permission error string (legacy). */
  error: string | null;
  /** Exact Firebase Auth error from signInAnonymously(), null if auth succeeded. */
  signInError: SignInError | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userData: null,
  uid: "",
  loading: true,
  error: null,
  signInError: null,
});

const ADJECTIVES = ["Shadow", "Midnight", "Velvet", "Neon", "Phantom", "Crimson", "Silent", "Obsidian", "Ghost", "Eclipse"];
const NOUNS = ["Wolf", "Specter", "Cipher", "Veil", "Wraith", "Pulse", "Drift", "Ember", "Storm", "Mirage"];

function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}${noun}${num}`;
}

/** Returns a stable local anonymous uid persisted in localStorage.
 *  Used as a fallback when Firebase anonymous auth fails. */
function getLocalFallbackUid(): string {
  const KEY = "sc-fallback-uid";
  try {
    let stored = localStorage.getItem(KEY);
    if (!stored) {
      stored = `local-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, stored);
    }
    return stored;
  } catch {
    return `local-${Math.random().toString(36).slice(2)}`;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [uid, setUid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<SignInError | null>(null);

  useEffect(() => {
    console.log("[Auth] AuthProvider mounted — origin:", window.location.origin);
    console.log("[Auth] onAuthStateChanged — registering listener");

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("[Auth] onAuthStateChanged — user:", firebaseUser.uid, "isAnon:", firebaseUser.isAnonymous);
        setUser(firebaseUser);
        setUid(firebaseUser.uid);
        setSignInError(null); // clear any previous error

        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            setUserData(userSnap.data() as UserData);
          } else {
            const newUser: UserData = {
              uid: firebaseUser.uid,
              username: generateUsername(),
              points: 0,
              createdAt: serverTimestamp(),
            };
            await setDoc(userRef, newUser);
            setUserData(newUser);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[Auth] Firestore error:", msg);
          if (msg.includes("Missing or insufficient permissions")) {
            setError("firestore-permissions");
          }
          // user/uid are already set — conversation panel can still open
        } finally {
          setLoading(false);
        }
      } else {
        // No user — attempt anonymous sign-in.
        console.log("[Auth] onAuthStateChanged — no user, calling signInAnonymously()");
        console.log("[Auth] signInAnonymously — origin:", window.location.origin, "authDomain:", auth.app.options.authDomain);
        try {
          console.log("[Auth] signInAnonymously — STARTED");
          const cred = await signInAnonymously(auth);
          // success: onAuthStateChanged fires again with the new user
          console.log("[Auth] signInAnonymously — SUCCESS uid:", cred.user.uid);
        } catch (err: unknown) {
          // Capture the exact Firebase error code.
          const code    = (err as { code?: string }).code    ?? "unknown";
          const message = (err as { message?: string }).message ?? String(err);
          console.error("[Auth] signInAnonymously — FAILED");
          console.error("[Auth]   code:   ", code);
          console.error("[Auth]   message:", message);
          console.error("[Auth]   full error object:", err);

          // Surface the exact error so admin UI can display it.
          setSignInError({ code, message });

          // Diagnosis hints based on known codes:
          if (code === "auth/operation-not-allowed") {
            console.error("[Auth] FIX: Enable Anonymous sign-in in Firebase Console → Authentication → Sign-in method");
          } else if (code === "auth/unauthorized-domain") {
            console.error("[Auth] FIX: Add", window.location.hostname, "to Firebase Console → Authentication → Settings → Authorized domains");
          } else if (code === "auth/invalid-api-key") {
            console.error("[Auth] FIX: VITE_FIREBASE_API_KEY is wrong or missing on this host");
          } else if (code === "auth/network-request-failed") {
            console.error("[Auth] FIX: Network blocked — check CSP headers or firewall rules on this host");
          }

          // Fallback uid so the rest of the app stays functional.
          const fallbackUid = getLocalFallbackUid();
          console.log("[Auth] using local fallback uid:", fallbackUid);
          setUid(fallbackUid);
          setUserData({
            uid: fallbackUid,
            username: generateUsername(),
            points: 0,
            createdAt: null,
          });
          setLoading(false);
        }
      }
    });

    return () => {
      console.log("[Auth] AuthProvider unmounted — removing listener");
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, uid, loading, error, signInError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
