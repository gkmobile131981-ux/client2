import React from 'react';

export type RepairStatus = 'pending' | 'repairing' | 'ready' | 'delivered' | 'cancelled';

interface RepairStatusBadgeProps {
  status: RepairStatus;
}

export const statusColors: Record<RepairStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  repairing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ready: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  delivered: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20'
};

export const statusDotColors: Record<RepairStatus, string> = {
  pending: 'bg-amber-500',
  repairing: 'bg-blue-500',
  ready: 'bg-emerald-500',
  delivered: 'bg-slate-400',
  cancelled: 'bg-red-500'
};

export default function RepairStatusBadge({ status }: RepairStatusBadgeProps) {
  const normalizedStatus = (status || 'pending').toLowerCase() as RepairStatus;
  
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
        statusColors[normalizedStatus] || 'bg-secondary text-muted-foreground border-border/40'
      }`}
      data-testid="status-badge"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          statusDotColors[normalizedStatus] || 'bg-slate-400'
        }`}
        data-testid="status-badge-dot"
      />
      {status}
    </span>
  );
}
