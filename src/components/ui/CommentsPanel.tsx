'use client';

import { useState, type ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';

export default function CommentsPanel({
  children,
  assetId,
}: {
  children?: ReactNode;
  assetId?: string;
  [key: string]: unknown;
}) {
  const [message, setMessage] = useState('');

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border bg-surface p-4 shadow-soft">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
          <MessageSquare className="h-4 w-4" />
          Comments {assetId ? `for ${assetId}` : ''}
        </div>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Write a comment..."
        />
        <div className="mt-3">
          <Button size="sm" onClick={() => setMessage('')}>
            Add Comment
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
