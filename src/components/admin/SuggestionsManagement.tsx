import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Pencil,
  Search,
  Lightbulb,
  Plus,
  ImageIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MarketSuggestion {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  closes_at: string;
  options: string[];
  selected_option: string;
  fee_amount: number;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  image_url?: string | null;
  profiles?: { email: string; username: string | null };
}

const CATEGORIES = ['Política', 'Deportes', 'Tecnología', 'Economía', 'Entretenimiento', 'Otro'];

export function SuggestionsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();

  const [suggestions, setSuggestions] = useState<MarketSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<MarketSuggestion | null>(null);
  const [processing, setProcessing] = useState(false);

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: '',
    closes_at: '',
    options: [] as string[],
    admin_notes: '',
  });

  useEffect(() => {
    fetchSuggestions();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('suggestions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'market_suggestions',
        },
        () => {
          fetchSuggestions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('market_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get user profiles for each suggestion
      const userIds = [...new Set((data || []).map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, username')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Parse options from JSONB and attach profiles
      const parsedData = (data || []).map(item => ({
        ...item,
        options: typeof item.options === 'string' ? JSON.parse(item.options) : (Array.isArray(item.options) ? item.options : []),
        profiles: profilesMap.get(item.user_id),
      }));

      setSuggestions(parsedData as MarketSuggestion[]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las sugerencias',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (suggestion: MarketSuggestion) => {
    setSelectedSuggestion(suggestion);
    setEditForm({
      title: suggestion.title,
      description: suggestion.description || '',
      category: suggestion.category || '',
      closes_at: suggestion.closes_at ? new Date(suggestion.closes_at).toISOString().slice(0, 16) : '',
      options: suggestion.options,
      admin_notes: suggestion.admin_notes || '',
    });
    setEditDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedSuggestion || !user) return;

    const validOptions = editForm.options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      toast({
        title: 'Error',
        description: 'Debes tener al menos 2 opciones.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      // Create the market
      const { data: marketData, error: marketError } = await supabase
        .from('markets')
        .insert({
          title: editForm.title,
          description: editForm.description || null,
          category: editForm.category || null,
          closes_at: new Date(editForm.closes_at).toISOString(),
          created_by: user.id,
          image_url: selectedSuggestion.image_url || null,
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

      // Update suggestion status
      const { error: updateError } = await supabase
        .from('market_suggestions')
        .update({
          status: 'approved',
          admin_notes: editForm.admin_notes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedSuggestion.id);

      if (updateError) throw updateError;

      await logAction('approve_suggestion', 'market_suggestion', selectedSuggestion.id, { title: editForm.title });
      toast({
        title: 'Sugerencia aprobada',
        description: 'El mercado ha sido creado exitosamente.',
      });

      setEditDialogOpen(false);
      setSelectedSuggestion(null);
      fetchSuggestions();
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSuggestion || !user) return;

    if (!editForm.admin_notes.trim()) {
      toast({
        title: 'Error',
        description: 'Debes proporcionar una razón para el rechazo.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('market_suggestions')
        .update({
          status: 'rejected',
          admin_notes: editForm.admin_notes,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedSuggestion.id);

      if (error) throw error;

      await logAction('reject_suggestion', 'market_suggestion', selectedSuggestion.id, { title: selectedSuggestion.title, reason: editForm.admin_notes });
      toast({
        title: 'Sugerencia rechazada',
        description: 'La sugerencia ha sido rechazada.',
      });

      setEditDialogOpen(false);
      setSelectedSuggestion(null);
      fetchSuggestions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const filteredSuggestions = suggestions.filter(s => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(searchLower) ||
      s.profiles?.email.toLowerCase().includes(searchLower) ||
      s.profiles?.username?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning">Pendiente</Badge>;
      case 'approved':
        return <Badge className="bg-success">Aprobada</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rechazada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título o usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="approved">Aprobadas</SelectItem>
            <SelectItem value="rejected">Rechazadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSuggestions.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Predicción</TableHead>
                  <TableHead>Tarifa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuggestions.map((suggestion) => (
                  <TableRow key={suggestion.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {suggestion.image_url ? (
                          <img
                            src={suggestion.image_url}
                            alt={`Portada de ${suggestion.title}`}
                            loading="lazy"
                            className="h-10 w-16 shrink-0 rounded-md object-cover border"
                          />
                        ) : (
                          <div className="h-10 w-16 shrink-0 rounded-md bg-muted border flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium line-clamp-1">{suggestion.title}</p>
                          {suggestion.category && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {suggestion.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {suggestion.profiles?.username || suggestion.profiles?.email || 'Usuario'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{suggestion.selected_option}</Badge>
                    </TableCell>
                    <TableCell>${suggestion.fee_amount}</TableCell>
                    <TableCell>{getStatusBadge(suggestion.status)}</TableCell>
                    <TableCell>
                      {format(new Date(suggestion.created_at), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell className="text-right">
                      {suggestion.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(suggestion)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Revisar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              No hay sugerencias {statusFilter !== 'all' ? statusFilter === 'pending' ? 'pendientes' : statusFilter === 'approved' ? 'aprobadas' : 'rechazadas' : ''}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit/Review Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisar sugerencia</DialogTitle>
          </DialogHeader>
          {selectedSuggestion && (
            <div className="space-y-4 pt-4 overflow-y-auto flex-1 pr-2">
              {/* User info */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Sugerido por:</p>
                <p className="font-medium">
                  {selectedSuggestion.profiles?.username || selectedSuggestion.profiles?.email}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Predicción del usuario: <Badge>{selectedSuggestion.selected_option}</Badge>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoría</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) => setEditForm({ ...editForm, category: value })}
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
                <Label htmlFor="edit-closes_at">Fecha de cierre</Label>
                <Input
                  id="edit-closes_at"
                  type="datetime-local"
                  value={editForm.closes_at}
                  onChange={(e) => setEditForm({ ...editForm, closes_at: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Opciones de respuesta</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditForm({ ...editForm, options: [...editForm.options, ''] })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                {editForm.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...editForm.options];
                        newOptions[index] = e.target.value;
                        setEditForm({ ...editForm, options: newOptions });
                      }}
                      placeholder={`Opción ${index + 1}`}
                    />
                    {editForm.options.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newOptions = editForm.options.filter((_, i) => i !== index);
                          setEditForm({ ...editForm, options: newOptions });
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-notes">Notas del administrador</Label>
                <Textarea
                  id="admin-notes"
                  value={editForm.admin_notes}
                  onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })}
                  placeholder="Razón del rechazo o notas adicionales..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Rechazar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleApprove}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Aprobar y crear mercado
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
