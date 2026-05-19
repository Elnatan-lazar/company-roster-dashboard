'use client';

import { useState } from 'react';
import { MessageSquare, Plus, Lock } from 'lucide-react';
import type { FeedbackRow } from '@/types/database';

interface FeedbackItem extends FeedbackRow { author_name: string }

interface Props {
  soldierId:       string;
  soldierName:     string;
  initialFeedback: FeedbackItem[];
}

export default function SoldierFeedbackSection({
  soldierId, soldierName, initialFeedback,
}: Props) {
  const [feedback,  setFeedback]  = useState(initialFeedback);
  const [content,   setContent]   = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading,   setLoading]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    const res  = await fetch(`/api/soldiers/${soldierId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim(), is_private: isPrivate }),
    });
    const data = await res.json();

    if (data.feedback) {
      setFeedback(prev => [{
        ...data.feedback,
        author_name: 'אני',
      }, ...prev]);
      setContent('');
    }
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <MessageSquare className="w-4 h-4 text-olive-600" />
        <h3 className="font-bold text-gray-800">היסטוריית משובים</h3>
        <span className="text-xs text-gray-400 mr-auto">{feedback.length} רשומות</span>
      </div>

      {/* Add feedback form */}
      <form onSubmit={submit} className="p-4 border-b border-gray-100 bg-gray-50 space-y-3">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
          placeholder={`הוסף משוב על ${soldierName}...`}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-olive-400"
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
              className="w-3.5 h-3.5 accent-olive-700"
            />
            <Lock className="w-3 h-3" />
            סודי (נראה רק למ&quot;פ)
          </label>
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-olive-700 text-white rounded-xl hover:bg-olive-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {loading ? 'שומר...' : 'הוסף משוב'}
          </button>
        </div>
      </form>

      {/* Feedback list */}
      <div className="divide-y divide-gray-50">
        {feedback.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            אין משובים עדיין
          </div>
        ) : (
          feedback.map(f => (
            <div key={f.id} className="px-6 py-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700">{f.author_name}</span>
                <div className="flex items-center gap-2">
                  {f.is_private && (
                    <span className="flex items-center gap-0.5 text-xs text-gray-400">
                      <Lock className="w-3 h-3" /> סודי
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(f.created_at).toLocaleDateString('he-IL')}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{f.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
