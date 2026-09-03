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
import { DataManagement } from '@/components/admin/DataManagement';

import { SuggestionsManagement } from '@/components/admin/SuggestionsManagement';
import { PromotionSettings } from '@/components/admin/PromotionSettings';
import { WithdrawalManagement } from '@/components/admin/WithdrawalManagement';
import { AuditLogsPanel } from '@/components/admin/AuditLogsPanel';
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
import { useAuditLog } from '@/hooks/useAuditLog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Plus, 
  Loader2, 
  TrendingUp, 
  Users, 
  DollarSign,
  CheckCircle,
  XCircle,
  Settings,
  Pencil,
  UserPlus,
  Gift,
  Star
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const CATEGORIES = ['Política', 'Deportes', 'Tecnología', 'Economía', 'Entretenimiento', 'Otro'];

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const { data: markets, isLoading } = useMarkets();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMarket, setNewMarket] = useState({
    title: '',
    description: '',
    category: '',
    closes_at: '',
    image_url: '',
    options: ['', ''],
    allow_cashout: true,
    favorite_option: '',
    favorite_probability: 60,
  });

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
    allow_cashout: true,
    favorite_option: '',
    favorite_probability: 60,
  });

  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [marketToResolve, setMarketToResolve] = useState<Market | null>(null);
  const [resolveOption, setResolveOption] = useState<string | null>(null);

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
    async function fetchStats() {
      const [{ count }, { data: referrals }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('referrals').select('referrer_bonus, referred_bonus'),
      ]);
      const totalReferrals = referrals?.length || 0;
      const totalReferrerBonuses = referrals?.reduce((s, r) => s + Number(r.referrer_bonus), 0) || 0;
      const totalReferredBonuses = referrals?.reduce((s, r) => s + Number(r.referred_bonus), 0) || 0;
      setStats(prev => ({ ...prev, totalUsers: count || 0, totalReferrals, totalReferrerBonuses, totalReferredBonuses }));
    }
    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  const handleCreateMarket = async () => {
    if (!newMarket.title || !newMarket.closes_at) {
      toast({ title: 'Error', description: 'Título y fecha de cierre son requeridos.', variant: 'destructive' });
      return;
    }
    const validOptions = newMarket.options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      toast({ title: 'Error', description: 'Debes agregar al menos 2 opciones.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const favoriteOpt = newMarket.favorite_option && newMarket.favorite_option !== 'none' ? newMarket.favorite_option : null;
      const { data: marketData, error: marketError } = await supabase
        .from('markets')
        .insert({
          title: newMarket.title,
          description: newMarket.description || null,
          category: newMarket.category || null,
          closes_at: new Date(newMarket.closes_at).toISOString(),
          created_by: user?.id,
          image_url: newMarket.image_url || null,
          allow_cashout: newMarket.allow_cashout,
          favorite_option: favoriteOpt,
          favorite_probability: favoriteOpt ? newMarket.favorite_probability : 50,
        } as any)
        .select()
        .single();
      if (marketError) throw marketError;
      const optionsToInsert = validOptions.map(option => ({
        market_id: marketData.id,
        option_name: option.trim(),
      }));
      const { error: optionsError } = await supabase.from('market_options').insert(optionsToInsert);
      if (optionsError) throw optionsError;
      toast({ title: 'Mercado creado', description: 'El mercado se ha creado correctamente.' });
      setCreateDialogOpen(false);
      setNewMarket({ title: '', description: '', category: '', closes_at: '', image_url: '', options: ['', ''], allow_cashout: true, favorite_option: '', favorite_probability: 60 });
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      allow_cashout: market.allow_cashout ?? true,
      favorite_option: (market as any).favorite_option || '',
      favorite_probability: (market as any).favorite_probability || 50,
    });
    setEditDialogOpen(true);
  };

  const handleEditMarket = async () => {
    if (!marketToEdit || !editMarket.title || !editMarket.closes_at) {
      toast({ title: 'Error', description: 'Título y fecha de cierre son requeridos.', variant: 'destructive' });
      return;
    }
    const validOptions = editMarket.options.filter(opt => opt.option_name.trim() !== '');
    if (validOptions.length < 2) {
      toast({ title: 'Error', description: 'Debes tener al menos 2 opciones.', variant: 'destructive' });
      return;
    }
    setEditing(true);
    try {
      const { error: marketError } = await supabase
        .from('markets')
        .update({
          title: editMarket.title,
          description: editMarket.description || null,
          category: editMarket.category || null,
          closes_at: new Date(editMarket.closes_at).toISOString(),
          image_url: editMarket.image_url || null,
          allow_cashout: editMarket.allow_cashout,
          favorite_option: editMarket.favorite_option || null,
          favorite_probability: editMarket.favorite_option ? editMarket.favorite_probability : 50,
        } as any)
        .eq('id', marketToEdit.id);
      if (marketError) throw marketError;
      const existingOptionIds = marketToEdit.options?.map(o => o.id) || [];
      const updatedOptionIds = validOptions.filter(o => o.id).map(o => o.id!);
      const optionsToDelete = existingOptionIds.filter(id => !updatedOptionIds.includes(id));
      if (optionsToDelete.length > 0) {
        const { error: deleteError } = await supabase.from('market_options').delete().in('id', optionsToDelete);
        if (deleteError) throw deleteError;
      }
      for (const option of validOptions) {
        if (option.id) {
          await supabase.from('market_options').update({ option_name: option.option_name.trim() }).eq('id', option.id);
        } else {
          await supabase.from('market_options').insert({ market_id: marketToEdit.id, option_name: option.option_name.trim() });
        }
      }
      toast({ title: 'Mercado actualizado', description: 'El mercado se ha actualizado correctamente.' });
      setEditDialogOpen(false);
      setMarketToEdit(null);
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setEditing(false);
    }
  };

  const { logAction } = useAuditLog();

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
      if (!result.success) throw new Error(result.error || 'Error al resolver el mercado');
      await logAction('resolve_market', 'market', marketToResolve.id, { winning_option: resolveOption, title: marketToResolve.title });
      toast({ title: 'Mercado resuelto', description: `El mercado se ha resuelto como "${resolveOption}".` });
      setResolveDialogOpen(false);
      setMarketToResolve(null);
      setResolveOption(null);
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">Panel de Administración</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-muted-foreground">
              Gestiona mercados, usuarios y configuración.
            </p>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Crear mercado
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] flex flex-col max-w-[95vw] sm:max-w-lg">
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
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="allow_cashout" className="text-sm font-medium">Permitir retiro (cashout)</Label>
                    <p className="text-xs text-muted-foreground">Los usuarios podrán retirar sus apuestas mientras el mercado esté activo.</p>
                  </div>
                  <Switch
                    id="allow_cashout"
                    checked={newMarket.allow_cashout}
                    onCheckedChange={(checked) => setNewMarket({ ...newMarket, allow_cashout: checked })}
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
                      Agregar
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
                          className="shrink-0"
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
                {/* Favorite option selection */}
                {newMarket.options.filter(o => o.trim()).length >= 2 && (
                  <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-warning" />
                      <Label className="text-sm font-medium">Opción favorita</Label>
                    </div>
                    <Select
                      value={newMarket.favorite_option}
                      onValueChange={(value) => setNewMarket({ ...newMarket, favorite_option: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin favorito (probabilidades iguales)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin favorito</SelectItem>
                        {newMarket.options.filter(o => o.trim()).map((opt) => (
                          <SelectItem key={opt} value={opt.trim()}>{opt.trim()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newMarket.favorite_option && newMarket.favorite_option !== 'none' && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Probabilidad del favorito</span>
                          <span className="font-medium text-foreground">{newMarket.favorite_probability}%</span>
                        </div>
                        <Slider
                          value={[newMarket.favorite_probability]}
                          onValueChange={([val]) => setNewMarket({ ...newMarket, favorite_probability: val })}
                          min={51}
                          max={95}
                          step={1}
                        />
                        <p className="text-xs text-muted-foreground">
                          Esto ajusta la probabilidad inicial mostrada. A mayor probabilidad, menor el pago potencial para quien apueste por el favorito.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <Button className="w-full" onClick={handleCreateMarket} disabled={creating}>
                  {creating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</>
                  ) : (
                    'Crear mercado'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-6 sm:mb-8">
          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Usuarios</p>
                  <p className="font-display text-lg sm:text-2xl font-bold">{stats.totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-success/10 shrink-0">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Volumen</p>
                  <p className="font-display text-lg sm:text-2xl font-bold">
                    ${stats.totalVolume.toLocaleString('es-ES')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-warning/10 shrink-0">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Activos</p>
                  <p className="font-display text-lg sm:text-2xl font-bold">{stats.activeMarkets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Referidos</p>
                  <p className="font-display text-lg sm:text-2xl font-bold">{stats.totalReferrals}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-success/10 shrink-0">
                  <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Bonos</p>
                  <p className="font-display text-lg sm:text-2xl font-bold">
                    ${(stats.totalReferrerBonuses + stats.totalReferredBonuses).toLocaleString('es-ES')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="markets">
          <ScrollArea className="w-full">
            <TabsList className="w-max">
              <TabsTrigger value="markets" className="text-xs sm:text-sm">Mercados</TabsTrigger>
              <TabsTrigger value="suggestions" className="text-xs sm:text-sm">Sugerencias</TabsTrigger>
              <TabsTrigger value="withdrawals" className="text-xs sm:text-sm">Retiros</TabsTrigger>
              <TabsTrigger value="users" className="text-xs sm:text-sm">Usuarios</TabsTrigger>
              <TabsTrigger value="data" className="text-xs sm:text-sm">Datos</TabsTrigger>

              <TabsTrigger value="activity" className="text-xs sm:text-sm">Actividades</TabsTrigger>
              <TabsTrigger value="promotion" className="text-xs sm:text-sm">Promoción</TabsTrigger>
              <TabsTrigger value="audit" className="text-xs sm:text-sm">Auditoría</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="markets" className="mt-4 sm:mt-6">
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active" className="text-xs sm:text-sm">Activos ({activeMarkets.length})</TabsTrigger>
                <TabsTrigger value="resolved" className="text-xs sm:text-sm">Resueltos ({resolvedMarkets.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-4 sm:mt-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activeMarkets.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {activeMarkets.map((market) => (
                      <Card key={market.id}>
                        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 px-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              {market.category && (
                                <Badge variant="outline" className="text-xs">{market.category}</Badge>
                              )}
                              <Badge className="text-xs">Activo</Badge>
                              {market.allow_cashout && (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-600">Cashout</Badge>
                              )}
                            </div>
                            <h3 className="font-medium text-sm sm:text-base truncate">{market.title}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Cierra: {format(new Date(market.closes_at), "dd MMM yyyy, HH:mm", { locale: es })}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Volumen: ${(Number(market.total_yes_amount) + Number(market.total_no_amount)).toLocaleString('es-ES')}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 sm:h-9 sm:w-9"
                              onClick={() => openEditDialog(market)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs sm:text-sm"
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
                  <div className="rounded-xl border bg-card p-8 sm:p-12 text-center">
                    <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 font-display text-lg font-semibold">No hay mercados activos</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Crea un nuevo mercado para comenzar.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="resolved" className="mt-4 sm:mt-6">
                {resolvedMarkets.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {resolvedMarkets.map((market) => (
                      <Card key={market.id}>
                        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 px-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              {market.category && (
                                <Badge variant="outline" className="text-xs">{market.category}</Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">Resuelto</Badge>
                              <Badge className={`text-xs ${market.resolved_option === 'yes' ? 'bg-yes' : 'bg-no'}`}>
                                {market.resolved_option === 'yes' ? 'Sí' : 'No'}
                              </Badge>
                            </div>
                            <h3 className="font-medium text-sm sm:text-base truncate">{market.title}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Volumen: ${(Number(market.total_yes_amount) + Number(market.total_no_amount)).toLocaleString('es-ES')}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border bg-card p-8 sm:p-12 text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 font-display text-lg font-semibold">No hay mercados resueltos</h3>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="suggestions" className="mt-4 sm:mt-6">
            <SuggestionsManagement />
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-4 sm:mt-6">
            <WithdrawalManagement />
          </TabsContent>

          <TabsContent value="users" className="mt-4 sm:mt-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="data" className="mt-4 sm:mt-6">
            <DataManagement />
          </TabsContent>


          <TabsContent value="activity" className="mt-4 sm:mt-6">
            <ActivityHistory />
          </TabsContent>

          <TabsContent value="promotion" className="mt-4 sm:mt-6">
            <PromotionSettings />
          </TabsContent>

          <TabsContent value="audit" className="mt-4 sm:mt-6">
            <AuditLogsPanel />
          </TabsContent>
        </Tabs>

        {/* Resolve dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Resolver mercado</DialogTitle>
            </DialogHeader>
            {marketToResolve && (
              <div className="space-y-4 pt-4">
                <p className="font-medium text-sm sm:text-base">{marketToResolve.title}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Selecciona el resultado final de este mercado. Esta acción distribuirá
                  automáticamente las ganancias a los apostadores ganadores.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {marketToResolve.options && marketToResolve.options.length > 0 ? (
                    marketToResolve.options.map((option) => (
                      <Button
                        key={option.id}
                        variant={resolveOption === option.option_name ? 'default' : 'outline'}
                        className="h-14 sm:h-16 flex-col gap-1 text-sm"
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
                        className={`h-14 sm:h-16 flex-col gap-1 ${
                          resolveOption === 'yes' ? 'bg-yes hover:bg-yes/90' : 'hover:border-yes hover:text-yes'
                        }`}
                        onClick={() => setResolveOption('yes')}
                      >
                        <CheckCircle className="h-5 w-5" />
                        <span>Sí</span>
                      </Button>
                      <Button
                        variant={resolveOption === 'no' ? 'default' : 'outline'}
                        className={`h-14 sm:h-16 flex-col gap-1 ${
                          resolveOption === 'no' ? 'bg-no hover:bg-no/90' : 'hover:border-no hover:text-no'
                        }`}
                        onClick={() => setResolveOption('no')}
                      >
                        <XCircle className="h-5 w-5" />
                        <span>No</span>
                      </Button>
                    </>
                  )}
                </div>

                <Button className="w-full" onClick={handleResolveMarket} disabled={!resolveOption || resolving}>
                  {resolving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resolviendo...</>
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
          <DialogContent className="max-h-[85vh] flex flex-col max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar mercado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4 overflow-y-auto flex-1 pr-2">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título *</Label>
                <Input id="edit-title" value={editMarket.title} onChange={(e) => setEditMarket({ ...editMarket, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea id="edit-description" value={editMarket.description} onChange={(e) => setEditMarket({ ...editMarket, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoría</Label>
                <Select value={editMarket.category} onValueChange={(value) => setEditMarket({ ...editMarket, category: value })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-closes_at">Fecha de cierre *</Label>
                <Input id="edit-closes_at" type="datetime-local" value={editMarket.closes_at} onChange={(e) => setEditMarket({ ...editMarket, closes_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-image_url">URL de imagen</Label>
                <Input id="edit-image_url" type="url" value={editMarket.image_url} onChange={(e) => setEditMarket({ ...editMarket, image_url: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="edit-allow_cashout" className="text-sm font-medium">Permitir retiro (cashout)</Label>
                  <p className="text-xs text-muted-foreground">Los usuarios podrán retirar sus apuestas mientras el mercado esté activo.</p>
                </div>
                <Switch
                  id="edit-allow_cashout"
                  checked={editMarket.allow_cashout}
                  onCheckedChange={(checked) => setEditMarket({ ...editMarket, allow_cashout: checked })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Opciones *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditMarket({ ...editMarket, options: [...editMarket.options, { option_name: '' }] })}>
                    <Plus className="h-4 w-4 mr-1" />Agregar
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
                      <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => {
                        const newOptions = editMarket.options.filter((_, i) => i !== index);
                        setEditMarket({ ...editMarket, options: newOptions });
                      }}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {/* Favorite option selection for edit */}
              {editMarket.options.filter(o => o.option_name.trim()).length >= 2 && (
                <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-warning" />
                    <Label className="text-sm font-medium">Opción favorita</Label>
                  </div>
                  <Select
                    value={editMarket.favorite_option || 'none'}
                    onValueChange={(value) => setEditMarket({ ...editMarket, favorite_option: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin favorito" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin favorito</SelectItem>
                      {editMarket.options.filter(o => o.option_name.trim()).map((opt) => (
                        <SelectItem key={opt.option_name} value={opt.option_name.trim()}>{opt.option_name.trim()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editMarket.favorite_option && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Probabilidad del favorito</span>
                        <span className="font-medium text-foreground">{editMarket.favorite_probability}%</span>
                      </div>
                      <Slider
                        value={[editMarket.favorite_probability]}
                        onValueChange={([val]) => setEditMarket({ ...editMarket, favorite_probability: val })}
                        min={51}
                        max={95}
                        step={1}
                      />
                    </div>
                  )}
                </div>
              )}
              <Button className="w-full" onClick={handleEditMarket} disabled={editing}>
                {editing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>) : ('Guardar cambios')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
