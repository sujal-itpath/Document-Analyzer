'use client';

import React, { useState } from 'react';
import { Bot, Mail, Lock, Loader2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiUrl } from '../../lib/api';
import ThemeToggle from '../../components/ThemeToggle';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl('/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Signup failed');
      }

      await response.json();
      router.push('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle className="border border-border bg-card/50 backdrop-blur-xl" />
      </div>

      <div className="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse [animation-delay:2s]"></div>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[28px] items-center justify-center shadow-2xl shadow-indigo-500/40 mb-6">
            <Bot size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-3">Create Account</h1>
          <p className="text-muted-foreground font-medium">Join the next generation of document AI</p>
        </div>

        <div className="bg-card border border-border p-8 rounded-[40px] shadow-2xl shadow-black/10 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={20} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-accent transition-all"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={20} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-accent transition-all"
                  placeholder="••••••••"
                  suppressHydrationWarning
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm font-bold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <>Get Started <UserPlus size={20} /></>}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-muted-foreground font-medium">
          Already have an account? <Link href="/login" className="text-indigo-500 font-black hover:underline underline-offset-4">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
