import Link from 'next/link';
import './globals.css';
import Navigation from './components/Navigation';
import AuthProvider from '../src/auth/AuthProvider';
import AuthButtons from '../src/components/AuthButtons';

const HERO_STATS = [
  { label: 'Active workstreams', value: '128' },
  { label: 'AI routed fixes', value: '64%' },
  { label: 'Live pro partners', value: '212' },
  { label: 'Avg. response', value: '4m' }
];

export const metadata = {
  title: 'Home Service Assistant',
  description: 'Commercial home services copilot for diagnostics, sourcing and professional routing'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#F5F7FB] text-slate-900 antialiased">
        <AuthProvider>
          <div className="flex min-h-screen bg-[#F5F7FB]">
            <Navigation />
            <div className="layout-shell flex-1 transition-all duration-300 lg:pl-72">
              <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-8 lg:px-12">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Secure sign in required for live data
                  </div>
                  <AuthButtons
                    variant="default"
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                  />
                </div>
                <header className="rounded-3xl bg-gradient-to-br from-[#0D47A1] via-[#1565C0] to-[#1E88E5] p-8 text-white shadow-2xl shadow-[#0D47A1]/30">
                  <p className="text-xs font-semibold uppercase tracking-[0.5em] text-white/70">Home Service Control</p>
                  <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Home Service Assistant</h1>
                      <p className="mt-3 max-w-2xl text-base text-white/80">
                        Diagnose issues, source compliant products, and dispatch trusted professionals from one Lawpath-inspired
                        SaaS experience.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href="/jobs"
                        className="inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#0D47A1] shadow-lg shadow-black/10 transition hover:-translate-y-0.5"
                      >
                        Review jobs
                      </Link>
                      <Link
                        href="/professional"
                        className="inline-flex items-center justify-center rounded-full border border-white/50 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        Invite professionals
                      </Link>
                    </div>
                  </div>
                  <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {HERO_STATS.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl border border-white/20 bg-white/10 p-4 text-white backdrop-blur"
                      >
                        <p className="text-2xl font-semibold">{stat.value}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-white/70">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </header>
                <main className="mt-10">{children}</main>
              </div>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
