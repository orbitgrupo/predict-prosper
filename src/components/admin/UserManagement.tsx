import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserDetailDialog } from './UserDetailDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { 
  Loader2, 
  Search, 
  DollarSign,
  Ban,
  CheckCircle,
  History,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Profile {
  id: string;
  email: string;
  username: string | null;
  phone: string | null;
  balance: number;
  is_blocked: boolean;
  is_age_verified: boolean | null;
  document_status: string | null;
  document_front_url: string | null;
  document_back_url: string | null;
  document_rejection_reason: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  market_id: string | null;
}

interface Bet {
  id: string;
  amount: number;
  option: string;
  is_winner: boolean | null;
  payout_amount: number | null;
  created_at: string;
  market: {
    title: string;
  } | null;
}

const USERS_PER_PAGE = 10;

export function UserManagement() {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Add funds dialog
  const [fundsDialogOpen, setFundsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [fundsAmount, setFundsAmount] = useState('');
  const [addingFunds, setAddingFunds] = useState(false);

  // History dialog
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [userHistory, setUserHistory] = useState<{
    transactions: Transaction[];
    bets: Bet[];
  }>({ transactions: [], bets: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<Profile | null>(null);
  const [detailEmailConfirmed, setDetailEmailConfirmed] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm]);

  const fetchUsers = async () => {
    setLoading(true);
    
    const from = (currentPage - 1) * USERS_PER_PAGE;
    const to = from + USERS_PER_PAGE - 1;

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (searchTerm) {
      query = query.or(`email.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`);
    }

    const { data, error, count } = await query.range(from, to);
    
    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios.',
        variant: 'destructive',
      });
    } else {
      setUsers(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const handleToggleBlock = async (user: Profile) => {
    const newBlockedStatus = !user.is_blocked;
    
    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: newBlockedStatus })
      .eq('id', user.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del usuario.',
        variant: 'destructive',
      });
    } else {
      await logAction(newBlockedStatus ? 'block_user' : 'unblock_user', 'user', user.id, { email: user.email });
      toast({
        title: newBlockedStatus ? 'Usuario bloqueado' : 'Usuario desbloqueado',
        description: `${user.email} ha sido ${newBlockedStatus ? 'bloqueado' : 'desbloqueado'}.`,
      });
      fetchUsers();
    }
  };

  const handleAddFunds = async () => {
    if (!selectedUser || !fundsAmount) return;
    
    const amount = parseFloat(fundsAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Error',
        description: 'Ingresa un monto válido mayor a 0.',
        variant: 'destructive',
      });
      return;
    }

    setAddingFunds(true);
    try {
      const { data, error } = await supabase.rpc('admin_add_funds', {
        p_user_id: selectedUser.id,
        p_amount: amount,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Error al agregar fondos');
      }

      await logAction('add_funds', 'user', selectedUser.id, { email: selectedUser.email, amount });
      toast({
        title: 'Fondos agregados',
        description: `Se han agregado $${amount.toLocaleString('es-ES')} a ${selectedUser.email}.`,
      });

      setFundsDialogOpen(false);
      setSelectedUser(null);
      setFundsAmount('');
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAddingFunds(false);
    }
  };

  const handleViewHistory = async (user: Profile) => {
    setSelectedUser(user);
    setLoadingHistory(true);
    setHistoryDialogOpen(true);

    try {
      // Fetch transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch bets with market info
      const { data: bets } = await supabase
        .from('bets')
        .select(`
          *,
          market:markets(title)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setUserHistory({
        transactions: transactions || [],
        bets: (bets || []) as Bet[],
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el historial.',
        variant: 'destructive',
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewDetail = async (user: Profile) => {
    setDetailUser(user);
    setDetailDialogOpen(true);
    setLoadingDetail(true);
    setDetailEmailConfirmed(false);

    try {
      // We check if the user has confirmed email by looking at verified_at or other heuristics
      // Since we can't access auth.users, we use the profile's verified_at as a proxy
      // If verified_at exists, email was confirmed
      setDetailEmailConfirmed(!!user.verified_at);
    } finally {
      setLoadingDetail(false);
    }
  };

  const totalPages = Math.ceil(totalCount / USERS_PER_PAGE);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por email o nombre de usuario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id} className="cursor-pointer" onClick={() => handleViewDetail(user)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{user.username || 'Sin nombre'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">
                        ${Number(user.balance).toLocaleString('es-ES')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.is_blocked ? (
                        <Badge variant="destructive">Bloqueado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-success border-success">Activo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(user.created_at), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewHistory(user)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setFundsDialogOpen(true);
                          }}
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={user.is_blocked ? "outline" : "destructive"}
                          size="sm"
                          onClick={() => handleToggleBlock(user)}
                        >
                          {user.is_blocked ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <Ban className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No se encontraron usuarios.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((currentPage - 1) * USERS_PER_PAGE) + 1}-{Math.min(currentPage * USERS_PER_PAGE, totalCount)} de {totalCount} usuarios
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Add funds dialog */}
      <Dialog open={fundsDialogOpen} onOpenChange={setFundsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar fondos</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 pt-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">Usuario</p>
                <p className="font-medium">{selectedUser.email}</p>
                <p className="text-sm">Balance actual: <span className="font-mono">${Number(selectedUser.balance).toLocaleString('es-ES')}</span></p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Monto a agregar</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={fundsAmount}
                  onChange={(e) => setFundsAmount(e.target.value)}
                  placeholder="100.00"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleAddFunds}
                disabled={addingFunds || !fundsAmount}
              >
                {addingFunds ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  'Agregar fondos'
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Historial de {selectedUser?.email}</DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6 overflow-y-auto flex-1 pr-2">
              {/* Transactions */}
              <div>
                <h4 className="font-medium mb-3">Transacciones</h4>
                {userHistory.transactions.length > 0 ? (
                  <div className="space-y-2">
                    {userHistory.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.description || 'Sin descripción'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                          </p>
                        </div>
                        <span className={`font-mono font-medium ${
                          tx.type === 'bet' ? 'text-destructive' : 'text-success'
                        }`}>
                          {tx.type === 'bet' ? '-' : '+'}${Math.abs(tx.amount).toLocaleString('es-ES')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin transacciones.</p>
                )}
              </div>

              {/* Bets */}
              <div>
                <h4 className="font-medium mb-3">Apuestas</h4>
                {userHistory.bets.length > 0 ? (
                  <div className="space-y-2">
                    {userHistory.bets.map((bet) => (
                      <div key={bet.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">{bet.market?.title || 'Mercado eliminado'}</p>
                          <p className="text-xs text-muted-foreground">
                            Opción: {bet.option} • Monto: ${bet.amount.toLocaleString('es-ES')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(bet.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                          </p>
                        </div>
                        {bet.is_winner !== null && (
                          <Badge variant={bet.is_winner ? "default" : "destructive"}>
                            {bet.is_winner ? `+$${bet.payout_amount?.toLocaleString('es-ES')}` : 'Perdida'}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin apuestas.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User detail dialog */}
      <UserDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        user={detailUser}
        isEmailConfirmed={detailEmailConfirmed}
        onUserUpdated={fetchUsers}
      />
    </div>
  );
}
