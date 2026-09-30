import React, { useRef, useState } from 'react';
import { User } from '../types';
import { emailApi } from '../services/api';
import {
  ArrowLeft, Paperclip, Clock, CalendarDays, ChevronDown,
  Undo2, Redo2, Type, Bold, Italic, Underline, AlignLeft, ChevronsUpDown,
  ListOrdered, List, Indent, Outdent, Quote, Strikethrough
} from 'lucide-react';

interface ComposeViewProps {
  user: User;
  onBack: () => void;
  onSent: () => void;
}

const tomorrowAt = (hours: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hours, 0, 0, 0);
  return d;
};

const PRESETS = [
  { label: 'Tomorrow, 10:00 AM', date: () => tomorrowAt(10) },
  { label: 'Tomorrow, 11:00 AM', date: () => tomorrowAt(11) },
  { label: 'Tomorrow, 3:00 PM', date: () => tomorrowAt(15) }
];

const ToolbarIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="p-1.5 text-ink-400">{children}</span>
);

const ToolbarDivider: React.FC = () => <span className="w-px h-4 bg-line mx-1" />;

export const ComposeView: React.FC<ComposeViewProps> = ({ user, onBack, onSent }) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySeconds, setDelaySeconds] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState('');
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pendingTime, setPendingTime] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLeadsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) setTo((prev) => (prev ? `${prev}, ${text}` : text));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSend = async () => {
    setError(null);
    const matches = to.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const recipients = Array.from(new Set(matches.map((m) => m.trim().toLowerCase())));

    if (recipients.length === 0) {
      setError('Add at least one valid recipient email in the To field.');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError('Subject and reply body are required.');
      return;
    }

    setSubmitting(true);
    try {
      await emailApi.schedule({
        senderEmail: user.email,
        recipients,
        subject: subject.trim(),
        body,
        startTime: (startTime || new Date(Date.now() + 60000)).toISOString(),
        delayBetweenEmailsSeconds: Number(delaySeconds) || 2,
        hourlyLimit: Number(hourlyLimit) || 50
      });
      onSent();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to schedule email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-full">
      <header className="flex items-center gap-4 px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 text-ink-900 hover:bg-field rounded-md transition-colors"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="flex-1 min-w-0 truncate text-xl font-medium text-ink-900">Compose New Email</h1>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="p-2 text-ink-400 hover:text-ink-600 rounded-md transition-colors"
          aria-label="Attach lead list"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleLeadsFile} className="hidden" />

        <button
          type="button"
          onClick={() => { setPendingTime(startTime); setPickOpen(false); setSendLaterOpen((o) => !o); }}
          className={`p-2 rounded-md transition-colors ${startTime ? 'text-brand-600 bg-brand-100' : 'text-ink-400 hover:text-ink-600'}`}
          aria-label="Send later"
        >
          <Clock className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleSend}
          disabled={submitting}
          className="rounded-full border border-brand-500 px-6 py-1.5 text-sm font-medium text-brand-500 hover:bg-brand-50 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Sending...' : 'Send'}
        </button>
      </header>

      {sendLaterOpen && (
        <div className="absolute right-6 top-14 w-64 bg-white border border-line rounded-lg shadow-lg p-4 z-30">
          <h3 className="text-sm font-semibold text-ink-900 mb-3">Send Later</h3>

          {pickOpen ? (
            <input
              type="datetime-local"
              value={pendingTime ? new Date(pendingTime.getTime() - pendingTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
              onChange={(e) => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) setPendingTime(d); }}
              className="w-full bg-field rounded-md px-2 py-1.5 text-xs text-ink-900 outline-none focus:ring-1 focus:ring-brand-500"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPickOpen(true)}
              className="w-full flex items-center justify-between pb-2 border-b border-line text-sm text-ink-400"
            >
              <span>Pick date &amp; time</span>
              <CalendarDays className="w-4 h-4" />
            </button>
          )}

          <p className="mt-3 mb-1 text-sm text-ink-600">Tomorrow</p>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => { setPendingTime(p.date()); setPickOpen(false); }}
              className={`w-full text-left py-1.5 text-sm rounded transition-colors hover:bg-page ${
                pendingTime && pendingTime.getTime() === p.date().getTime() ? 'text-brand-600 font-semibold' : 'text-ink-600'
              }`}
            >
              {p.label}
            </button>
          ))}

          <div className="flex items-center justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => setSendLaterOpen(false)}
              className="text-sm font-semibold text-ink-900 hover:text-ink-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { setStartTime(pendingTime); setSendLaterOpen(false); }}
              className="rounded-full border border-brand-500 px-5 py-1.5 text-sm font-medium text-brand-500 hover:bg-brand-50 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <form
        className="w-full max-w-4xl mx-auto px-6 pt-4 pb-16"
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
      >
        {error && <p className="mb-3 text-xs text-rose-600">{error}</p>}

        <div className="flex items-center gap-6 py-2">
          <label className="w-36 shrink-0 text-sm text-ink-900">From</label>
          <div className="relative">
            <select
              value={user.email}
              onChange={() => undefined}
              className="appearance-none bg-field rounded-md pl-3 pr-8 py-2 text-sm text-ink-900 outline-none"
            >
              <option value={user.email}>{user.email}</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-ink-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="w-36 shrink-0 text-sm text-ink-900" htmlFor="compose-to">To</label>
          <input
            id="compose-to"
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 bg-transparent border-b border-line py-2.5 text-sm text-ink-900 placeholder-ink-400 outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-6">
          <label className="w-36 shrink-0 text-sm text-ink-900" htmlFor="compose-subject">Subject</label>
          <input
            id="compose-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent border-b border-line py-2.5 text-sm text-ink-900 placeholder-ink-400 outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 py-4">
          <label className="text-sm text-ink-900" htmlFor="compose-delay">Delay between 2 emails</label>
          <input
            id="compose-delay"
            type="number"
            min={0}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(e.target.value)}
            placeholder="00"
            className="w-16 border border-line rounded-md px-2 py-2 text-sm text-center text-ink-900 placeholder-ink-400 outline-none focus:border-brand-500 transition-colors"
          />
          <label className="ml-4 text-sm text-ink-900" htmlFor="compose-limit">Hourly Limit</label>
          <input
            id="compose-limit"
            type="number"
            min={1}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(e.target.value)}
            placeholder="00"
            className="w-16 border border-line rounded-md px-2 py-2 text-sm text-center text-ink-900 placeholder-ink-400 outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        <div className="bg-field/70 rounded-md p-4 flex flex-col min-h-[420px]">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            className="flex-1 w-full bg-transparent resize-none text-sm text-ink-900 placeholder-ink-400 outline-none min-h-[80px]"
          />

          <div className="mt-3 flex items-center flex-wrap bg-white/70 rounded-md px-2 py-1">
            <ToolbarIcon><Undo2 className="w-4 h-4" /></ToolbarIcon>
            <ToolbarIcon><Redo2 className="w-4 h-4" /></ToolbarIcon>
            <ToolbarDivider />
            <ToolbarIcon><Type className="w-4 h-4" /></ToolbarIcon>
            <ToolbarDivider />
            <ToolbarIcon><Bold className="w-4 h-4" /></ToolbarIcon>
            <ToolbarIcon><Italic className="w-4 h-4" /></ToolbarIcon>
            <ToolbarIcon><Underline className="w-4 h-4" /></ToolbarIcon>
            <ToolbarDivider />
            <ToolbarIcon><AlignLeft className="w-4 h-4" /></ToolbarIcon>
            <ToolbarIcon><ChevronsUpDown className="w-4 h-4" /></ToolbarIcon>
            <ToolbarDivider />
            <ToolbarIcon><ListOrdered className="w-4 h-4" /></ToolbarIcon>
            <ToolbarIcon><List className="w-4 h-4" /></ToolbarIcon>
            <ToolbarIcon><Indent className="w-4 h-4" /></ToolbarIcon>
            <ToolbarIcon><Outdent className="w-4 h-4" /></ToolbarIcon>
            <ToolbarDivider />
            <ToolbarIcon><Quote className="w-4 h-4" /></ToolbarIcon>
            <ToolbarIcon><Strikethrough className="w-4 h-4" /></ToolbarIcon>
          </div>
        </div>
      </form>
    </div>
  );
};
