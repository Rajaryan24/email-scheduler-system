import React from 'react';
import { EmailJob, User } from '../types';
import { ArrowLeft, Star, Archive, Trash2, ChevronDown, ExternalLink } from 'lucide-react';
import { displayName, headerTime } from '../utils/format';

interface EmailDetailProps {
  email: EmailJob;
  user: User;
  onBack: () => void;
  starred: boolean;
  onToggleStar: () => void;
}

export const EmailDetail: React.FC<EmailDetailProps> = ({ email, user, onBack, starred, onToggleStar }) => {
  const senderName = displayName(email.senderEmail);
  const when = headerTime(email.status === 'SENT' && email.sentAt ? email.sentAt : email.scheduledFor);
  const paragraphs = (email.body || '').split(/\n{2,}/).filter((p) => p.trim());

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex items-center gap-4 px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 text-ink-900 hover:bg-field rounded-md transition-colors"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="flex-1 min-w-0 truncate text-xl font-medium text-ink-900">{email.subject}</h1>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleStar}
            className="p-2 text-ink-400 hover:text-ink-600 rounded-md transition-colors"
            aria-label={starred ? 'Unstar email' : 'Star email'}
          >
            <Star className={`w-4 h-4 ${starred ? 'fill-peach-600 text-peach-600' : ''}`} />
          </button>
          <button type="button" className="p-2 text-ink-400 hover:text-ink-600 rounded-md transition-colors" aria-label="Archive email">
            <Archive className="w-4 h-4" />
          </button>
          <button type="button" className="p-2 text-ink-400 hover:text-ink-600 rounded-md transition-colors" aria-label="Delete email">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="h-6 w-px bg-line mx-2" />

        <img
          src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`}
          alt={user.name}
          className="w-8 h-8 rounded-full object-cover"
        />
      </header>

      <article className="w-full max-w-3xl mx-auto px-6 pt-8 pb-16">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-semibold shrink-0">
            {senderName.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-semibold text-ink-900">{senderName}</span>{' '}
              <span className="text-ink-400">&lt;{email.senderEmail}&gt;</span>
            </p>
            <p className="flex items-center gap-1 text-xs text-ink-400 mt-0.5">
              to me <ChevronDown className="w-3 h-3" />
            </p>
          </div>

          <span className="text-sm text-ink-400 shrink-0">{when}</span>
        </div>

        <div className="mt-8 space-y-5 text-[15px] leading-6 text-ink-900">
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))
          ) : (
            <p className="text-ink-400">(no content)</p>
          )}
        </div>

        {email.etherealPreviewUrl && (
          <a
            href={email.etherealPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-8 rounded-full border border-brand-500 px-4 py-1.5 text-xs font-medium text-brand-500 hover:bg-brand-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Preview on Ethereal
          </a>
        )}
      </article>
    </div>
  );
};
