import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bell, CheckCircle, XCircle, Info, Check, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Notifications() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const markAsRead = async (id: string) => {
    await supabase.from('notifications' as any).update({ is_read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
  };

  const markAllAsRead = async () => {
    if (!notifications?.length) return;
    const unreadIds = notifications.filter((n: any) => !n.is_read).map((n: any) => n.id);
    if (!unreadIds.length) return;
    await supabase.from('notifications' as any).update({ is_read: true }).in('id', unreadIds);
    queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'withdrawal_approved':
        return <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />;
      case 'withdrawal_rejected':
        return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
      default:
        return <Info className="h-5 w-5 text-primary shrink-0" />;
    }
  };

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-3">
              <Bell className="h-7 w-7" />
              Notificaciones
            </h1>
            <p className="mt-1 text-muted-foreground">
              {unreadCount > 0
                ? `Tienes ${unreadCount} notificación${unreadCount > 1 ? 'es' : ''} sin leer`
                : 'Estás al día'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1.5">
              <Check className="h-4 w-4" />
              Marcar todas como leídas
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No tienes notificaciones aún</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => (
              <Card
                key={n.id}
                className={`transition-colors cursor-pointer hover:bg-muted/30 ${
                  !n.is_read ? 'border-primary/30 bg-primary/5' : ''
                }`}
                onClick={() => { if (!n.is_read) markAsRead(n.id); }}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <div className="mt-0.5">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm ${!n.is_read ? 'font-bold' : 'font-medium'}`}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          Nueva
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
