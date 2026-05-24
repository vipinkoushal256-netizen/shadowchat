import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import NewChatPage from "@/pages/NewChatPage";
import NewAdminPage from "@/pages/NewAdminPage";
import TestCreatePage from "@/pages/TestCreatePage";

const queryClient = new QueryClient();

function isAdminPath(): boolean {
  const p = window.location.pathname;
  return p === "/admin" || p.endsWith("/admin") || p.startsWith("/admin/");
}

function isTestPath(): boolean {
  const p = window.location.pathname;
  return p === "/test-create" || p.endsWith("/test-create");
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/chat/:persona?" component={NewChatPage} />
      <Route path="/admin" component={NewAdminPage} />
      <Route path="/test-create" component={TestCreatePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  if (isTestPath()) {
    return <TestCreatePage />;
  }

  if (isAdminPath()) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <NewAdminPage />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
