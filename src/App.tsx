import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { RequireTerms } from "@/components/auth/RequireTerms";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Markets = lazy(() => import("./pages/Markets"));
const MarketDetail = lazy(() => import("./pages/MarketDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Terms = lazy(() => import("./pages/Terms"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Cargando" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<RequireTerms requireAuth><Dashboard /></RequireTerms>} />
              <Route path="/markets" element={<RequireTerms><Markets /></RequireTerms>} />
              <Route path="/market/:id" element={<RequireTerms><MarketDetail /></RequireTerms>} />
              <Route path="/admin" element={<RequireTerms requireAuth><Admin /></RequireTerms>} />
              <Route path="/profile" element={<RequireTerms requireAuth><Profile /></RequireTerms>} />
              <Route path="/notifications" element={<RequireTerms requireAuth><Notifications /></RequireTerms>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
