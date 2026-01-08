import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ArrowUpDown, DollarSign, TrendingUp, Gift, AlertCircle } from 'lucide-react';
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

interface Activity {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string | null;
  market_id: string | null;
  created_at: string;
  user_email?: string;
  user_username?: string;
  market_title?: string;
}

const ITEMS_PER_PAGE = 15;

export function ActivityHistory() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchActivities();
  }, [currentPage, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // First get total count
      let countQuery = supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });

      if (typeFilter !== 'all') {
        countQuery = countQuery.eq('type', typeFilter);
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Fetch transactions with pagination
      let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      // Get unique user IDs and market IDs
      const userIds = [...new Set(transactions.map(t => t.user_id))];
      const marketIds = [...new Set(transactions.filter(t => t.market_id).map(t => t.market_id))];

      // Fetch user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, username')
        .in('id', userIds);

      // Fetch market titles if there are market IDs
      let markets: { id: string; title: string }[] = [];
      if (marketIds.length > 0) {
        const { data: marketsData } = await supabase
          .from('markets')
          .select('id, title')
          .in('id', marketIds as string[]);
        markets = marketsData || [];
      }

      // Combine data
      const enrichedActivities = transactions.map(t => {
        const profile = profiles?.find(p => p.id === t.user_id);
        const market = markets.find(m => m.id === t.market_id);
        return {
          ...t,
          user_email: profile?.email,
          user_username: profile?.username,
          market_title: market?.title,
        };
      });

      // Apply search filter client-side for simplicity
      const filteredActivities = search
        ? enrichedActivities.filter(a =>
            a.user_email?.toLowerCase().includes(search.toLowerCase()) ||
            a.user_username?.toLowerCase().includes(search.toLowerCase()) ||
            a.description?.toLowerCase().includes(search.toLowerCase()) ||
            a.market_title?.toLowerCase().includes(search.toLowerCase())
          )
        : enrichedActivities;

      setActivities(filteredActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bet':
        return <TrendingUp className="h-4 w-4" />;
      case 'payout':
        return <DollarSign className="h-4 w-4" />;
      case 'bonus':
        return <Gift className="h-4 w-4" />;
      case 'deposit':
        return <ArrowUpDown className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'bet':
        return 'default';
      case 'payout':
        return 'default';
      case 'bonus':
        return 'secondary';
      case 'deposit':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bet':
        return 'Apuesta';
      case 'payout':
        return 'Ganancia';
      case 'bonus':
        return 'Bono';
      case 'deposit':
        return 'Depósito';
      default:
        return type;
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuario, descripción o mercado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de actividad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="bet">Apuestas</SelectItem>
            <SelectItem value="payout">Ganancias</SelectItem>
            <SelectItem value="bonus">Bonos</SelectItem>
            <SelectItem value="deposit">Depósitos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : activities.length > 0 ? (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Mercado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{activity.user_username || 'Sin nombre'}</p>
                        <p className="text-xs text-muted-foreground">{activity.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(activity.type)} className="gap-1">
                        {getTypeIcon(activity.type)}
                        {getTypeLabel(activity.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={activity.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {activity.amount >= 0 ? '+' : ''}${Math.abs(activity.amount).toLocaleString('es-ES')}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {activity.description || '-'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {activity.market_title || '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(activity.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
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
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-display text-lg font-semibold">
            No hay actividades
          </h3>
          <p className="mt-2 text-muted-foreground">
            {search || typeFilter !== 'all'
              ? 'No se encontraron actividades con los filtros aplicados.'
              : 'Aún no hay actividades registradas.'}
          </p>
        </div>
      )}
    </div>
  );
}
