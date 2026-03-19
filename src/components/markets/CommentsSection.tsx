import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { CommentItem, CommentWithReplies, ReactionCounts } from './CommentItem';

function buildTree(comments: CommentWithReplies[]): CommentWithReplies[] {
  const map = new Map<string, CommentWithReplies>();
  const roots: CommentWithReplies[] = [];

  comments.forEach(c => map.set(c.id, { ...c, replies: [] }));

  map.forEach((comment) => {
    if (comment.parent_id && map.has(comment.parent_id)) {
      map.get(comment.parent_id)!.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  return roots;
}

export function CommentsSection({ marketId }: { marketId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');

  const { data: flatComments = [], isLoading } = useQuery({
    queryKey: ['market-comments', marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_comments')
        .select('*')
        .eq('market_id', marketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return [] as CommentWithReplies[];

      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(c => ({
        ...c,
        parent_id: (c as any).parent_id || null,
        profile: profileMap.get(c.user_id) || undefined,
        replies: [],
      })) as CommentWithReplies[];
    },
  });

  const comments = useMemo(() => buildTree(flatComments), [flatComments]);

  // Fetch reactions for all comments in this market
  const { data: reactionsMap = new Map<string, ReactionCounts>() } = useQuery({
    queryKey: ['comment-reactions', marketId],
    queryFn: async () => {
      const commentIds = flatComments.map(c => c.id);
      if (commentIds.length === 0) return new Map<string, ReactionCounts>();

      const { data: allReactions } = await supabase
        .from('comment_reactions')
        .select('comment_id, user_id, reaction_type')
        .in('comment_id', commentIds);

      const map = new Map<string, ReactionCounts>();
      commentIds.forEach(id => map.set(id, { likes: 0, dislikes: 0, userReaction: null }));

      (allReactions || []).forEach((r: any) => {
        const entry = map.get(r.comment_id);
        if (!entry) return;
        if (r.reaction_type === 'like') entry.likes++;
        else entry.dislikes++;
        if (user && r.user_id === user.id) entry.userReaction = r.reaction_type;
      });

      return map;
    },
    enabled: flatComments.length > 0,
  });

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
    mutationFn: async (params: { content: string; parentId?: string }) => {
      if (!user) throw new Error('Debes iniciar sesión');
      const trimmed = params.content.trim();
      if (!trimmed || trimmed.length > 500) throw new Error('El comentario debe tener entre 1 y 500 caracteres');

      const insertData: any = { market_id: marketId, user_id: user.id, content: trimmed };
      if (params.parentId) insertData.parent_id = params.parentId;

      const { error } = await supabase.from('market_comments').insert(insertData);
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

  const handleReply = async (parentId: string, replyContent: string) => {
    await postComment.mutateAsync({ content: replyContent, parentId });
  };

  const handleReact = async (commentId: string, type: 'like' | 'dislike') => {
    if (!user) return;
    const current = reactionsMap.get(commentId);
    
    if (current?.userReaction === type) {
      // Remove reaction
      await supabase.from('comment_reactions').delete()
        .eq('comment_id', commentId).eq('user_id', user.id);
    } else if (current?.userReaction) {
      // Switch reaction
      await supabase.from('comment_reactions').update({ reaction_type: type })
        .eq('comment_id', commentId).eq('user_id', user.id);
    } else {
      // New reaction
      await supabase.from('comment_reactions').insert({
        comment_id: commentId, user_id: user.id, reaction_type: type
      });
    }
    queryClient.invalidateQueries({ queryKey: ['comment-reactions', marketId] });
  };

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comentarios ({flatComments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 space-y-4">
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
                onClick={() => postComment.mutate({ content })}
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
              <CommentItem
                key={comment.id}
                comment={comment}
                userId={user?.id}
                onReply={handleReply}
                onDelete={(id) => deleteComment.mutate(id)}
                onReact={handleReact}
                reactions={reactionsMap}
                isReplying={postComment.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
