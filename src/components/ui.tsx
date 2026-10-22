import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[#12325c] text-white hover:bg-[#0b1b33] active:bg-[#071324] shadow-xs focus-visible:outline-[#12325c] disabled:bg-slate-300 disabled:shadow-none",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 shadow-xs focus-visible:outline-slate-400",
  outline:
    "bg-transparent text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-slate-400",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 focus-visible:outline-slate-300",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-xs focus-visible:outline-rose-600 disabled:bg-rose-300",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-xs focus-visible:outline-emerald-600 disabled:bg-emerald-300",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5 rounded-lg",
  md: "px-3.5 py-2 text-sm gap-2 rounded-lg",
  lg: "px-4 py-2.5 text-base gap-2.5 rounded-xl font-semibold",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center font-medium transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs transition", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-slate-800">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label?: ReactNode;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label ? (
        <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-700">
          <span className="flex items-center gap-1">
            {label}
            {required ? <span className="text-rose-600 font-bold">*</span> : null}
          </span>
          {hint && !error ? <span className="text-[11px] font-normal text-slate-400">{hint}</span> : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}

const CONTROL =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-[#12325c] focus:ring-2 focus:ring-[#12325c]/15 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, "min-h-20 resize-y", className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(CONTROL, "appearance-none bg-white pr-8 cursor-pointer", className)}>
      {children}
    </select>
  );
}

const TONES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};

export function Badge({
  tone = "slate",
  children,
  className,
}: {
  tone?: keyof typeof TONES | string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap shadow-2xs",
        TONES[tone] ?? TONES.slate,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-slate-400">{icon}</div> : null}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="max-w-md text-xs text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description ? <div className="mt-1 text-sm text-slate-500">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

const STAT_TONES: Record<string, { text: string; bg: string; ring: string }> = {
  slate: { text: "text-slate-900", bg: "bg-slate-50", ring: "ring-slate-200" },
  blue: { text: "text-blue-700", bg: "bg-blue-50/50", ring: "ring-blue-100" },
  amber: { text: "text-amber-700", bg: "bg-amber-50/50", ring: "ring-amber-100" },
  green: { text: "text-emerald-700", bg: "bg-emerald-50/50", ring: "ring-emerald-100" },
  red: { text: "text-rose-700", bg: "bg-rose-50/50", ring: "ring-rose-100" },
};

export function StatTile({
  label,
  value,
  tone = "slate",
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  icon?: ReactNode;
}) {
  const t = STAT_TONES[tone] ?? STAT_TONES.slate;
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:shadow-sm")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-3xl font-bold tracking-tight", t.text)}>{value}</p>
    </div>
  );
}
