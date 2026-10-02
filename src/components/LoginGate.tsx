import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, User, Eye, EyeOff, LogIn } from 'lucide-react';
import { SSCLogo } from './SSCLogo';

const VALID_USERNAME = 'SSCPRIMARY';
const VALID_PASSWORD = '1774700';
const SESSION_KEY = 'ssc_auth_ok';
const ACTIVITY_KEY = 'ssc_last_activity';
const IDLE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes of no use -> ask for login again

function readSession(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY) !== '1') return false;
    const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0);
    return last > 0 && Date.now() - last < IDLE_LIMIT_MS;
  } catch {
    return false;
  }
}

function touchActivity() {
  try {
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {}
}

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(readSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [everAuthed, setEverAuthed] = useState<boolean>(authed);
  const [timedOut, setTimedOut] = useState(false);
  const lastActivity = useRef<number>(Date.now());

  const lock = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(ACTIVITY_KEY);
    } catch {}
    setUsername('');
    setPassword('');
    setError(null);
    setTimedOut(true);
    setAuthed(false);
  }, []);

  // Auto-lock after 5 minutes without any mouse / keyboard / touch / scroll activity
  useEffect(() => {
    if (!authed) return;
    lastActivity.current = Date.now();
    touchActivity();

    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      lastActivity.current = now;
      if (now - lastWrite > 5000) {
        lastWrite = now;
        touchActivity();
      }
    };
    const check = () => {
      if (Date.now() - lastActivity.current >= IDLE_LIMIT_MS) lock();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 5000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity, { capture: true }));
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, [authed, lock]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === VALID_USERNAME && password === VALID_PASSWORD) {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {}
      touchActivity();
      setTimedOut(false);
      setEverAuthed(true);
      setAuthed(true);
      return;
    }
    setError('Incorrect username or password');
    setPassword('');
  };

  return (
    <>
    {/* Keep the app mounted while locked so entered data isn't lost, but fully covered */}
    {everAuthed && (
      <div
        style={
          authed
            ? { display: 'contents' }
            : { position: 'fixed', top: 0, left: '-10000px', width: '100vw', height: '100vh', overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' }
        }
        aria-hidden={!authed}
      >
        {children}
      </div>
    )}
    {!authed && (
    <div className="no-print min-h-screen flex items-center justify-center px-4 py-10 text-[#f4f7fb]">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white/6 border border-white/14 rounded-2xl backdrop-blur-xl p-7 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <SSCLogo className="w-16 h-16 mb-3" />
          <h1 className="text-lg font-bold font-heading text-white">Sri Sumangala College</h1>
          <p className="text-xs text-slate-300 mt-1">Grade 1 Distance Check · Staff Login</p>
        </div>

        {timedOut && (
          <div className="mb-4 text-xs text-amber-200 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
            Locked after 5 minutes of inactivity. Please sign in again.
          </div>
        )}

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                className="w-full bg-white/10 border border-white/15 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                placeholder="Username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="w-full bg-white/10 border border-white/15 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm rounded-lg py-2.5 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        </div>
      </form>
    </div>
    )}
    </>
  );
}
