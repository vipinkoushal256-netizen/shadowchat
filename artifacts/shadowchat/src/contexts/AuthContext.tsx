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

interface AuthContextValue {
  user: User | null;
  userData: UserData | null;
  /** Always a non-empty string — Firebase uid when auth succeeds,
   *  localStorage-based fallback when Firebase auth fails. */
  uid: string;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userData: null,
  uid: "",
  loading: true,
  error: null,
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("[Auth] firebase user:", firebaseUser.uid);
        setUser(firebaseUser);
        setUid(firebaseUser.uid);

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
        console.log("[Auth] no user — attempting anonymous sign-in");
        try {
          await signInAnonymously(auth);
          // success: next onAuthStateChanged fires with the new user
        } catch (err) {
          console.error("[Auth] anonymous sign-in failed:", err);
          // Firebase auth unavailable — generate a local fallback uid so the
          // app stays functional (read-only Firestore rules permitting)
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

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, uid, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
