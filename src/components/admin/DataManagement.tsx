import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { friendlyError } from '@/lib/errors';
import { Loader2, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Row = Record<string, any>;

const PAGE_SIZE = 20;

function money(value: any) {
  return `$${Number(value || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })}`;
}

function when(value: any) {
  if (!value) return '—';
  return format(new Date(value), "dd MMM yyyy, HH:mm", { locale: es });
}

export function DataManagement() {
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const [tab, setTab] = useState('users');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({});
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      let data: Row[] | null = null;

      if (tab === 'users' || tab === 'profiles') {
        let q = supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
        if (search) q = q.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
        const res = await q;
        if (res.error) throw res.error;
        data = res.data;
      } else if (tab === 'bets') {
        const res = await supabase
          .from('bets')
          .select('*, markets(title), profiles:user_id(email)')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
        if (res.error) throw res.error;
        data = res.data as Row[];
      } else {
        const res = await supabase
          .from('transactions')
          .select('*, profiles:user_id(email)')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
        if (res.error) throw res.error;
        data = res.data as Row[];
      }

      setRows(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: friendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [tab, search, toast]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openEdit = (row: Row) => {
    setEditRow(row);
    if (tab === 'users') {
      setForm({ email: row.email, is_blocked: row.is_blocked });
    } else if (tab === 'profiles') {
      setForm({
        username: row.username || '',
        phone: row.phone || '',
        balance: String(row.balance ?? 0),
        is_age_verified: !!row.is_age_verified,
      });
    } else if (tab === 'bets') {
      setForm({ option: row.option, amount: String(row.amount ?? 0) });
    } else {
      setForm({ description: row.description || '', amount: String(row.amount ?? 0) });
    }
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      let error = null;
      if (tab === 'users') {
        ({ error } = await supabase
          .from('profiles')
          .update({ email: form.email, is_blocked: !!form.is_blocked })
          .eq('id', editRow.id));
      } else if (tab === 'profiles') {
        const balance = Number(form.balance);
        if (!Number.isFinite(balance) || balance < 0) throw new Error('Balance inválido');
        ({ error } = await supabase
          .from('profiles')
          .update({
            username: form.username || null,
            phone: form.phone || null,
            balance,
            is_age_verified: !!form.is_age_verified,
          })
          .eq('id', editRow.id));
      } else if (tab === 'bets') {
        const amount = Number(form.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Monto inválido');
        ({ error } = await supabase
          .from('bets')
          .update({ option: form.option, amount })
          .eq('id', editRow.id));
      } else {
        const amount = Number(form.amount);
        if (!Number.isFinite(amount)) throw new Error('Monto inválido');
        ({ error } = await supabase
          .from('transactions')
          .update({ description: form.description || null, amount })
          .eq('id', editRow.id));
      }
      if (error) throw error;

      await logAction(`edit_${tab}`, tab, editRow.id, form);
      toast({ title: 'Registro actualizado' });
      setEditOpen(false);
      setEditRow(null);
      fetchRows();
    } catch (error: any) {
      toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      const table = tab === 'users' || tab === 'profiles' ? 'profiles' : tab === 'bets' ? 'bets' : 'transactions';
      const { error } = await supabase.from(table as any).delete().eq('id', deleteRow.id);
      if (error) throw error;

      await logAction(`delete_${tab}`, tab, deleteRow.id, {});
      toast({ title: 'Registro eliminado' });
      setDeleteRow(null);
      fetchRows();
    } catch (error: any) {
      toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const actionCell = (row: Row) => (
    <TableCell className="text-right">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setDeleteRow(row)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </TableCell>
  );

  const headers: Record<string, string[]> = {
    users: ['Email', 'Estado', 'Registro'],
    profiles: ['Usuario', 'Balance', 'Verificación', 'Teléfono'],
    bets: ['Usuario', 'Mercado', 'Opción', 'Monto', 'Fecha'],
    transactions: ['Usuario', 'Tipo', 'Monto', 'Descripción', 'Fecha'],
  };

  const renderRow = (row: Row) => {
    if (tab === 'users') {
      return (
        <TableRow key={row.id}>
          <TableCell className="font-medium">{row.email}</TableCell>
          <TableCell>
            {row.is_blocked ? (
              <Badge variant="destructive">Bloqueado</Badge>
            ) : (
              <Badge variant="outline" className="text-success border-success">Activo</Badge>
            )}
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">{when(row.created_at)}</TableCell>
          {actionCell(row)}
        </TableRow>
      );
    }
    if (tab === 'profiles') {
      return (
        <TableRow key={row.id}>
          <TableCell>
            <p className="font-medium">{row.username || 'Sin nombre'}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </TableCell>
          <TableCell className="font-mono">{money(row.balance)}</TableCell>
          <TableCell>
            <Badge variant={row.is_age_verified ? 'default' : 'secondary'}>
              {row.is_age_verified ? 'Verificado' : 'Sin verificar'}
            </Badge>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">{row.phone || '—'}</TableCell>
          {actionCell(row)}
        </TableRow>
      );
    }
    if (tab === 'bets') {
      return (
        <TableRow key={row.id}>
          <TableCell className="text-sm">{row.profiles?.email || '—'}</TableCell>
          <TableCell className="max-w-[220px] truncate">{row.markets?.title || 'Mercado eliminado'}</TableCell>
          <TableCell>{row.option}</TableCell>
          <TableCell className="font-mono">{money(row.amount)}</TableCell>
          <TableCell className="text-sm text-muted-foreground">{when(row.created_at)}</TableCell>
          {actionCell(row)}
        </TableRow>
      );
    }
    return (
      <TableRow key={row.id}>
        <TableCell className="text-sm">{row.profiles?.email || '—'}</TableCell>
        <TableCell className="capitalize">{String(row.type).replace('_', ' ')}</TableCell>
        <TableCell className="font-mono">{money(row.amount)}</TableCell>
        <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
          {row.description || '—'}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{when(row.created_at)}</TableCell>
        {actionCell(row)}
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="w-max">
            <TabsTrigger value="users" className="text-xs sm:text-sm">Usuarios</TabsTrigger>
            <TabsTrigger value="profiles" className="text-xs sm:text-sm">Perfiles</TabsTrigger>
            <TabsTrigger value="bets" className="text-xs sm:text-sm">Apuestas</TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs sm:text-sm">Transacciones</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="mt-4 flex gap-2">
          {(tab === 'users' || tab === 'profiles') && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por email o nombre de usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
          <Button variant="outline" onClick={fetchRows} className="ml-auto">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="w-full whitespace-nowrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {headers[tab].map((h) => (
                          <TableHead key={h}>{h}</TableHead>
                        ))}
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length > 0 ? (
                        rows.map(renderRow)
                      ) : (
                        <TableRow>
                          <TableCell colSpan={headers[tab].length + 1} className="h-24 text-center">
                            No hay registros.
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
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar registro</DialogTitle>
            <DialogDescription>Los cambios quedan registrados en la auditoría.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {tab === 'users' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={form.email || ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="blocked">Usuario bloqueado</Label>
                  <Switch
                    id="blocked"
                    checked={!!form.is_blocked}
                    onCheckedChange={(v) => setForm({ ...form, is_blocked: v })}
                  />
                </div>
              </>
            )}

            {tab === 'profiles' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Nombre de usuario</Label>
                  <Input
                    id="username"
                    value={form.username || ''}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={form.phone || ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balance">Balance</Label>
                  <Input
                    id="balance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.balance ?? ''}
                    onChange={(e) => setForm({ ...form, balance: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="age">Mayor de 18 verificado</Label>
                  <Switch
                    id="age"
                    checked={!!form.is_age_verified}
                    onCheckedChange={(v) => setForm({ ...form, is_age_verified: v })}
                  />
                </div>
              </>
            )}

            {tab === 'bets' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="option">Opción</Label>
                  <Input
                    id="option"
                    value={form.option || ''}
                    onChange={(e) => setForm({ ...form, option: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bet-amount">Monto</Label>
                  <Input
                    id="bet-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount ?? ''}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
              </>
            )}

            {tab === 'transactions' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tx-desc">Descripción</Label>
                  <Input
                    id="tx-desc"
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tx-amount">Monto</Label>
                  <Input
                    id="tx-amount"
                    type="number"
                    step="0.01"
                    value={form.amount ?? ''}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteRow} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer y quedará registrada en la auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
