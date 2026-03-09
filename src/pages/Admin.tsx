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
import { UserManagement } from '@/components/admin/UserManagement';
import { ActivityHistory } from '@/components/admin/ActivityHistory';
import { SuggestionsManagement } from '@/components/admin/SuggestionsManagement';
import { PromotionSettings } from '@/components/admin/PromotionSettings';
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
  Settings,
  Pencil
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
    options: ['', ''],
  });

  // Edit market form
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [marketToEdit, setMarketToEdit] = useState<Market | null>(null);
  const [editMarket, setEditMarket] = useState({
    title: '',
    description: '',
    category: '',
    closes_at: '',
    image_url: '',
    options: [] as { id?: string; option_name: string }[],
  });

  // Resolve market
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [marketToResolve, setMarketToResolve] = useState<Market | null>(null);
  const [resolveOption, setResolveOption] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVolume: 0,
    activeMarkets: 0,
    totalReferrals: 0,
    totalReferrerBonuses: 0,
    totalReferredBonuses: 0,
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

    const validOptions = newMarket.options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      toast({
        title: 'Error',
        description: 'Debes agregar al menos 2 opciones.',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data: marketData, error: marketError } = await supabase
        .from('markets')
        .insert({
          title: newMarket.title,
          description: newMarket.description || null,
          category: newMarket.category || null,
          closes_at: new Date(newMarket.closes_at).toISOString(),
          created_by: user?.id,
          image_url: newMarket.image_url || null,
        })
        .select()
        .single();

      if (marketError) throw marketError;

      // Insert options
      const optionsToInsert = validOptions.map(option => ({
        market_id: marketData.id,
        option_name: option.trim(),
      }));

      const { error: optionsError } = await supabase
        .from('market_options')
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      toast({
        title: 'Mercado creado',
        description: 'El mercado se ha creado correctamente.',
      });
      
      setCreateDialogOpen(false);
      setNewMarket({ title: '', description: '', category: '', closes_at: '', image_url: '', options: ['', ''] });
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

  const openEditDialog = (market: Market) => {
    setMarketToEdit(market);
    setEditMarket({
      title: market.title,
      description: market.description || '',
      category: market.category || '',
      closes_at: market.closes_at ? new Date(market.closes_at).toISOString().slice(0, 16) : '',
      image_url: market.image_url || '',
      options: market.options?.map(o => ({ id: o.id, option_name: o.option_name })) || [],
    });
    setEditDialogOpen(true);
  };

  const handleEditMarket = async () => {
    if (!marketToEdit || !editMarket.title || !editMarket.closes_at) {
      toast({
        title: 'Error',
        description: 'Título y fecha de cierre son requeridos.',
        variant: 'destructive',
      });
      return;
    }

    const validOptions = editMarket.options.filter(opt => opt.option_name.trim() !== '');
    if (validOptions.length < 2) {
      toast({
        title: 'Error',
        description: 'Debes tener al menos 2 opciones.',
        variant: 'destructive',
      });
      return;
    }

    setEditing(true);
    try {
      // Update market
      const { error: marketError } = await supabase
        .from('markets')
        .update({
          title: editMarket.title,
          description: editMarket.description || null,
          category: editMarket.category || null,
          closes_at: new Date(editMarket.closes_at).toISOString(),
          image_url: editMarket.image_url || null,
        })
        .eq('id', marketToEdit.id);

      if (marketError) throw marketError;

      // Get existing option IDs
      const existingOptionIds = marketToEdit.options?.map(o => o.id) || [];
      const updatedOptionIds = validOptions.filter(o => o.id).map(o => o.id!);
      
      // Delete removed options
      const optionsToDelete = existingOptionIds.filter(id => !updatedOptionIds.includes(id));
      if (optionsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('market_options')
          .delete()
          .in('id', optionsToDelete);
        if (deleteError) throw deleteError;
      }

      // Update existing options and insert new ones
      for (const option of validOptions) {
        if (option.id) {
          // Update existing
          await supabase
            .from('market_options')
            .update({ option_name: option.option_name.trim() })
            .eq('id', option.id);
        } else {
          // Insert new
          await supabase
            .from('market_options')
            .insert({
              market_id: marketToEdit.id,
              option_name: option.option_name.trim(),
            });
        }
      }

      toast({
        title: 'Mercado actualizado',
        description: 'El mercado se ha actualizado correctamente.',
      });
      
      setEditDialogOpen(false);
      setMarketToEdit(null);
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setEditing(false);
    }
  };

  const handleResolveMarket = async () => {
    if (!marketToResolve || !resolveOption) return;

    setResolving(true);
    try {
      const { data, error } = await supabase.rpc('resolve_market', {
        p_market_id: marketToResolve.id,
        p_winning_option: resolveOption,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Error al resolver el mercado');
      }

      toast({
        title: 'Mercado resuelto',
        description: `El mercado se ha resuelto como "${resolveOption}".`,
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
            <DialogContent className="max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Crear nuevo mercado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4 overflow-y-auto flex-1 pr-2">
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Opciones de respuesta *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewMarket({ ...newMarket, options: [...newMarket.options, ''] })}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar opción
                    </Button>
                  </div>
                  {newMarket.options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...newMarket.options];
                          newOptions[index] = e.target.value;
                          setNewMarket({ ...newMarket, options: newOptions });
                        }}
                        placeholder={`Opción ${index + 1}`}
                      />
                      {newMarket.options.length > 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const newOptions = newMarket.options.filter((_, i) => i !== index);
                            setNewMarket({ ...newMarket, options: newOptions });
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
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

        <Tabs defaultValue="markets">
          <TabsList>
            <TabsTrigger value="markets">Mercados</TabsTrigger>
            <TabsTrigger value="suggestions">Sugerencias</TabsTrigger>
            <TabsTrigger value="users">Usuarios</TabsTrigger>
            <TabsTrigger value="activity">Historial de Actividades</TabsTrigger>
            <TabsTrigger value="promotion">Promoción</TabsTrigger>
          </TabsList>

          <TabsContent value="markets" className="mt-6">
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
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEditDialog(market)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setMarketToResolve(market);
                            setResolveDialogOpen(true);
                          }}
                        >
                          Resolver
                        </Button>
                      </div>
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
        </TabsContent>

        <TabsContent value="suggestions" className="mt-6">
          <SuggestionsManagement />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ActivityHistory />
        </TabsContent>

        <TabsContent value="promotion" className="mt-6">
          <PromotionSettings />
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
                  {marketToResolve.options && marketToResolve.options.length > 0 ? (
                    marketToResolve.options.map((option) => (
                      <Button
                        key={option.id}
                        variant={resolveOption === option.option_name ? 'default' : 'outline'}
                        className="h-16 flex-col gap-1"
                        onClick={() => setResolveOption(option.option_name)}
                      >
                        <CheckCircle className="h-5 w-5" />
                        <span>{option.option_name}</span>
                      </Button>
                    ))
                  ) : (
                    <>
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
                    </>
                  )}
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

        {/* Edit dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Editar mercado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4 overflow-y-auto flex-1 pr-2">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título *</Label>
                <Input
                  id="edit-title"
                  value={editMarket.title}
                  onChange={(e) => setEditMarket({ ...editMarket, title: e.target.value })}
                  placeholder="¿Ganará el equipo X el campeonato?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={editMarket.description}
                  onChange={(e) => setEditMarket({ ...editMarket, description: e.target.value })}
                  placeholder="Detalles adicionales sobre el evento..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoría</Label>
                <Select
                  value={editMarket.category}
                  onValueChange={(value) => setEditMarket({ ...editMarket, category: value })}
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
                <Label htmlFor="edit-closes_at">Fecha de cierre *</Label>
                <Input
                  id="edit-closes_at"
                  type="datetime-local"
                  value={editMarket.closes_at}
                  onChange={(e) => setEditMarket({ ...editMarket, closes_at: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-image_url">URL de imagen</Label>
                <Input
                  id="edit-image_url"
                  type="url"
                  value={editMarket.image_url}
                  onChange={(e) => setEditMarket({ ...editMarket, image_url: e.target.value })}
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Opciones de respuesta *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMarket({ ...editMarket, options: [...editMarket.options, { option_name: '' }] })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar opción
                  </Button>
                </div>
                {editMarket.options.map((option, index) => (
                  <div key={option.id || `new-${index}`} className="flex gap-2">
                    <Input
                      value={option.option_name}
                      onChange={(e) => {
                        const newOptions = [...editMarket.options];
                        newOptions[index] = { ...newOptions[index], option_name: e.target.value };
                        setEditMarket({ ...editMarket, options: newOptions });
                      }}
                      placeholder={`Opción ${index + 1}`}
                    />
                    {editMarket.options.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newOptions = editMarket.options.filter((_, i) => i !== index);
                          setEditMarket({ ...editMarket, options: newOptions });
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                className="w-full" 
                onClick={handleEditMarket}
                disabled={editing}
              >
                {editing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar cambios'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
