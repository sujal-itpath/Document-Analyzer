'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, FileText, LockKeyhole, MessageCircle, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/20">
              <Bot size={22} />
            </span>
            <span className="text-sm font-black uppercase tracking-widest">DocuMind</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-black text-white shadow-lg shadow-accent/20 transition-transform active:scale-95"
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_520px]">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-accent">AI document workspace</p>
          <h1 className="text-5xl font-black leading-tight tracking-tight sm:text-6xl">
            Chat with your files after a secure sign in.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground">
            Upload reports, notes, and knowledge files into a private dashboard, then ask questions across your documents with context-aware answers.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAuthPrompt(true)}
              className="flex items-center gap-2 rounded-2xl bg-accent px-6 py-4 text-sm font-black text-white shadow-xl shadow-accent/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Upload size={18} />
              Upload File
            </button>
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-2xl border border-border px-6 py-4 text-sm font-black transition-colors hover:bg-muted"
            >
              Go to Login
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[460px] overflow-hidden rounded-[32px] border border-border bg-card p-6 shadow-2xl shadow-black/20">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-accent/20 to-transparent" />
          <div className="relative flex items-center justify-between border-b border-border pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Dashboard Preview</p>
              <h2 className="mt-1 text-xl font-black">Knowledge Base</h2>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-400">Secure</span>
          </div>

          <div className="relative mt-6 space-y-4">
            {['Q4_Report.pdf', 'Meeting_Notes.docx', 'Policy_Summary.md'].map((name, index) => (
              <div key={name} className="flex items-center gap-4 rounded-2xl border border-border bg-background/60 p-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <FileText size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{name}</p>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${80 - index * 18}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-6 rounded-3xl bg-muted/50 p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              <MessageCircle size={14} />
              Ask your documents
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              &quot;Summarize the main risks and show the supporting source files.&quot;
            </p>
          </div>
        </div>
      </section>

      {showAuthPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <LockKeyhole size={20} />
                </span>
                <div>
                  <h2 className="text-lg font-black">Login required</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Please login or create an account before uploading files.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuthPrompt(false)}
                className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close login prompt"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/login"
                className="flex items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-black text-white"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="flex items-center justify-center rounded-2xl border border-border px-4 py-3 text-sm font-black transition-colors hover:bg-muted"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
