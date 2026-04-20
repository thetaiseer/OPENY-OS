'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import supabase from '@/lib/supabase';
import type { Comment } from '@/lib/types';

interface CommentsPanelProps {
  assetId?: string;
  taskId?: string;
}

export default function CommentsPanel({ assetId, taskId }: CommentsPanelProps) {
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

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const addComment = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text.trim(),
          ...(assetId ? { asset_id: assetId } : {}),
          ...(taskId ? { task_id: taskId } : {}),
        }),
      });
      if (!res.ok) throw new Error('failed');
      setText('');
      await fetchComments();
    } catch {
      // best-effort
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare size={16} style={{ color: 'var(--text-secondary)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Comments ({comments.length})
        </h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>No comments yet</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.map(c => (
            <div key={c.id} className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{c.user_name}</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text)' }}>{c.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="flex-1 h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
          style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          placeholder="Add a comment..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
        />
        <button
          onClick={addComment}
          disabled={saving || !text.trim()}
          className="h-9 px-3 rounded-lg flex items-center gap-1.5 text-sm font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent)' }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
