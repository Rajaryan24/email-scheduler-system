import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { InboxList } from './components/InboxList';
import { EmailDetail } from './components/EmailDetail';
import { ComposeView } from './components/ComposeView';
import { emailApi } from './services/api';
import { EmailJob } from './types';

type View = 'inbox' | 'detail' | 'compose';
type Nav = 'scheduled' | 'sent';

const Workspace: React.FC = () => {
  const { user, loading } = useAuth();

  const [nav, setNav] = useState<Nav>('scheduled');
  const [view, setView] = useState<View>('inbox');
  const [selected, setSelected] = useState<EmailJob | null>(null);
  const [scheduled, setScheduled] = useState<EmailJob[]>([]);
  const [sent, setSent] = useState<EmailJob[]>([]);
  const [starred, setStarred] = useState<Set<string>>(new Set());

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<EmailJob[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [scheduledRes, sentRes] = await Promise.all([
        emailApi.getScheduled(),
        emailApi.getSent()
      ]);
      setScheduled(scheduledRes.emails || []);
      setSent(sentRes.emails || []);
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [user, refresh]);

  useEffect(() => {
    if (!query.trim() && !status) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await emailApi.search(query, status);
        setResults(res.emails || []);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, status]);

  const toggleStar = useCallback((id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center text-sm text-ink-400">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const list = results ?? (nav === 'scheduled' ? scheduled : sent);

  return (
    <div className="min-h-screen bg-page text-ink-900 flex">
      <Sidebar
        user={user}
        nav={nav}
        scheduledCount={scheduled.length}
        sentCount={sent.length}
        onNav={(next) => { setNav(next); setView('inbox'); setSelected(null); }}
        onCompose={() => setView('compose')}
      />

      <main className="flex-1 min-w-0">
        {view === 'inbox' && (
          <InboxList
            emails={list}
            loading={loadingList}
            isSearch={results !== null}
            query={query}
            status={status}
            onQuery={setQuery}
            onStatus={setStatus}
            onRefresh={refresh}
            onOpen={(email) => { setSelected(email); setView('detail'); }}
            starred={starred}
            onToggleStar={toggleStar}
          />
        )}

        {view === 'detail' && selected && (
          <EmailDetail
            email={selected}
            user={user}
            onBack={() => setView('inbox')}
            starred={starred.has(selected.id)}
            onToggleStar={() => toggleStar(selected.id)}
          />
        )}

        {view === 'compose' && (
          <ComposeView
            user={user}
            onBack={() => setView('inbox')}
            onSent={() => { refresh(); setView('inbox'); }}
          />
        )}
      </main>
    </div>
  );
};

export function App() {
  const googleClientId = '1000000000000-dummygoogleclientid.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <Workspace />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
