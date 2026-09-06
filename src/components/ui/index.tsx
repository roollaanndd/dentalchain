/**
 * The design system.
 *
 * Burgundy heritage-modern: deep wine, warm cream, brass hairlines, a serif
 * display face against a clean sans. Everything here is theme-token driven —
 * no component hard-codes a hex value that isn't in index.css.
 */

import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Check, AlertCircle, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

// ── Brand mark ──────────────────────────────────────────────────────────

export function Logo({ size = 40, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* An arch — the architectural gesture the whole brand rests on. */}
      <path
        d="M8 44V22a16 16 0 0 1 32 0v22"
        stroke={mono ? 'currentColor' : 'var(--color-wine-700)'}
        strokeWidth="3.5" strokeLinecap="round"
      />
      <path
        d="M18 44V26a6 6 0 0 1 12 0v18"
        stroke={mono ? 'currentColor' : 'var(--color-brass-500)'}
        strokeWidth="3" strokeLinecap="round"
      />
      <circle cx="24" cy="13" r="2.6" fill={mono ? 'currentColor' : 'var(--color-brass-500)'} />
    </svg>
  );
}

export function Wordmark({ className, invert = false }: { className?: string; invert?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Logo size={30} mono={invert} />
      <span className="leading-none">
        <span
          className="block font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-tight"
          style={{ color: invert ? 'var(--color-cream-100)' : 'var(--color-wine-800)' }}
        >
          Burgundy
        </span>
        <span
          className="block text-[9.5px] font-medium uppercase tracking-[0.22em]"
          style={{ color: invert ? 'var(--color-brass-300)' : 'var(--color-brass-500)' }}
        >
          Residences
        </span>
      </span>
    </span>
  );
}

// ── Button ──────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brass';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-btn)] ' +
  'transition-all duration-200 select-none whitespace-nowrap ' +
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none ' +
  'active:translate-y-px';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-wine-700 text-cream-50 shadow-[var(--shadow-soft)] ' +
    'hover:bg-wine-800 hover:shadow-[var(--shadow-lift)] disabled:hover:bg-wine-700',
  secondary:
    'bg-cream-50 text-wine-800 border border-cream-300 ' +
    'hover:border-wine-300 hover:bg-wine-50',
  ghost: 'text-ink-700 hover:bg-cream-200 hover:text-wine-800',
  danger: 'bg-bad-600 text-white hover:brightness-110 shadow-[var(--shadow-soft)]',
  brass:
    'bg-brass-500 text-white shadow-[var(--shadow-soft)] hover:bg-brass-600 hover:shadow-[var(--shadow-lift)]',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'text-[13px] px-3 h-9',
  md: 'text-sm px-4 h-11',
  lg: 'text-[15px] px-6 h-13',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary', size = 'md', loading, block, icon, children, className, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], block && 'w-full', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────

export function Card({
  children, className, padded = true, hover = false, as: As = 'div',
}: {
  children: ReactNode; className?: string; padded?: boolean; hover?: boolean;
  as?: 'div' | 'article' | 'section' | 'li';
}) {
  return (
    <As
      className={cn(
        'bg-cream-50 border border-cream-300 rounded-[var(--radius-card)]',
        'shadow-[var(--shadow-soft)]',
        hover && 'transition-all duration-300 hover:shadow-[var(--shadow-lift)] hover:border-wine-200 hover:-translate-y-0.5',
        padded && 'p-5',
        className,
      )}
    >
      {children}
    </As>
  );
}

