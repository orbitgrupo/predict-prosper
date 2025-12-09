import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useMarkets, Market } from '@/hooks/useMarkets';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Loader2, 
  TrendingUp, 
  Users, 
  DollarSign,
  CheckCircle,
  XCircle,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CATEGORIES = ['Política', 'Deportes', 'Tecnología', 'Economía', 'Entretenimiento', 'Otro'];

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const { data: markets, isLoading } = useMarkets();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create market form
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMarket, setNewMarket] = useState({
    title: '',
    description: '',
    category: '',
    closes_at: '',
    image_url: '',
  });

  // Resolve market
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [marketToResolve, setMarketToResolve] = useState<Market | null>(null);
  const [resolveOption, setResolveOption] = useState<'yes' | 'no' | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVolume: 0,
    activeMarkets: 0,
  });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (markets) {
      const totalVolume = markets.reduce(
        (acc, m) => acc + Number(m.total_yes_amount) + Number(m.total_no_amount),
        0
      );
      const activeMarkets = markets.filter(m => m.status === 'active').length;
      setStats(prev => ({ ...prev, totalVolume, activeMarkets }));
    }
  }, [markets]);

  useEffect(() => {
    async function fetchUsers() {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      setStats(prev => ({ ...prev, totalUsers: count || 0 }));
    }
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleCreateMarket = async () => {
    if (!newMarket.title || !newMarket.closes_at) {
      toast({
        title: 'Error',
        description: 'Título y fecha de cierre son requeridos.',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('markets').insert({
        title: newMarket.title,
        description: newMarket.description || null,
        category: newMarket.category || null,
        closes_at: new Date(newMarket.closes_at).toISOString(),
        created_by: user?.id,
        image_url: newMarket.image_url || null,
      });

      if (error) throw error;

      toast({
        title: 'Mercado creado',
        description: 'El mercado se ha creado correctamente.',
      });
      
      setCreateDialogOpen(false);
      setNewMarket({ title: '', description: '', category: '', closes_at: '', image_url: '' });
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleResolveMarket = async () => {
    if (!marketToResolve || !resolveOption) return;

    setResolving(true);
    try {
      // Update market status
      const { error: marketError } = await supabase
        .from('markets')
        .update({
          status: 'resolved',
          resolved_option: resolveOption,
        })
        .eq('id', marketToResolve.id);

      if (marketError) throw marketError;

      // Get all bets for this market
      const { data: bets, error: betsError } = await supabase
        .from('bets')
        .select('*')
        .eq('market_id', marketToResolve.id);

      if (betsError) throw betsError;

      const winningBets = bets?.filter(b => b.option === resolveOption) || [];
      const losingBets = bets?.filter(b => b.option !== resolveOption) || [];
      
      const totalWinning = winningBets.reduce((acc, b) => acc + Number(b.amount), 0);
      const totalLosing = losingBets.reduce((acc, b) => acc + Number(b.amount), 0);

      // Calculate and distribute payouts
      for (const bet of winningBets) {
        const betAmount = Number(bet.amount);
        const winShare = totalWinning > 0 ? betAmount / totalWinning : 0;
        const payout = betAmount + (totalLosing * winShare);

        // Update bet
        await supabase
          .from('bets')
          .update({ is_winner: true, payout_amount: payout })
          .eq('id', bet.id);

        // Update user balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', bet.user_id)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ balance: Number(profile.balance) + payout })
            .eq('id', bet.user_id);

          // Record transaction
          await supabase.from('transactions').insert({
            user_id: bet.user_id,
            type: 'payout',
            amount: payout,
            description: `Ganancia: ${marketToResolve.title}`,
            market_id: marketToResolve.id,
          });
        }
      }

      // Mark losing bets
      for (const bet of losingBets) {
        await supabase
          .from('bets')
          .update({ is_winner: false, payout_amount: 0 })
          .eq('id', bet.id);
      }

      toast({
        title: 'Mercado resuelto',
        description: `El mercado se ha resuelto como "${resolveOption === 'yes' ? 'Sí' : 'No'}".`,
      });

      setResolveDialogOpen(false);
      setMarketToResolve(null);
      setResolveOption(null);
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setResolving(false);
    }
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const activeMarkets = markets?.filter(m => m.status === 'active') || [];
  const resolvedMarkets = markets?.filter(m => m.status === 'resolved') || [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Panel de Administración</h1>
            <p className="mt-2 text-muted-foreground">
              Gestiona mercados, usuarios y configuración.
            </p>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Crear mercado
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear nuevo mercado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={newMarket.title}
                    onChange={(e) => setNewMarket({ ...newMarket, title: e.target.value })}
                    placeholder="¿Ganará el equipo X el campeonato?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={newMarket.description}
                    onChange={(e) => setNewMarket({ ...newMarket, description: e.target.value })}
                    placeholder="Detalles adicionales sobre el evento..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select
                    value={newMarket.category}
                    onValueChange={(value) => setNewMarket({ ...newMarket, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="closes_at">Fecha de cierre *</Label>
                  <Input
                    id="closes_at"
                    type="datetime-local"
                    value={newMarket.closes_at}
                    onChange={(e) => setNewMarket({ ...newMarket, closes_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image_url">URL de imagen</Label>
                  <Input
                    id="image_url"
                    type="url"
                    value={newMarket.image_url}
                    onChange={(e) => setNewMarket({ ...newMarket, image_url: e.target.value })}
                    placeholder="https://ejemplo.com/imagen.jpg"
                  />
                </div>
                <Button
                  className="w-full" 
                  onClick={handleCreateMarket}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear mercado'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Usuarios totales</p>
                  <p className="font-display text-2xl font-bold">{stats.totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <DollarSign className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Volumen total</p>
                  <p className="font-display text-2xl font-bold">
                    ${stats.totalVolume.toLocaleString('es-ES')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                  <TrendingUp className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mercados activos</p>
                  <p className="font-display text-2xl font-bold">{stats.activeMarkets}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Markets tabs */}
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Activos ({activeMarkets.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resueltos ({resolvedMarkets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeMarkets.length > 0 ? (
              <div className="space-y-4">
                {activeMarkets.map((market) => (
                  <Card key={market.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {market.category && (
                            <Badge variant="outline">{market.category}</Badge>
                          )}
                          <Badge>Activo</Badge>
                        </div>
                        <h3 className="font-medium">{market.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Cierra: {format(new Date(market.closes_at), "dd MMM yyyy, HH:mm", { locale: es })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Volumen: ${(Number(market.total_yes_amount) + Number(market.total_no_amount)).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMarketToResolve(market);
                          setResolveDialogOpen(true);
                        }}
                      >
                        Resolver
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-12 text-center">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 font-display text-lg font-semibold">
                  No hay mercados activos
                </h3>
                <p className="mt-2 text-muted-foreground">
                  Crea un nuevo mercado para comenzar.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolved" className="mt-6">
            {resolvedMarkets.length > 0 ? (
              <div className="space-y-4">
                {resolvedMarkets.map((market) => (
                  <Card key={market.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {market.category && (
                            <Badge variant="outline">{market.category}</Badge>
                          )}
                          <Badge variant="secondary">Resuelto</Badge>
                          <Badge className={market.resolved_option === 'yes' ? 'bg-yes' : 'bg-no'}>
                            {market.resolved_option === 'yes' ? 'Sí' : 'No'}
                          </Badge>
                        </div>
                        <h3 className="font-medium">{market.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Volumen: ${(Number(market.total_yes_amount) + Number(market.total_no_amount)).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-12 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 font-display text-lg font-semibold">
                  No hay mercados resueltos
                </h3>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Resolve dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolver mercado</DialogTitle>
            </DialogHeader>
            {marketToResolve && (
              <div className="space-y-4 pt-4">
                <p className="font-medium">{marketToResolve.title}</p>
                <p className="text-sm text-muted-foreground">
                  Selecciona el resultado final de este mercado. Esta acción distribuirá
                  automáticamente las ganancias a los apostadores ganadores.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={resolveOption === 'yes' ? 'default' : 'outline'}
                    className={`h-16 flex-col gap-1 ${
                      resolveOption === 'yes' 
                        ? 'bg-yes hover:bg-yes/90' 
                        : 'hover:border-yes hover:text-yes'
                    }`}
                    onClick={() => setResolveOption('yes')}
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span>Sí</span>
                  </Button>
                  <Button
                    variant={resolveOption === 'no' ? 'default' : 'outline'}
                    className={`h-16 flex-col gap-1 ${
                      resolveOption === 'no' 
                        ? 'bg-no hover:bg-no/90' 
                        : 'hover:border-no hover:text-no'
                    }`}
                    onClick={() => setResolveOption('no')}
                  >
                    <XCircle className="h-5 w-5" />
                    <span>No</span>
                  </Button>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleResolveMarket}
                  disabled={!resolveOption || resolving}
                >
                  {resolving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resolviendo...
                    </>
                  ) : (
                    'Confirmar resolución'
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
