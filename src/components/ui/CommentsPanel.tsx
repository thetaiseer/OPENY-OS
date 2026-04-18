'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Comment } from '@/lib/types';

interface CommentsPanelProps {
  assetId?: string;
  taskId?: string;
}

export default function CommentsPanel({ assetId, taskId }: CommentsPanelProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchComments = useCallback(async () => {
    let query = supabase.from('comments').select('*').order('created_at', { ascending: true });
    if (assetId) query = query.eq('asset_id', assetId);
    else if (taskId) query = query.eq('task_id', taskId);

    const { data, error } = await query;
    if (!error) setComments((data ?? []) as Comment[]);
    setLoading(false);
  }, [assetId, taskId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function addComment() {
    if (!text.trim()) return;

    setSaving(true);
    const payload: Record<string, unknown> = {
      content: text.trim(),
      user_id: user.id,
      user_name: user.name,
    };

    if (assetId) payload.asset_id = assetId;
    if (taskId) payload.task_id = taskId;

    const { error } = await supabase.from('comments').insert(payload);
    if (!error) {
      setText('');
      await fetchComments();
    }
    setSaving(false);
  }

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <header className="mb-3 flex items-center gap-2">
        <MessageSquare size={16} className="text-[var(--text-secondary)]" />
        <h3 className="text-sm font-semibold">Comments ({comments.length})</h3>
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="skeleton-shimmer h-12 rounded-lg" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-3 text-center text-sm text-[var(--text-secondary)]">No comments yet</p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <article key={comment.id} className="rounded-lg border p-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--accent)]">{comment.user_name}</span>
                <span className="text-xs text-[var(--text-secondary)]">{new Date(comment.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm">{comment.content}</p>
            </article>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void addComment();
            }
          }}
          className="openy-field h-9 flex-1 rounded-lg px-3 text-sm outline-none"
          placeholder="Add a comment..."
        />
        <button
          type="button"
          onClick={() => void addComment()}
          disabled={saving || !text.trim()}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          <Send size={13} />
        </button>
      </div>
    </section>
  );
}
