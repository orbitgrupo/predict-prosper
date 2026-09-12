import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, LifeBuoy } from 'lucide-react';
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
  read_by_user: boolean;
  created_at: string;
}

interface SupportChatSectionProps {
  userId: string;
}

export function SupportChatSection({ userId }: SupportChatSectionProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('support_messages' as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
    } else {
      setMessages((data ?? []) as unknown as SupportMessage[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`support-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages', filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const { error } = await supabase.from('support_messages' as any).insert({
      user_id: userId,
      sender_id: userId,
      is_admin: false,
      content: text.trim(),
      read_by_user: true,
      read_by_admin: false,
    });
    setSending(false);
    if (error) {
      toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    setText('');
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <LifeBuoy className="h-4 w-4 text-primary" />
          Soporte
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Escríbenos y el equipo te responderá aquí mismo.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">
                Aún no has iniciado una conversación. Cuéntanos en qué podemos ayudarte.
              </p>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.is_admin ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.is_admin
                          ? 'bg-muted text-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {m.is_admin && (
                        <p className="text-[11px] font-medium opacity-80 mb-0.5">Soporte</p>
                      )}
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
        )}

        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe tu mensaje..."
            rows={2}
            className="resize-none"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={sending || !text.trim()} size="icon">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
