import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Admin from "@/pages/Admin";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";

const queryClient = new QueryClient();

/* Detect /admin before any router or auth logic touches the path */
function isAdminPath(): boolean {
  const p = window.location.pathname;
  return p === "/admin" || p.endsWith("/admin") || p.startsWith("/admin/");
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/chat/:persona?" component={Chat} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  const { loading } = useAuth();

  if (isAdminPath()) return <Admin />;

  if (loading) return <LoadingScreen />;

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

function App() {
  // Admin path and main app both need AuthProvider so Firestore writes
  // have a valid auth token (rules: request.auth != null).
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          {isAdminPath() ? <Admin /> : <AppInner />}
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
