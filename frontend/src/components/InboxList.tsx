import React, { useState } from 'react';
import { EmailJob } from '../types';
import { Search, Filter, RefreshCw, Clock, Star } from 'lucide-react';
import { displayName, badgeTime } from '../utils/format';

interface InboxListProps {
  emails: EmailJob[];
  loading: boolean;
  isSearch: boolean;
  query: string;
  status: string;
  onQuery: (q: string) => void;
  onStatus: (s: string) => void;
  onRefresh: () => void;
  onOpen: (email: EmailJob) => void;
  starred: Set<string>;
  onToggleStar: (id: string) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'SENT', label: 'Sent' },
  { value: 'RESCHEDULED', label: 'Rate limited' },
  { value: 'FAILED', label: 'Failed' }
];

export const InboxList: React.FC<InboxListProps> = ({
  emails,
  loading,
  isSearch,
  query,
  status,
  onQuery,
  onStatus,
  onRefresh,
  onOpen,
  starred,
  onToggleStar
}) => {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center gap-5 px-6 pt-5 pb-3">
        <div className="relative w-full max-w-xl">
          <Search className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-field rounded-lg pl-10 pr-4 py-2 text-sm text-ink-900 placeholder-ink-400 outline-none focus:ring-1 focus:ring-brand-500 transition-shadow"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={`p-1.5 rounded-md transition-colors ${status ? 'text-brand-600 bg-brand-100' : 'text-ink-400 hover:text-ink-600'}`}
            aria-label="Filter by status"
          >
            <Filter className="w-4 h-4" />
          </button>

          {filterOpen && (
            <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-line rounded-md shadow-sm py-1 z-20">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onStatus(opt.value); setFilterOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-page ${
                    status === opt.value ? 'text-brand-600 font-semibold' : 'text-ink-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="p-1.5 text-ink-400 hover:text-ink-600 rounded-md transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isSearch && (
        <p className="px-6 pb-2 text-xs text-ink-400">
          {emails.length} result{emails.length === 1 ? '' : 's'} for “{query}”
        </p>
      )}

      <div className="border-t border-line">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-10 bg-field rounded-md animate-pulse" />
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="py-24 text-center text-sm text-ink-400">No emails here yet</div>
        ) : (
          <ul className="divide-y divide-line">
            {emails.map((job) => {
              const time = job.status === 'SENT' && job.sentAt ? job.sentAt : job.scheduledFor;
              const preview = (job.body || '').replace(/\s+/g, ' ').trim();
              const isStarred = starred.has(job.id);

              return (
                <li key={job.id} className="border-b border-line last:border-b-0">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(job)}
                    onKeyDown={(e) => e.key === 'Enter' && onOpen(job)}
                    className="w-full flex items-center gap-4 px-6 py-3.5 cursor-pointer hover:bg-white/70 transition-colors"
                  >
                    <span className="w-44 shrink-0 truncate text-sm text-ink-900">
                      <span className="font-semibold">To:</span> {displayName(job.recipient)}
                    </span>

                    <span className="shrink-0 inline-flex items-center gap-1.5 bg-peach-100 text-peach-600 rounded-full px-3 py-1 text-xs font-semibold">
                      <Clock className="w-3 h-3" />
                      {badgeTime(time)}
                    </span>

                    <span className="flex-1 min-w-0 truncate text-sm">
                      <span className="font-semibold text-ink-900">{job.subject}</span>
                      {preview && <span className="text-ink-400"> - {preview}</span>}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleStar(job.id); }}
                      className="shrink-0 p-1 text-ink-400 hover:text-ink-600 transition-colors"
                      aria-label={isStarred ? 'Unstar email' : 'Star email'}
                    >
                      <Star className={`w-4 h-4 ${isStarred ? 'fill-peach-600 text-peach-600' : ''}`} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
