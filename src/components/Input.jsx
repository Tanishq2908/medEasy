import { forwardRef } from 'react';
import { cn } from './Button'; 

export const Input = forwardRef(
  ({ className, type = 'text', label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-1 mt-3">
        {label && (
          <label className="text-sm font-medium leading-none text-[var(--text-main)] opacity-90">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-11 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm text-[var(--input-text)] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50 transition-all backdrop-blur-sm",
            error && "border-red-500/50 focus:ring-red-500 focus:border-red-500 bg-red-500/5",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-400 mt-1">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
