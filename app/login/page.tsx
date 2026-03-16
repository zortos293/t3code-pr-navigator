import { ShieldCheck, Sparkles, GitPullRequest, CircleDot } from 'lucide-react';
import { redirect } from 'next/navigation';
import ThemeToggle from '@/app/components/ThemeToggle';
import LoginForm from '@/app/components/LoginForm';
import { isAuthenticated } from '@/app/lib/auth';

const loginHighlights = [
  {
    title: 'Sync on demand',
    description: 'Pull fresh issues and PRs without exposing your GitHub-powered workspace.',
    icon: CircleDot,
  },
  {
    title: 'AI analyze safely',
    description: 'Keep OpenCode-backed analysis behind a simple deployment password gate.',
    icon: Sparkles,
  },
  {
    title: 'Destructive actions protected',
    description: 'Deletes and relationship edits stay private until you unlock the board.',
    icon: GitPullRequest,
  },
];

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect('/');
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b11] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.18),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,0.06)_1px,_transparent_1px)] bg-[length:auto,auto,28px_28px] opacity-80" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-300/10 to-transparent" />

      <div className="relative flex min-h-screen flex-col px-6 py-6 sm:px-10">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center">
          <div className="grid w-full gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
            <section className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-emerald-200/85 backdrop-blur">
                <ShieldCheck size={14} />
                Private deployment access
              </div>

              <div className="space-y-6">
                <p
                  className="max-w-xl text-[13px] uppercase tracking-[0.35em] text-white/45"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace' }}
                >
                  T3code PR Navigator
                </p>
                <div className="space-y-4">
                  <h1
                    className="max-w-3xl text-5xl leading-none text-white sm:text-6xl lg:text-7xl"
                    style={{ fontFamily: 'Iowan Old Style, Palatino Linotype, Book Antiqua, Palatino, Georgia, serif' }}
                  >
                    Lock the board, then move with confidence.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                    Your sync, AI analysis, and delete flows now sit behind a dedicated login screen designed for
                    lightweight deployment protection.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {loginHighlights.map(({ title, description, icon: Icon }) => (
                  <article
                    key={title}
                    className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"
                  >
                    <div className="mb-4 inline-flex rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-200">
                      <Icon size={18} />
                    </div>
                    <h2 className="text-sm font-semibold text-white">{title}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-emerald-300/20 via-transparent to-blue-400/10 blur-2xl" />
              <div className="relative rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-7 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-8">
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.32em] text-white/45">Access gate</p>
                    <h2
                      className="mt-3 text-3xl text-white"
                      style={{ fontFamily: 'Iowan Old Style, Palatino Linotype, Book Antiqua, Palatino, Georgia, serif' }}
                    >
                      Enter the deployment password
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-emerald-200">
                    <ShieldCheck size={22} />
                  </div>
                </div>

                <p className="mb-6 text-sm leading-6 text-white/60">
                  A successful login creates an HttpOnly session cookie so the protected repo APIs stay locked until
                  you explicitly sign out.
                </p>

                <LoginForm />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
