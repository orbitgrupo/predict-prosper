import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { RequireTerms } from "@/components/auth/RequireTerms";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Markets from "./pages/Markets";
import MarketDetail from "./pages/MarketDetail";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Notifications from "./pages/Notifications";
import Terms from "./pages/Terms";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<RequireTerms><Dashboard /></RequireTerms>} />
            <Route path="/markets" element={<RequireTerms><Markets /></RequireTerms>} />
            <Route path="/market/:id" element={<RequireTerms><MarketDetail /></RequireTerms>} />
            <Route path="/admin" element={<RequireTerms><Admin /></RequireTerms>} />
            <Route path="/profile" element={<RequireTerms><Profile /></RequireTerms>} />
            <Route path="/notifications" element={<RequireTerms><Notifications /></RequireTerms>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
