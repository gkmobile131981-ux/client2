import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Wrench, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Loader2,
  Check,
  Phone,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  status: 'pending' | 'repairing' | 'ready' | 'delivered' | 'delivered_pending_balance' | 'cancelled';
  delivery_date: string | null;
  created_at: string;
  device?: {
    brand: string;
    model: string;
    front_photo_url?: string | null;
    back_photo_url?: string | null;
    problem?: string | null;
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
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [searchByPhone, setSearchByPhone] = useState(false);
  const [searchByImei, setSearchByImei] = useState(false);

  const [newlyAssignedIds, setNewlyAssignedIds] = useState<string[]>([]);
  const handleNewAssignment = useCallback((newId: string) => {
    setNewlyAssignedIds((prev) => [...prev, newId]);
  }, []);

  const { isConnected } = useRealtimeRepairs(handleNewAssignment);

  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/repairs/${id}`),
    onSuccess: () => {
      toast.success('Repair order permanently deleted. Next booking token sequence updated.');
      queryClient.invalidateQueries({ queryKey: ['repairs-list'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete repair order');
    }
  });

  const handleDelete = (e: React.MouseEvent, id: string, jobNumber: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to permanently delete repair order ${jobNumber}? This will remove the record and reuse token sequence for future creations.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleDownloadInvoice = async (e: React.MouseEvent, id: string, jobNumber: string) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('gk_access_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/repairs/${id}/receipt?download=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (!response.ok) throw new Error('Receipt generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${jobNumber}-receipt.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice download started');
    } catch (err: any) {
      toast.error(err.message || 'Could not download invoice');
    }
  };

  const handleCall = (e: React.MouseEvent, phoneNum: string) => {
    e.stopPropagation();
    if (!phoneNum) {
      toast.error('No phone number registered for this customer');
      return;
    }
    window.location.href = `tel:${phoneNum}`;
  };

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
    queryKey: ['repairs-list', debouncedSearch, status, page, searchByPhone, searchByImei],
    queryFn: () => 
      apiClient.get(
        `/repairs?search=${debouncedSearch}&status=${status}&page=${page}&limit=8&searchByPhone=${searchByPhone}&searchByIMEI=${searchByImei}`
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
    delivered_pending_balance: 'bg-orange-500/20 text-orange-400 border-orange-500/40 font-bold',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20'
  };

  const statusLabels: Record<string, string> = {
    pending: 'ORDERED',
    repairing: 'REPAIRING',
    ready: 'REPAIRED',
    delivered: 'DELIVERED',
    delivered_pending_balance: 'DELIVERED (UNPAID)',
    cancelled: 'CANCELLED'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border/60 pb-5">
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

        {/* Search Input, contains checkboxes, and create button inline */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 lg:flex-1 lg:justify-end max-w-3xl w-full">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/35 border-border/80 w-full"
            />
          </div>

          <div className="flex items-center gap-3.5 text-xs font-semibold text-muted-foreground select-none shrink-0">
            <span className="text-foreground">Contains:</span>
            <label htmlFor="searchByPhone" className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
              <input 
                id="searchByPhone"
                type="checkbox" 
                checked={searchByPhone} 
                onChange={(e) => setSearchByPhone(e.target.checked)}
                className="rounded border-border bg-secondary/30 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
              />
              <span>Phone</span>
            </label>
            <label htmlFor="searchByImei" className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
              <input 
                id="searchByImei"
                type="checkbox" 
                checked={searchByImei} 
                onChange={(e) => setSearchByImei(e.target.checked)}
                className="rounded border-border bg-secondary/30 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
              />
              <span>IMEI</span>
            </label>
          </div>

          <Button onClick={() => navigate('/repairs/new')} className="gap-2 shrink-0">
            <Plus className="h-4.5 w-4.5" />
            <span>New Repair Order</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs Navigation */}
      <div className="flex flex-wrap gap-2.5 border-b border-border/40 pb-3 select-none">
        {[
          { key: 'all', label: 'All Jobs' },
          { key: 'pending', label: 'Ordered' },
          { key: 'repairing', label: 'Repairing' },
          { key: 'ready', label: 'Repaired' },
          { key: 'delivered', label: 'Delivered' },
          { key: 'balance_due', label: 'Balance Due ⚠️' },
          { key: 'cancelled', label: 'Cancelled' }
        ].map((tab) => {
          const isActive = status === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full border transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-white text-black border-white shadow-sm shadow-white/5'
                  : 'bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              {isActive && (
                <span className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center border border-emerald-500/10">
                  <Check className="h-3 w-3 text-white stroke-[3.5px]" />
                </span>
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content list Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Loading Repair Pipeline...
          </span>
        </div>
      ) : data?.repairs && data.repairs.length > 0 ? (
        <div className="space-y-3">
          {data.repairs.map((r) => {
            const hasPendingBalance = Number(r.balance ?? 0) > 0;
            return (
              <Card
                key={r.id}
                onClick={() => navigate(`/repairs/${r.id}`)}
                className={`relative bg-card/90 border rounded-xl hover:border-primary/45 transition-all cursor-pointer ${
                  hasPendingBalance ? 'border-orange-500/40 bg-orange-950/10' : 'border-border/70'
                }`}
              >
                <div className="flex flex-col gap-2 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-lg border border-border/60 bg-secondary/35 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {r.device?.front_photo_url ? (
                          <img src={r.device.front_photo_url} alt="device front" className="w-full h-full object-cover" />
                        ) : r.device?.back_photo_url ? (
                          <img src={r.device.back_photo_url} alt="device back" className="w-full h-full object-cover" />
                        ) : (
                          <Wrench className="h-5 w-5 text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground truncate">{r.device?.customer?.name || 'Walk-In'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${statusColors[r.status] || 'bg-secondary/20 text-muted-foreground border-border'}`}>
                            {statusLabels[r.status] || r.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-primary font-bold">{r.job_number}</span>
                          <span>•</span>
                          <span>{r.device ? `${r.device.brand} ${r.device.model}` : 'Unknown Device'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.device?.problem || 'No problem description'}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-white">
                          <span className="rounded-full bg-slate-800/70 px-2 py-1">Advance ₹{Number(r.advance ?? 0).toFixed(2)}</span>
                          <span className={`rounded-full px-2 py-1 ${hasPendingBalance ? 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/40' : 'bg-slate-800/70'}`}>
                            Balance ₹{Number(r.balance ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-foreground">₹{Number(r.estimate).toFixed(2)}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, r.id, r.job_number)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                        aria-label={`Delete ${r.job_number}`}
                        title="Delete repair order"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Pending Balance Contact Follow-Up Bar */}
                  {hasPendingBalance && (
                    <div className="mt-1 pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-orange-400">
                        <span>⚠️ Outstanding Balance:</span>
                        <span className="font-mono text-white">₹{Number(r.balance).toFixed(2)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {r.device?.customer?.phone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cleanPhone = (r.device?.customer?.phone || '').replace(/\D/g, '');
                              const text = encodeURIComponent(
                                `Hello ${r.device?.customer?.name || 'Customer'}, your repair order ${r.job_number} for ${r.device?.brand || ''} ${r.device?.model || ''} has an unpaid balance of ₹${Number(r.balance).toFixed(2)}. Please remit the payment at your earliest convenience. Thank you, GK Mobile Service.`
                              );
                              window.open(`https://wa.me/91${cleanPhone}?text=${text}`, '_blank');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold uppercase flex items-center gap-1 transition-all shadow-sm"
                            title="Send WhatsApp Payment Reminder"
                          >
                            <span>💬 WhatsApp Reminder</span>
                          </button>
                        )}
                        {r.device?.customer?.phone && (
                          <button
                            type="button"
                            onClick={(e) => handleCall(e, r.device?.customer?.phone || '')}
                            className="px-2 py-1 rounded-lg bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-[10px] font-extrabold uppercase flex items-center gap-1 transition-all shadow-sm"
                            title="Call Customer"
                          >
                            <Phone className="h-3 w-3" />
                            <span>Call</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

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
