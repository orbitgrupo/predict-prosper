import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Search,
  Shield,
  Ban,
  DollarSign,
  CheckCircle,
  XCircle,
  Gavel,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
  admin_email?: string;
  admin_username?: string;
}

const ITEMS_PER_PAGE = 15;

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  resolve_market: { label: 'Resolver mercado', icon: <Gavel className="h-3.5 w-3.5" />, variant: 'default' },
  block_user: { label: 'Bloquear usuario', icon: <Ban className="h-3.5 w-3.5" />, variant: 'destructive' },
  unblock_user: { label: 'Desbloquear usuario', icon: <CheckCircle className="h-3.5 w-3.5" />, variant: 'secondary' },
  add_funds: { label: 'Agregar fondos', icon: <DollarSign className="h-3.5 w-3.5" />, variant: 'outline' },
  approve_withdrawal: { label: 'Aprobar retiro', icon: <CheckCircle className="h-3.5 w-3.5" />, variant: 'default' },
  reject_withdrawal: { label: 'Rechazar retiro', icon: <XCircle className="h-3.5 w-3.5" />, variant: 'destructive' },
  approve_suggestion: { label: 'Aprobar sugerencia', icon: <FileText className="h-3.5 w-3.5" />, variant: 'default' },
  reject_suggestion: { label: 'Rechazar sugerencia', icon: <XCircle className="h-3.5 w-3.5" />, variant: 'destructive' },
};

export function AuditLogsPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [currentPage, actionFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let countQuery = supabase
        .from('audit_logs' as any)
        .select('*', { count: 'exact', head: true });

      if (actionFilter !== 'all') {
        countQuery = countQuery.eq('action', actionFilter);
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      let query = supabase
        .from('audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setLogs([]);
        setLoading(false);
        return;
      }

      const adminIds = [...new Set((data as any[]).map((l: any) => l.admin_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, username')
        .in('id', adminIds);

      const enriched = (data as any[]).map((log: any) => {
        const profile = profiles?.find(p => p.id === log.admin_id);
        return {
          ...log,
          admin_email: profile?.email,
          admin_username: profile?.username,
        };
      });

      setLogs(enriched);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = search
    ? logs.filter(l =>
        l.admin_email?.toLowerCase().includes(search.toLowerCase()) ||
        l.admin_username?.toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.target_type.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(l.details).toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const getActionBadge = (action: string) => {
    const config = ACTION_CONFIG[action];
    if (!config) {
      return (
        <Badge variant="outline" className="gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          {action}
        </Badge>
      );
    }
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const formatDetails = (details: Record<string, any>) => {
    if (!details || Object.keys(details).length === 0) return '-';
    const parts: string[] = [];
    if (details.email) parts.push(details.email);
    if (details.title) parts.push(details.title);
    if (details.amount) parts.push(`$${Number(details.amount).toLocaleString('es-ES')}`);
    if (details.winning_option) parts.push(`Ganador: ${details.winning_option}`);
    if (details.method) parts.push(details.method === 'bank_transfer' ? 'Transferencia' : 'PayPal');
    if (details.reason) parts.push(`Motivo: ${details.reason}`);
    return parts.length > 0 ? parts.join(' • ') : JSON.stringify(details);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar en audit logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo de acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            <SelectItem value="resolve_market">Resolver mercado</SelectItem>
            <SelectItem value="block_user">Bloquear usuario</SelectItem>
            <SelectItem value="unblock_user">Desbloquear usuario</SelectItem>
            <SelectItem value="add_funds">Agregar fondos</SelectItem>
            <SelectItem value="approve_withdrawal">Aprobar retiro</SelectItem>
            <SelectItem value="reject_withdrawal">Rechazar retiro</SelectItem>
            <SelectItem value="approve_suggestion">Aprobar sugerencia</SelectItem>
            <SelectItem value="reject_suggestion">Rechazar sugerencia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredLogs.length > 0 ? (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalles</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.admin_username || 'Admin'}</p>
                        <p className="text-xs text-muted-foreground">{log.admin_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.target_type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">
                      {formatDetails(log.details)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(log.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      ) : (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-display text-lg font-semibold">No hay registros</h3>
          <p className="mt-2 text-muted-foreground">
            {search || actionFilter !== 'all'
              ? 'No se encontraron registros con los filtros aplicados.'
              : 'Aún no hay acciones administrativas registradas.'}
          </p>
        </div>
      )}
    </div>
  );
}
