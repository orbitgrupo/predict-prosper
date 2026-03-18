import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Comment {
  id: string;
  market_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    username: string | null;
    email: string;
  };
}

export function CommentsSection({ marketId }: { marketId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['market-comments', marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_comments')
        .select('*, profile:profiles!market_comments_user_id_fkey(username, email)')
        .eq('market_id', marketId)
        .order('created_at', { ascending: true });

      if (error) {
        // Fallback without join if FK doesn't exist
        const { data: fallback, error: err2 } = await supabase
          .from('market_comments')
          .select('*')
          .eq('market_id', marketId)
          .order('created_at', { ascending: true });
        if (err2) throw err2;
        return (fallback || []) as Comment[];
      }
      return (data || []) as Comment[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${marketId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'market_comments',
        filter: `market_id=eq.${marketId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['market-comments', marketId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [marketId, queryClient]);

  const postComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Debes iniciar sesión');
      const trimmed = content.trim();
      if (!trimmed || trimmed.length > 500) throw new Error('El comentario debe tener entre 1 y 500 caracteres');

      const { error } = await supabase
        .from('market_comments')
        .insert({ market_id: marketId, user_id: user.id, content: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['market-comments', marketId] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('market_comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-comments', marketId] });
      toast({ title: 'Comentario eliminado' });
    },
  });

  const getInitials = (comment: Comment) => {
    const name = comment.profile?.username || comment.profile?.email || '?';
    return name.slice(0, 2).toUpperCase();
  };

  const getDisplayName = (comment: Comment) => {
    return comment.profile?.username || comment.profile?.email?.split('@')[0] || 'Usuario';
  };

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comentarios ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 space-y-4">
        {/* Post form */}
        {user ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Comparte tu análisis..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              className="resize-none"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{content.length}/500</span>
              <Button
                size="sm"
                onClick={() => postComment.mutate()}
                disabled={!content.trim() || postComment.isPending}
              >
                {postComment.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Comentar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Inicia sesión para comentar
          </p>
        )}

        {/* Comments list */}
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sé el primero en comentar
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 rounded-lg bg-secondary/50 p-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">{getInitials(comment)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{getDisplayName(comment)}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es })}
                      </span>
                      {user && user.id === comment.user_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteComment.mutate(comment.id)}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
