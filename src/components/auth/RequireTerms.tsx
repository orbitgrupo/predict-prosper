import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface RequireTermsProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function RequireTerms({ children, requireAuth = false }: RequireTermsProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (user && profile && !profile.accepted_terms) {
    return <Navigate to="/terms" replace />;
  }

  return <>{children}</>;
}
