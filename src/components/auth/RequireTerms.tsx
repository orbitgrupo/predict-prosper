import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export function RequireTerms({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto space-y-4 px-4 py-10" aria-hidden="true">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Only gate authenticated users who haven't accepted terms
  if (user && profile && !profile.accepted_terms) {
    return <Navigate to="/terms" replace />;
  }

  return <>{children}</>;
}
