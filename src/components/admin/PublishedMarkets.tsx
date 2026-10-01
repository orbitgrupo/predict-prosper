import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { friendlyError } from '@/lib/errors';
import { Loader2, Search, Trash2, EyeOff, ExternalLink, History } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { MarketRiskAnalyzer } from './MarketRiskAnalyzer';

type MarketRow = {
  id: string;
  title: string;
  category: string | null;
  status: 'active' | 'closed' | 'resolved';
  image_url: string | null;
  closes_at: string;
  created_at: string;
  created_by: string | null;
  total_yes_amount: number;
  total_no_amount: number;
};

type ActionKind = 'unpublish' | 'republish' | 'delete';

const ACTION_LABEL: Record<string, string> = {
  approve_market: 'Aprobado',
  republish_market: 'Publicado',
  unpublish_market: 'Desaprobado',
  delete_market: 'Eliminado',
};

function statusBadge(status: string) {
  if (status === 'active') return <Badge variant="outline" className="border-success text-success">Publicado</Badge>;
  if (status === 'closed') return <Badge variant="secondary">Desaprobado</Badge>;
  return <Badge>Resuelto</Badge>;
}

export function PublishedMarkets() {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ market: MarketRow; kind: ActionKind } | null>(null);
  const [reason, setReason] = useState('');
  const [historyMarket, setHistoryMarket] = useState<MarketRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin_published_markets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('id, title, category, status, image_url, closes_at, created_at, created_by, total_yes_amount, total_no_amount')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data || []) as MarketRow[];
      const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
      const creators: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, email, username').in('id', ids);
        profs?.forEach((p) => { creators[p.id] = p.username || p.email; });
      }
      return { rows, creators };
    },
  });
  const markets = data?.rows ?? [];
  const creators = data?.creators ?? {};

  const filtered = useMemo(() => markets.filter((m) => {
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (creatorFilter !== 'all' && m.created_by !== creatorFilter) return false;
    const created = new Date(m.created_at);
    if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && created > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  }), [markets, search, statusFilter, creatorFilter, fromDate, toDate]);

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['market_audit', historyMarket?.id],
    enabled: !!historyMarket,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('id, admin_id, action, details, created_at')
        .eq('target_type', 'markets')
        .eq('target_id', historyMarket!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      const ids = [...new Set(rows.map((r) => r.admin_id))];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, email').in('id', ids);
        profs?.forEach((p) => { names[p.id] = p.email; });
      }
      return rows.map((r) => ({ ...r, admin_email: names[r.admin_id] || r.admin_id }));
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin_published_markets'] });
    queryClient.invalidateQueries({ queryKey: ['markets'] });
    queryClient.invalidateQueries({ queryKey: ['market_audit'] });
  };

  const openAction = (market: MarketRow, kind: ActionKind) => { setReason(''); setPending({ market, kind }); };

  const confirmAction = async () => {
    if (!pending) return;
    const { market, kind } = pending;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast({ title: 'Indica un motivo', variant: 'destructive' });
      return;
    }
    setBusyId(market.id);
    try {
      if (kind === 'delete') {
        // Log first so the record survives the deletion
        await logAction('delete_market', 'markets', market.id, { title: market.title, reason: trimmed });
        await supabase.from('market_options').delete().eq('market_id', market.id);
        const { error } = await supabase.from('markets').delete().eq('id', market.id);
        if (error) throw error;
        toast({ title: 'Mercado eliminado', description: market.title });
      } else {
        const next = kind === 'unpublish' ? 'closed' : 'active';
        const { error } = await supabase.from('markets').update({ status: next }).eq('id', market.id);
        if (error) throw error;
        await logAction(kind === 'unpublish' ? 'unpublish_market' : 'republish_market', 'markets', market.id, {
          title: market.title, reason: trimmed,
        });
        toast({ title: kind === 'unpublish' ? 'Mercado desaprobado' : 'Mercado publicado', description: market.title });
      }
      setPending(null);
      refresh();
    } catch (error: any) {
      toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setCreatorFilter('all'); setFromDate(''); setToDate(''); };

  return (
    <div className="space-y-4">
      <MarketRiskAnalyzer />

      <div className="grid gap-3 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por título..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Publicado</SelectItem>
            <SelectItem value="closed">Desaprobado</SelectItem>
            <SelectItem value="resolved">Resuelto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={creatorFilter} onValueChange={setCreatorFilter}>
          <SelectTrigger><SelectValue placeholder="Creador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los creadores</SelectItem>
            {Object.entries(creators).map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
        <div className="flex items-center gap-2 md:col-span-5">
          <Label className="text-sm text-muted-foreground">Publicado desde</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-auto" />
          <Label className="text-sm text-muted-foreground">hasta</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-auto" />
          <span className="ml-auto text-sm text-muted-foreground">{filtered.length} mercados</span>
        </div>
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
                    <TableHead>Creador</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Volumen</TableHead>
                    <TableHead>Publicado</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length > 0 ? filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {m.image_url ? (
                            <img src={m.image_url} alt={m.title} className="h-10 w-10 rounded-md object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-muted" />
                          )}
                          <div>
                            <div className="max-w-[240px] truncate font-medium">{m.title}</div>
                            <div className="text-xs text-muted-foreground">{m.category || '—'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(m.created_by && creators[m.created_by]) || '—'}
                      </TableCell>
                      <TableCell>{statusBadge(m.status)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        ${Number(Number(m.total_yes_amount || 0) + Number(m.total_no_amount || 0)).toLocaleString('es-ES')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(m.created_at), 'dd MMM yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(m.closes_at), 'dd MMM yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/market/${m.id}`}><ExternalLink className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setHistoryMarket(m)} title="Historial">
                            <History className="h-4 w-4" />
                          </Button>
                          {m.status !== 'resolved' && (
                            <Button variant="outline" size="sm" disabled={busyId === m.id}
                              onClick={() => openAction(m, m.status === 'active' ? 'unpublish' : 'republish')}>
                              <EyeOff className="mr-1 h-4 w-4" />
                              {m.status === 'active' ? 'Desaprobar' : 'Publicar'}
                            </Button>
                          )}
                          <Button variant="destructive" size="sm" disabled={busyId === m.id} onClick={() => openAction(m, 'delete')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">No hay mercados con estos filtros.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === 'delete' ? '¿Eliminar este mercado?' : pending?.kind === 'unpublish' ? 'Desaprobar mercado' : 'Publicar mercado'}
            </DialogTitle>
            <DialogDescription>
              «{pending?.market.title}». El motivo quedará guardado en el historial de auditoría
              {pending?.kind === 'delete' ? ' y la acción no se puede deshacer.' : '.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3}
              placeholder="Explica por qué realizas esta acción..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancelar</Button>
            <Button variant={pending?.kind === 'delete' ? 'destructive' : 'default'} onClick={confirmAction} disabled={!!busyId}>
              {busyId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyMarket} onOpenChange={(o) => !o && setHistoryMarket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Historial de moderación</DialogTitle>
            <DialogDescription>{historyMarket?.title}</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : history.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sin acciones registradas.</p>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {history.map((h: any) => (
                <div key={h.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{ACTION_LABEL[h.action] || h.action}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(h.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                    </span>
                  </div>
                  <p className="mt-2 text-muted-foreground">Por: {h.admin_email}</p>
                  <p className="mt-1">Motivo: {h.details?.reason || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