/** The section heading used across all three surfaces. */
export function SectionTitle({
  eyebrow, title, subtitle, align = 'left', invert = false,
}: {
  eyebrow?: string; title: string; subtitle?: string;
  align?: 'left' | 'center'; invert?: boolean;
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow && (
        <div
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: invert ? 'var(--color-brass-300)' : 'var(--color-brass-500)' }}
        >
          {eyebrow}
        </div>
      )}
      <h2
        className="text-[clamp(1.6rem,3.4vw,2.5rem)]"
        style={{ color: invert ? 'var(--color-cream-100)' : 'var(--color-wine-900)' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-3 text-[15px] leading-relaxed"
          style={{ color: invert ? 'rgba(251,247,242,0.72)' : 'var(--color-ink-500)' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────

export type BadgeTone = 'wine' | 'brass' | 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'sage';

const BADGE_TONES: Record<BadgeTone, string> = {
  wine: 'bg-wine-100 text-wine-800',
  brass: 'bg-brass-100 text-brass-600',
  ok: 'bg-ok-100 text-ok-600',
  warn: 'bg-warn-100 text-warn-600',
  bad: 'bg-bad-100 text-bad-600',
  info: 'bg-info-100 text-info-600',
  sage: 'bg-sage-100 text-sage-700',
  neutral: 'bg-cream-200 text-ink-500',
};

export function Badge({
  children, tone = 'neutral', className, dot = false,
}: { children: ReactNode; tone?: BadgeTone; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-[11px] font-semibold leading-none whitespace-nowrap',
        BADGE_TONES[tone], className,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

// ── Form fields ─────────────────────────────────────────────────────────

const FIELD_BASE =
  'w-full rounded-[var(--radius-field)] border bg-cream-50 px-3.5 text-[15px] ' +
  'transition-colors placeholder:text-ink-400 ' +
  'focus:outline-none focus:border-wine-600 focus:ring-2 focus:ring-wine-600/15 ' +
  'disabled:bg-cream-200 disabled:text-ink-400 disabled:cursor-not-allowed';

function fieldBorder(error?: string) {
  return error ? 'border-bad-600' : 'border-cream-300';
}

export function Field({
  label, error, hint, required, children, htmlFor,
}: {
  label?: string; error?: string; hint?: string; required?: boolean;
  children: ReactNode; htmlFor?: string;
}) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-bad-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-bad-600">
          <AlertCircle size={13} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string; error?: string; hint?: string; prefix?: ReactNode;
}

export function Input({ label, error, hint, prefix, className, id, required, ...rest }: InputProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
            {prefix}
          </span>
        )}
        <input
          id={fieldId}
          aria-invalid={!!error}
          className={cn(FIELD_BASE, fieldBorder(error), 'h-11', prefix ? 'pl-10' : null, className)}
          {...rest}
        />
      </div>
    </Field>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string; hint?: string;
}

export function Textarea({ label, error, hint, className, id, required, rows = 4, ...rest }: TextareaProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
      <textarea
        id={fieldId} rows={rows} aria-invalid={!!error}
        className={cn(FIELD_BASE, fieldBorder(error), 'py-2.5 resize-y leading-relaxed', className)}
        {...rest}
      />
    </Field>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string; hint?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export function Select({
  label, error, hint, options, placeholder, className, id, required, ...rest
}: SelectProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
      <div className="relative">
        <select
          id={fieldId} aria-invalid={!!error}
          className={cn(FIELD_BASE, fieldBorder(error), 'h-11 appearance-none pr-10', className)}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400"
        />
      </div>
    </Field>
  );
}

export function Checkbox({
  label, description, checked, onChange, disabled,
}: {
  label: string; description?: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className={cn('flex gap-3 cursor-pointer group', disabled && 'opacity-50 cursor-not-allowed')}>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox" checked={checked} disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            'flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2 transition-all',
            checked ? 'border-wine-700 bg-wine-700' : 'border-cream-300 bg-cream-50 group-hover:border-wine-300',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-wine-600/30 peer-focus-visible:ring-offset-1',
          )}
        >
          {checked && <Check size={12} strokeWidth={3.5} className="text-cream-50" />}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink-900">{label}</span>
        {description && <span className="mt-0.5 block text-[12.5px] text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

/** Segmented control — used for status filters throughout the admin. */
export function Segmented<T extends string>({
  value, onChange, options, size = 'md',
}: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex gap-1 rounded-[var(--radius-btn)] border border-cream-300 bg-cream-200/60 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              'rounded-[8px] font-medium transition-all whitespace-nowrap',
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]',
              active
                ? 'bg-cream-50 text-wine-800 shadow-[var(--shadow-soft)]'
                : 'text-ink-500 hover:text-wine-700',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('ml-1.5 tabular', active ? 'text-brass-500' : 'text-ink-400')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────

export function Modal({
  open, onClose, title, description, children, footer, size = 'md',
}: {
  open: boolean; onClose: () => void; title: string; description?: string;
  children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close, and lock the page behind the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog so keyboard users aren't left behind it.
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button:not([data-close])',
      )?.focus();
    }, 60);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-wine-950/45 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full bg-cream-100 shadow-[var(--shadow-deep)]',
          'rounded-t-[24px] sm:rounded-[var(--radius-card)]',
          'max-h-[92vh] flex flex-col animate-[reveal-up_0.3s_cubic-bezier(0.22,1,0.36,1)]',
          size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-cream-300 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[19px] text-wine-900">{title}</h3>
            {description && <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{description}</p>}
          </div>
          <button
            type="button" onClick={onClose} data-close aria-label="Tutup"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-cream-200 hover:text-wine-800"
          >
            <X size={19} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-cream-300 bg-cream-200/40 px-5 py-3.5 pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmation prompt for destructive or irreversible actions. */
export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = 'Ya, lanjutkan', danger = true,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Modal
      open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[14.5px] leading-relaxed text-ink-700">{message}</p>
    </Modal>
  );
}

// ── Feedback ────────────────────────────────────────────────────────────

export function EmptyState({
  icon, title, message, action,
}: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-200 text-wine-400">
          {icon}
        </div>
      )}
      <h3 className="text-[17px] text-wine-900">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-cream-200', className)}>
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite]"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }}
      />
    </div>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-wine-600" />;
}

