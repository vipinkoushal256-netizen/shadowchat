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
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userData: null,
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

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
          if (msg.includes("Missing or insufficient permissions")) {
            setError("firestore-permissions");
          } else {
            console.error("Firestore error:", err);
          }
        } finally {
          setLoading(false);
        }
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Anonymous sign-in failed:", err);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
