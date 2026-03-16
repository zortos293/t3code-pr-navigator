'use client';

import { useState } from 'react';
import { ArrowRight, LockKeyhole, Loader2 } from 'lucide-react';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to unlock PR Navigator');
      }

      window.location.assign('/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to unlock PR Navigator');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60"
        >
          Deployment Password
        </label>
        <div className="relative">
          <LockKeyhole
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300/70"
          />
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter access password"
            className="w-full rounded-2xl border border-white/12 bg-black/35 px-12 py-4 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:bg-black/45 focus:ring-2 focus:ring-emerald-300/20"
            disabled={loading}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || password.trim().length === 0}
        className="group flex w-full items-center justify-between rounded-2xl border border-emerald-300/20 bg-emerald-300/12 px-5 py-4 text-sm font-medium text-white transition hover:border-emerald-300/40 hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex items-center gap-3">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <LockKeyhole size={18} />}
          Unlock workspace
        </span>
        <ArrowRight
          size={18}
          className="transition group-hover:translate-x-1"
        />
      </button>
    </form>
  );
}
