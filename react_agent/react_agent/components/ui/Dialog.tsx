'use client';
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Trash2, Info, CheckCircle, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DialogVariant = 'danger' | 'warning' | 'info' | 'success';

export interface DialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  variant?: DialogVariant;
}

interface DialogState extends DialogOptions {
  resolve: (value: boolean) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface DialogContextValue {
  openDialog: (options: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// ── Variant config ────────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<DialogVariant, {
  icon: React.ReactNode;
  iconBg: string;
  confirmBtn: string;
}> = {
  danger: {
    icon: <Trash2 size={22} />,
    iconBg: 'bg-red-500/10 text-red-500',
    confirmBtn: 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25',
  },
  warning: {
    icon: <AlertTriangle size={22} />,
    iconBg: 'bg-amber-500/10 text-amber-500',
    confirmBtn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25',
  },
  info: {
    icon: <Info size={22} />,
    iconBg: 'bg-accent/10 text-accent',
    confirmBtn: 'bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/25',
  },
  success: {
    icon: <CheckCircle size={22} />,
    iconBg: 'bg-emerald-500/10 text-emerald-500',
    confirmBtn: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25',
  },
};

// ── Provider ──────────────────────────────────────────────────────────────────

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const openDialog = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialog({ ...options, resolve });
      // Tiny delay so the DOM mounts before we trigger the animation
      requestAnimationFrame(() => setIsVisible(true));
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setIsVisible(false);
    // Wait for exit animation before clearing state
    setTimeout(() => {
      dialog?.resolve(result);
      setDialog(null);
    }, 200);
  }, [dialog]);

  const variant = dialog?.variant ?? 'info';
  const config = VARIANT_CONFIG[variant];

  return (
    <DialogContext.Provider value={{ openDialog }}>
      {children}

      {/* ── Modal ── */}
      {dialog && (
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-200 ${
            isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => close(false)}
          />

          {/* Panel */}
          <div
            className={`relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl shadow-black/40 p-6 flex flex-col gap-5 transition-all duration-200 ${
              isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-2'
            }`}
          >
            {/* Close button */}
            <button
              onClick={() => close(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>

            {/* Icon + Title */}
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
                {config.icon}
              </div>
              <h2 className="text-lg font-black leading-tight pr-6">{dialog.title}</h2>
            </div>

            {/* Message */}
            <p className="text-sm text-muted-foreground leading-relaxed">{dialog.message}</p>

            {/* Buttons */}
            <div className="flex gap-3 justify-end pt-1">
              {dialog.cancelLabel !== null && (
                <button
                  onClick={() => close(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  {dialog.cancelLabel ?? 'Cancel'}
                </button>
              )}
              <button
                onClick={() => close(true)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 ${config.confirmBtn}`}
              >
                {dialog.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');

  return {
    /** Shows a two-button dialog. Returns true if user confirmed. */
    confirm: (options: DialogOptions) => ctx.openDialog(options),

    /** Shows a single-button info/success dialog. */
    alert: (options: Omit<DialogOptions, 'cancelLabel'>) =>
      ctx.openDialog({ ...options, cancelLabel: null }),
  };
}
