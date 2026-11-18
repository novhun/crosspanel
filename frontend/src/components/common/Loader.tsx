import React from 'react';

export const Loader: React.FC<{ text?: string; size?: 'sm' | 'md' | 'lg' }> = ({ text = 'Loading...', size = 'md' }) => {
  const sizeMap = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <div className={`animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500 ${sizeMap[size]}`} />
      {text && <p className="text-xs text-slate-400 font-mono tracking-wide">{text}</p>}
    </div>
  );
};
