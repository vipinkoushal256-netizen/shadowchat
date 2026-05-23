import { createContext, useContext, useEffect, useState, useMemo } from "react";
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
  /** Always non-empty — Firebase uid on success, localStorage fallback on failure. */
  uid: string;
  loading: boolean;
  error: string | null;
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

const ADJECTIVES = ["Shadow","Midnight","Velvet","Neon","Phantom","Crimson","Silent","Obsidian","Ghost","Eclipse"];
const NOUNS      = ["Wolf","Specter","Cipher","Veil","Wraith","Pulse","Drift","Ember","Storm","Mirage"];

function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}${noun}${Math.floor(Math.random() * 9000) + 1000}`;
}

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
  const [user, setUser]               = useState<User | null>(null);
  const [userData, setUserData]       = useState<UserData | null>(null);
  const [uid, setUid]                 = useState<string>("");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [signInError, setSignInError] = useState<SignInError | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setUid(firebaseUser.uid);
        setSignInError(null);

        try {
          const userRef  = doc(db, "users", firebaseUser.uid);
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
          if (import.meta.env.DEV) console.error("[Auth] Firestore error:", msg);
          if (msg.includes("Missing or insufficient permissions")) setError("firestore-permissions");
        } finally {
          setLoading(false);
        }
      } else {
        try {
          await signInAnonymously(auth);
          // success: onAuthStateChanged fires again with the new user
        } catch (err: unknown) {
          const code    = (err as { code?: string }).code    ?? "unknown";
          const message = (err as { message?: string }).message ?? String(err);
          console.error("[Auth] signInAnonymously failed:", code);

          setSignInError({ code, message });

          const fallbackUid = getLocalFallbackUid();
          setUid(fallbackUid);
          setUserData({ uid: fallbackUid, username: generateUsername(), points: 0, createdAt: null });
          setLoading(false);
        }
      }
    });

    return unsubscribe;
  }, []);

  // Memoize so consumers only re-render when their actual values change
  const value = useMemo<AuthContextValue>(
    () => ({ user, userData, uid, loading, error, signInError }),
    [user, userData, uid, loading, error, signInError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