const TOAST_ICON = {
  success: <CheckCircle2 size={17} />,
  error: <AlertCircle size={17} />,
  info: <Info size={17} />,
} as const;

const TOAST_TONE = {
  success: 'bg-ok-100 text-ok-600 border-ok-600/25',
  error: 'bg-bad-100 text-bad-600 border-bad-600/25',
  info: 'bg-info-100 text-info-600 border-info-600/25',
} as const;

export function ToastStack({
  toasts, onDismiss,
}: {
  toasts: { id: string; kind: 'success' | 'error' | 'info'; message: string }[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;
  return createPortal(
    <div
      /* Lifted clear of the resident app's bottom navigation on small screens. */
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:items-end sm:px-6 sm:pb-6"
      role="status" aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-[var(--radius-btn)]',
            'border px-4 py-3 shadow-[var(--shadow-lift)] backdrop-blur-sm',
            'animate-[reveal-up_0.3s_cubic-bezier(0.22,1,0.36,1)]',
            TOAST_TONE[t.kind],
          )}
        >
          <span className="mt-px shrink-0">{TOAST_ICON[t.kind]}</span>
          <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug">{t.message}</span>
          <button
            type="button" onClick={() => onDismiss(t.id)} aria-label="Tutup"
            className="-mr-1 shrink-0 opacity-50 transition-opacity hover:opacity-100"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ── Stat tile ───────────────────────────────────────────────────────────

export function Stat({
  label, value, sub, tone = 'wine', icon, onClick,
}: {
  label: string; value: ReactNode; sub?: string;
  tone?: 'wine' | 'brass' | 'ok' | 'warn' | 'bad' | 'sage';
  icon?: ReactNode; onClick?: () => void;
}) {
  const accent = {
    wine: 'var(--color-wine-700)', brass: 'var(--color-brass-500)',
    ok: 'var(--color-ok-600)', warn: 'var(--color-warn-600)',
    bad: 'var(--color-bad-600)', sage: 'var(--color-sage-500)',
  }[tone];

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-card)] border border-cream-300',
        'bg-cream-50 p-4 text-left shadow-[var(--shadow-soft)]',
        onClick && 'transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]',
      )}
    >
      {/* The brass keyline that ties the tiles into one family. */}
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent, opacity: 0.85 }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">{label}</div>
          <div className="tabular mt-1.5 font-[family-name:var(--font-display)] text-[26px] font-semibold leading-none" style={{ color: accent }}>
            {value}
          </div>
          {sub && <div className="mt-1.5 text-[12px] leading-snug text-ink-500">{sub}</div>}
        </div>
        {icon && <span className="shrink-0 opacity-25" style={{ color: accent }}>{icon}</span>}
      </div>
    </Tag>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────

