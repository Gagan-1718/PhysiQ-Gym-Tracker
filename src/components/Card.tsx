import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
}

export function Card({ title, subtitle, badge, children, className = '', ...props }: CardProps) {
  return (
    <div 
      className={`bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-sm hover:border-slate-700/80 transition-all ${className}`}
      {...props}
    >
      {(title || subtitle || badge) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {badge && (
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {badge}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
