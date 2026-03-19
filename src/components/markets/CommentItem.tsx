import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Reply, Send, Loader2, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export interface CommentWithReplies {
  id: string;
  market_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profile?: {
    username: string | null;
    email: string;
  };
  replies: CommentWithReplies[];
}

export interface ReactionCounts {
  likes: number;
  dislikes: number;
  userReaction: 'like' | 'dislike' | null;
}

interface CommentItemProps {
  comment: CommentWithReplies;
  userId?: string;
  depth?: number;
  onReply: (parentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  onReact: (commentId: string, type: 'like' | 'dislike') => void;
  reactions: Map<string, ReactionCounts>;
  isReplying: boolean;
}

export function CommentItem({ comment, userId, depth = 0, onReply, onDelete, isReplying }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const maxDepth = 3;

  const getInitials = () => {
    const name = comment.profile?.username || comment.profile?.email || '?';
    return name.slice(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    return comment.profile?.username || comment.profile?.email?.split('@')[0] || 'Usuario';
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      await onReply(comment.id, replyContent.trim());
      setReplyContent('');
      setShowReplyForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={depth > 0 ? 'ml-4 sm:ml-8 border-l-2 border-border pl-3 sm:pl-4' : ''}>
      <div className="flex gap-3 rounded-lg bg-secondary/50 p-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">{getDisplayName()}</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es })}
              </span>
              {userId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  disabled={depth >= maxDepth}
                  title={depth >= maxDepth ? 'Máximo nivel de respuestas alcanzado' : 'Responder'}
                >
                  <Reply className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
              {userId && userId === comment.user_id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onDelete(comment.id)}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.content}</p>

          {/* Reply form */}
          {showReplyForm && (
            <div className="mt-2 space-y-2">
              <Textarea
                placeholder={`Responder a ${getDisplayName()}...`}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                maxLength={500}
                className="resize-none text-sm"
                rows={2}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{replyContent.length}/500</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowReplyForm(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitReply}
                    disabled={!replyContent.trim() || submitting}
                  >
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Responder
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-6 px-2"
            onClick={() => setShowReplies(!showReplies)}
          >
            {showReplies ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {comment.replies.length} {comment.replies.length === 1 ? 'respuesta' : 'respuestas'}
          </Button>
          {showReplies && (
            <div className="space-y-2 mt-1">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  userId={userId}
                  depth={depth + 1}
                  onReply={onReply}
                  onDelete={onDelete}
                  isReplying={isReplying}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
