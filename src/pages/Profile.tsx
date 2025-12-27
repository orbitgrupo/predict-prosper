import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { ProfileInfo } from '@/components/profile/ProfileInfo';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { TransactionHistory } from '@/components/profile/TransactionHistory';
import { BettingHistory } from '@/components/profile/BettingHistory';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Profile() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Mi Perfil</h1>
          <p className="mt-2 text-muted-foreground">
            Gestiona tu cuenta y revisa tu historial.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Sidebar con info del perfil */}
          <div className="lg:col-span-1">
            <ProfileInfo profile={profile} userId={user.id} />
          </div>

          {/* Contenido principal */}
          <div className="lg:col-span-2 space-y-8">
            <ProfileStats userId={user.id} />
            
            <Tabs defaultValue="transactions" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="transactions">Transacciones</TabsTrigger>
                <TabsTrigger value="bets">Historial de Apuestas</TabsTrigger>
              </TabsList>
              <TabsContent value="transactions" className="mt-4">
                <TransactionHistory userId={user.id} />
              </TabsContent>
              <TabsContent value="bets" className="mt-4">
                <BettingHistory userId={user.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