const TabsCtx = createContext<{ value: string; set: (v: string) => void } | null>(null);

export function Tabs({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  const set = useCallback((v: string) => onChange(v), [onChange]);
  return <TabsCtx.Provider value={{ value, set }}>{children}</TabsCtx.Provider>;
}

export function TabList({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-cream-300" role="tablist">
      {children}
    </div>
  );
}

export function Tab({ id, children, count }: { id: string; children: ReactNode; count?: number }) {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('<Tab> must be inside <Tabs>');
  const active = ctx.value === id;
  return (
    <button
      type="button" role="tab" aria-selected={active}
      onClick={() => ctx.set(id)}
      className={cn(
        'relative whitespace-nowrap px-4 py-2.5 text-[13.5px] font-medium transition-colors',
        active ? 'text-wine-800' : 'text-ink-500 hover:text-wine-700',
      )}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={cn('ml-1.5 tabular text-[12px]', active ? 'text-brass-500' : 'text-ink-400')}>
          {count}
        </span>
      )}
      {active && <span className="absolute inset-x-2 -bottom-px h-[2.5px] rounded-full bg-wine-700" />}
    </button>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx);
  if (!ctx || ctx.value !== id) return null;
  return <div role="tabpanel" className="pt-5">{children}</div>;
}

// ── Reveal on scroll ────────────────────────────────────────────────────

/**
 * Adds `is-visible` when an element scrolls into view, which triggers the
 * reveal animation defined in index.css. Respects prefers-reduced-motion by
 * revealing everything immediately.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nodes = el.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!nodes.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const target = e.target as HTMLElement;
          const delay = Number(target.dataset.revealDelay ?? 0);
          window.setTimeout(() => target.classList.add('is-visible'), delay);
          io.unobserve(target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

// ── Misc ────────────────────────────────────────────────────────────────

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const label = parts.length
    ? (parts.length === 1 ? parts[0]!.slice(0, 2) : parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
    : '?';
  if (url) {
    return (
      <img
        src={url} alt={name} width={size} height={size}
        className="shrink-0 rounded-full border border-cream-300 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-wine-100 font-semibold text-wine-700"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {label}
    </span>
  );
}

/** Horizontal brass hairline used to separate major blocks. */
export function Rule({ className }: { className?: string }) {
  return <div className={cn('rule-brass my-6', className)} />;
}

export function Progress({ value, tone = 'wine' }: { value: number; tone?: 'wine' | 'ok' | 'warn' }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = {
    wine: 'var(--color-wine-600)', ok: 'var(--color-ok-600)', warn: 'var(--color-warn-600)',
  }[tone];
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-cream-300"
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/** Copy-to-clipboard for booking codes. Falls back gracefully. */
export function CopyButton({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked — the code is on screen anyway */
        }
      }}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-wine-600 transition-colors hover:text-wine-800"
    >
      {done ? <Check size={13} /> : null}
      {done ? 'Tersalin' : label}
    </button>
  );
}
