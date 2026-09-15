import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageSquare, Search, ArrowLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/lib/errors';

interface SupportMessage {
  id: string;
  user_id: string;
  sender_id: string;
  is_admin: boolean;
  content: string;
  read_by_admin: boolean;
  read_by_user: boolean;
  created_at: string;
}

interface Conversation {
  userId: string;
  email: string;
  username: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
  total: number;
}

export function SupportChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { email: string; username: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('support_messages' as any)
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
      setLoading(false);
      return;
    }

    const msgs = (data ?? []) as unknown as SupportMessage[];
    setMessages(msgs);

    const ids = Array.from(new Set(msgs.map((m) => m.user_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, email, username')
        .in('id', ids);
      const map: Record<string, { email: string; username: string | null }> = {};
      for (const p of profs ?? []) map[p.id] = { email: p.email, username: p.username };
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin-support-messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conversations = useMemo<Conversation[]>(() => {
    const map = new Map<string, Conversation>();
    for (const m of messages) {
      const prof = profiles[m.user_id];
      const existing = map.get(m.user_id);
      const unreadInc = !m.is_admin && !m.read_by_admin ? 1 : 0;
      if (!existing) {
        map.set(m.user_id, {
          userId: m.user_id,
          email: prof?.email ?? 'Usuario',
          username: prof?.username ?? null,
          lastMessage: m.content,
          lastAt: m.created_at,
          unread: unreadInc,
          total: 1,
        });
      } else {
        existing.lastMessage = m.content;
        existing.lastAt = m.created_at;
        existing.unread += unreadInc;
        existing.total += 1;
      }
    }
    const list = Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.email.toLowerCase().includes(q) || (c.username ?? '').toLowerCase().includes(q)
    );
  }, [messages, profiles, search]);

  const thread = useMemo(
    () => messages.filter((m) => m.user_id === activeUser),
    [messages, activeUser]
  );

  useEffect(() => {
    if (activeUser) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.length, activeUser]);

  // Marcar como leídos los mensajes del usuario abierto
  useEffect(() => {
    if (!activeUser) return;
    const unreadIds = thread.filter((m) => !m.is_admin && !m.read_by_admin).map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase
      .from('support_messages' as any)
      .update({ read_by_admin: true })
      .in('id', unreadIds)
      .then(() => {
        setMessages((prev) =>
          prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read_by_admin: true } : m))
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser, thread.length]);

  const handleSend = async () => {
    if (!user || !activeUser || !reply.trim()) return;
    setSending(true);
    const { error } = await supabase.from('support_messages' as any).insert({
      user_id: activeUser,
      sender_id: user.id,
      is_admin: true,
      content: reply.trim(),
      read_by_admin: true,
      read_by_user: false,
    });
    setSending(false);
    if (error) {
      toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    setReply('');
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Pantalla de conversación abierta
  if (activeUser) {
    const prof = profiles[activeUser];
    return (
      <Card className="flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveUser(null)}
              aria-label="Volver a la lista de conversaciones"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                {prof?.username || prof?.email || 'Conversación'}
              </CardTitle>
              {prof?.username && (
                <p className="text-xs text-muted-foreground truncate">{prof.email}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-4">
          <ScrollArea className="h-[460px] pr-3">
            {thread.length === 0 ? (
              <p className="text-sm text-muted-foreground py-20 text-center">
                Esta conversación aún no tiene mensajes.
              </p>
            ) : (
              <div className="space-y-3">
                {thread.map((m) => (
                  <div key={m.id} className={`flex ${m.is_admin ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.is_admin
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p className="mt-1 text-[11px] opacity-70">
                        {format(new Date(m.created_at), 'dd MMM, HH:mm', { locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          <div className="flex items-end gap-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escribe tu respuesta..."
              disabled={sending}
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={handleSend} disabled={sending || !reply.trim()} size="icon">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pantalla de listado
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Conversaciones de soporte
        </CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email o usuario"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Todavía no hay mensajes de soporte.</p>
        ) : (
          <ul className="divide-y">
            {conversations.map((c) => (
              <li key={c.userId}>
                <button
                  type="button"
                  onClick={() => setActiveUser(c.userId)}
                  className="w-full text-left px-4 py-3 transition-colors hover:bg-muted/60 flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{c.username || c.email}</span>
                      {c.unread > 0 && <Badge className="shrink-0">{c.unread}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.total} mensaje{c.total === 1 ? '' : 's'} ·{' '}
                      {format(new Date(c.lastAt), 'dd MMM yyyy, HH:mm', { locale: es })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
