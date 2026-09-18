import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { friendlyError } from '@/lib/errors';
import { Loader2, Search, Trash2, EyeOff, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

type MarketRow = {
  id: string;
  title: string;
  category: string | null;
  status: 'active' | 'closed' | 'resolved';
  image_url: string | null;
  closes_at: string;
  created_at: string;
  total_yes_amount: number;
  total_no_amount: number;
};

function statusBadge(status: string) {
  if (status === 'active') {
    return <Badge variant="outline" className="border-success text-success">Publicado</Badge>;
  }
  if (status === 'closed') {
    return <Badge variant="secondary">Desaprobado</Badge>;
  }
  return <Badge>Resuelto</Badge>;
}

export function PublishedMarkets() {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteMarket, setDeleteMarket] = useState<MarketRow | null>(null);

  const { data: markets = [], isLoading } = useQuery({
    queryKey: ['admin_published_markets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('id, title, category, status, image_url, closes_at, created_at, total_yes_amount, total_no_amount')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as MarketRow[];
    },
  });

  const filtered = markets.filter((m) =>
    search ? m.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin_published_markets'] });
    queryClient.invalidateQueries({ queryKey: ['markets'] });
  };

  const handleToggleStatus = async (market: MarketRow) => {
    setBusyId(market.id);
    const next = market.status === 'active' ? 'closed' : 'active';
    try {
      const { error } = await supabase
        .from('markets')
        .update({ status: next })
        .eq('id', market.id);
      if (error) throw error;
      await logAction(next === 'closed' ? 'unpublish_market' : 'republish_market', 'markets', market.id, {
        title: market.title,
      });
      toast({
        title: next === 'closed' ? 'Mercado desaprobado' : 'Mercado publicado',
        description: market.title,
      });
      refresh();
    } catch (error: any) {
      toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteMarket) return;
    setBusyId(deleteMarket.id);
    try {
      await supabase.from('market_options').delete().eq('market_id', deleteMarket.id);
      const { error } = await supabase.from('markets').delete().eq('id', deleteMarket.id);
      if (error) throw error;
      await logAction('delete_market', 'markets', deleteMarket.id, { title: deleteMarket.title });
      toast({ title: 'Mercado eliminado', description: deleteMarket.title });
      setDeleteMarket(null);
      refresh();
    } catch (error: any) {
      toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar mercado por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="w-full whitespace-nowrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mercado</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Volumen</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length > 0 ? (
                    filtered.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {m.image_url ? (
                              <img
                                src={m.image_url}
                                alt={m.title}
                                className="h-10 w-10 rounded-md object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-md bg-muted" />
                            )}
                            <span className="max-w-[240px] truncate font-medium">{m.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.category || '—'}
                        </TableCell>
                        <TableCell>{statusBadge(m.status)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          ${Number(
                            Number(m.total_yes_amount || 0) + Number(m.total_no_amount || 0)
                          ).toLocaleString('es-ES')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(m.closes_at), 'dd MMM yyyy', { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/market/${m.id}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                            {m.status !== 'resolved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busyId === m.id}
                                onClick={() => handleToggleStatus(m)}
                              >
                                <EyeOff className="mr-1 h-4 w-4" />
                                {m.status === 'active' ? 'Desaprobar' : 'Publicar'}
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={busyId === m.id}
                              onClick={() => setDeleteMarket(m)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No hay mercados publicados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteMarket} onOpenChange={(open) => !open && setDeleteMarket(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este mercado?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deleteMarket?.title}» y sus opciones. Esta acción no se puede deshacer
              y quedará registrada en la auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!!busyId}>
              {busyId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
