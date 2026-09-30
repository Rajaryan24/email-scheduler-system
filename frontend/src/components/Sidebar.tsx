import React, { useState } from 'react';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Clock, Send, ChevronDown, LogOut } from 'lucide-react';

interface SidebarProps {
  user: User;
  nav: 'scheduled' | 'sent';
  scheduledCount: number;
  sentCount: number;
  onNav: (nav: 'scheduled' | 'sent') => void;
  onCompose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  nav,
  scheduledCount,
  sentCount,
  onNav,
  onCompose
}) => {
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = [
    { key: 'scheduled' as const, label: 'Scheduled', icon: Clock, count: scheduledCount },
    { key: 'sent' as const, label: 'Sent', icon: Send, count: sentCount }
  ];

  return (
    <aside className="w-56 shrink-0 px-3 py-4 flex flex-col">
      <div className="px-2 pb-5">
        <span className="text-xl font-black tracking-tight text-ink-900 select-none" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          EMAILSCH
        </span>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="w-full flex items-center gap-2 bg-field hover:bg-line/70 rounded-lg p-2 text-left transition-colors"
        >
          <img
            src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`}
            alt={user.name}
            className="w-7 h-7 rounded-full object-cover shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink-900 truncate">{user.name}</span>
            <span className="block text-[10px] text-ink-400 truncate">{user.email}</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-400 shrink-0" />
        </button>

        {menuOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-line rounded-md shadow-sm z-20 overflow-hidden">
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-600 hover:bg-page transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onCompose}
        className="mt-3 w-full rounded-full border border-brand-500 py-1.5 text-sm font-medium text-brand-500 hover:bg-brand-50 transition-colors"
      >
        Compose
      </button>

      <p className="px-2 mt-7 mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-400">Core</p>

      <nav className="space-y-1">
        {items.map(({ key, label, icon: Icon, count }) => {
          const active = nav === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNav(key)}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                active ? 'bg-brand-100 font-semibold text-ink-900' : 'text-ink-600 hover:bg-field'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              <span className="text-xs text-ink-400">{count}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
