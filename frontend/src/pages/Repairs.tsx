import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Wrench, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient } from '../lib/api';
import { useRealtimeRepairs } from '../hooks/useRealtimeRepairs';

interface RepairListItem {
  id: string;
  job_number: string;
  estimate: number;
  advance: number;
  balance: number;
  status: 'pending' | 'repairing' | 'ready' | 'delivered' | 'cancelled';
  delivery_date: string | null;
  created_at: string;
  device?: {
    brand: string;
    model: string;
    customer?: {
      name: string;
      phone: string;
    };
  };
  assigned_staff?: {
    id: string;
    name: string;
    staff_id: string | null;
  };
}

interface RepairsResponse {
  repairs: RepairListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function Repairs() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [newlyAssignedIds, setNewlyAssignedIds] = useState<string[]>([]);
  const { isConnected } = useRealtimeRepairs((newId) => {
    setNewlyAssignedIds((prev) => [...prev, newId]);
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);

    return () => clearTimeout(handler);
  }, [search]);

  // Fetch repairs using TanStack Query
  const { data, isLoading } = useQuery<RepairsResponse>({
    queryKey: ['repairs-list', debouncedSearch, status, page],
    queryFn: () => 
      apiClient.get(
        `/repairs?search=${debouncedSearch}&status=${status}&page=${page}&limit=8`
      )
  });

  const handleTabChange = (statusValue: string) => {
    setStatus(statusValue);
    setPage(1);
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    repairing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    ready: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    delivered: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20'
  };

  const statusDotColors: Record<string, string> = {
    pending: 'bg-amber-500',
    repairing: 'bg-blue-500',
    ready: 'bg-emerald-500',
    delivered: 'bg-slate-400',
    cancelled: 'bg-red-500'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" /> Repair Orders
            {isConnected && (
              <span className="flex items-center gap-1.5 ml-2 border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-black font-mono">Live</span>
              </span>
            )}
          </h2>
          <p className="text-muted-foreground text-sm">
            Track hardware tickets, status checkpoints, and balances.
          </p>
        </div>
        <Button onClick={() => navigate('/repairs/new')} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4.5 w-4.5" />
          <span>New Repair Order</span>
        </Button>
      </div>

      {/* Filter Tabs Navigation */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-1">
        {[
          { key: 'all', label: 'All Jobs' },
          { key: 'pending', label: 'Pending' },
          { key: 'repairing', label: 'Repairing' },
          { key: 'ready', label: 'Ready' },
          { key: 'delivered', label: 'Delivered' },
          { key: 'cancelled', label: 'Cancelled' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg border-b-2 transition-all ${
              status === tab.key
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Panel Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Job # or Customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/35 border-border/80 w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Content list Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Loading Repair Pipeline...
          </span>
        </div>
      ) : data?.repairs && data.repairs.length > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-4">
            {data.repairs.map((r) => (
              <Card
                key={r.id}
                onClick={() => navigate(`/repairs/${r.id}`)}
                className="cursor-pointer hover:border-primary/45 transition-all group"
              >
                <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  {/* Job ID / Device name */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-extrabold text-primary">{r.job_number}</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${statusColors[r.status] || ''}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDotColors[r.status] || 'bg-slate-400'}`} />
                        {r.status}
                      </span>
                      {newlyAssignedIds.includes(r.id) && (
                        <span className="inline-flex items-center rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/25 px-2 py-0.5 text-[10px] font-extrabold uppercase animate-pulse">
                          New Assignment
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-base text-white group-hover:text-primary transition-colors">
                      {r.device ? `${r.device.brand} ${r.device.model}` : 'Unknown Device'}
                    </h3>
                    <div className="text-xs text-muted-foreground">
                      Client: <span className="font-semibold text-foreground">{r.device?.customer?.name || 'Walk-In'}</span>
                      {r.assigned_staff && (
                        <>
                          <span className="mx-2">•</span>
                          Tech: <span className="font-semibold text-foreground">{r.assigned_staff.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Financial metrics & Pick-up Calendar */}
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Estimate</span>
                      <span className="font-bold text-white">${Number(r.estimate).toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Balance</span>
                      <span className={`font-bold ${r.balance > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        ${Number(r.balance).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-col border-l border-border/80 pl-6">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due Date
                      </span>
                      <span className="font-semibold text-white mt-0.5">
                        {r.delivery_date ? new Date(r.delivery_date).toLocaleDateString() : 'Unscheduled'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data.pagination.pages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Page {page} of {data.pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
                disabled={page === data.pagination.pages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 border border-border border-dashed rounded-xl bg-secondary/5">
          <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No repair tickets found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            There are no repair orders mapping to this filter set.
          </p>
        </div>
      )}
    </div>
  );
}
