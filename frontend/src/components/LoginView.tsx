import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import { displayName } from '../utils/format';

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = useGoogleLogin({
    scope: 'openid email profile',
    onSuccess: async (res) => {
      try {
        const profile = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${res.access_token}` }
        }).then((r) => r.json());
        await login({ email: profile.email, name: profile.name, avatar: profile.picture, googleId: profile.sub });
      } catch (err) {
        console.error('Failed to resolve Google profile:', err);
      }
    },
    onError: () => console.error('Google login failed')
  });

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await login({
        email,
        name: displayName(email),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`
      });
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] bg-white border border-line rounded-lg px-10 py-12">
        <h1 className="text-3xl font-bold text-ink-900 text-center mb-8">Login</h1>

        <button
          type="button"
          onClick={() => handleGoogle()}
          className="w-full flex items-center justify-center gap-3 bg-brand-100 hover:bg-brand-50 rounded-md py-3 text-sm font-medium text-ink-900 transition-colors"
        >
          <GoogleIcon />
          <span>Login with Google</span>
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-line flex-1" />
          <span className="text-xs text-ink-400">or sign up through email</span>
          <div className="h-px bg-line flex-1" />
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email ID"
            className="w-full bg-field rounded-md px-4 py-3 text-sm text-ink-900 placeholder-ink-400 outline-none focus:ring-1 focus:ring-brand-500 transition-shadow"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-field rounded-md px-4 py-3 text-sm text-ink-900 placeholder-ink-400 outline-none focus:ring-1 focus:ring-brand-500 transition-shadow"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 rounded-md py-3 text-sm font-medium text-white transition-colors disabled:opacity-60 mt-3"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};
