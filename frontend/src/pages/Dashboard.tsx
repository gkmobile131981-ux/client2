import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Wrench, 
  Clock, 
  DollarSign, 
  AlertCircle, 
  RefreshCw,
  Plus,
  ArrowUpRight,
  ChevronRight,
  Loader2,
  TrendingUp,
  Smartphone,
  CheckCircle,
  Calendar,
  Search
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  CartesianGrid
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { Dialog } from '../components/ui/Dialog';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface DashboardData {
  todayStats: {
    newRepairs: number;
    delivered: number;
    revenueCollected: number;
    pendingDeliveries: number;
    totalOutstandingBalance: number;
  };
  repairsByStatus: {
    pending: number;
    repairing: number;
    ready: number;
    delivered: number;
    cancelled: number;
  };
  recentRepairs: any[];
  monthlyRevenue: { month: string; revenue: number; repairsCount: number }[];
  topDeviceBrands: { brand: string; count: number }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-neutral-950/95 border border-white/10 backdrop-blur-xl p-3.5 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.7)] border-t-primary/40 border-t-2">
        <p className="text-[10px] font-black text-white/60 mb-2 tracking-wider uppercase">{label}</p>
        <div className="space-y-2">
          {payload.map((item: any, idx: number) => {
            const isRevenue = item.name.toLowerCase().includes('revenue');
            const valueFormatted = isRevenue 
              ? `₹${Number(item.value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : item.value;
            return (
              <div key={idx} className="flex items-center justify-between gap-6 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill || item.color }} />
                  <span className="text-neutral-300 font-medium">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-white text-right">
                  {valueFormatted}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role: authRole, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingBilling, setSearchingBilling] = useState(false);

  const handleSearchBilling = async () => {
    const queryStr = searchQuery.trim();
    if (!queryStr) {
      toast.error('Please enter a billing/job number');
      return;
    }

    setSearchingBilling(true);
    try {
      const response = await apiClient.get<any>(`/repairs?search=${encodeURIComponent(queryStr)}&limit=10`);
      const repairs = response.repairs || [];
      
      if (repairs.length === 0) {
        toast.error(`No repairs found matching "${queryStr}"`);
      } else {
        const exactMatch = repairs.find((r: any) => r.job_number.toLowerCase() === queryStr.toLowerCase());
        if (exactMatch) {
          toast.success(`Found repair order ${exactMatch.job_number}`);
          navigate(`/repairs/${exactMatch.id}`);
        } else if (repairs.length === 1) {
          toast.success(`Found repair order ${repairs[0].job_number}`);
          navigate(`/repairs/${repairs[0].id}`);
        } else {
          toast.success(`Found ${repairs.length} potential matches`);
          navigate(`/repairs?search=${encodeURIComponent(queryStr)}`);
        }
      }
    } catch (err: any) {
      console.error('Billing number search failed:', err);
      toast.error(err.message || 'Error occurred while searching');
    } finally {
      setSearchingBilling(false);
    }
  };

  const superAdminEmails = [
    'gkmobile131981@gmail.com',
    'admin@gkrepair.com',
    'test@gkrepair.com'
  ];
  const isSuperAdmin = !!(user && ((user.role as string) === 'superadmin' || (user.email && superAdminEmails.includes(user.email.toLowerCase().trim()))));
  
  // Status update modal state
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  
  // Slide Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);

  const defaultSlides = [
    {
      title: "Boost Shop Operations & Pick-up Speed",
      description: "Utilize status filters to quickly identify device statuses. Proactively follow up on 'Ready' jobs to speed up customer collection and minimize workspace load.",
      color: "from-primary/25 to-secondary/15 border-primary/30",
      textColor: "text-primary",
      icon: <Clock className="h-6 w-6 text-primary" />,
      image_url: null
    },
    {
      title: "Original (OG) vs Copy (Ditto) Rates",
      description: "Double column service rates are live! Inform customers of warranty and performance differences between Original and Copy parts to secure higher satisfaction.",
      color: "from-emerald-500/20 to-secondary/15 border-emerald-500/25",
      textColor: "text-emerald-500",
      icon: <DollarSign className="h-6 w-6 text-emerald-400" />,
      image_url: null
    },
    {
      title: "Confirm Device Security & Signatures",
      description: "Protect client privacy. Make sure you lock the device with pattern patterns, complete KYC front/back images, and capture picker signatures on delivery.",
      color: "from-amber-500/20 to-secondary/15 border-amber-500/25",
      textColor: "text-amber-500",
      icon: <Wrench className="h-6 w-6 text-amber-500" />,
      image_url: null
    }
  ];

  const { data: responseData } = useQuery<any>({
    queryKey: ['carousel-slides'],
    queryFn: () => apiClient.get('/carousel'),
    staleTime: 5 * 60 * 1000
  });

  const dbSlides = responseData?.slides || [];
  const activeSlides = dbSlides.length > 0 ? dbSlides : defaultSlides;

  useEffect(() => {
    if (activeSlides.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [activeSlides.length]);

  // 1. Fetch dashboard stats with 5 min staleTime
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard-data'],
    queryFn: () => apiClient.get('/dashboard'),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Real-time Dashboard subscriptions
  useEffect(() => {
    if (!user || !user.shop_id) return;

    const shopId = user.shop_id;

    const channel = supabase
      .channel(`realtime:dashboard:${shopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'repairs',
          filter: `shop_id=eq.${shopId}`
        },
        async (payload: any) => {
          const { eventType, new: newRecord } = payload;

          if (eventType === 'INSERT') {
            // Optimistically increment Today's New Repairs in query cache
            queryClient.setQueryData(['dashboard-data'], (oldData: any) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                todayStats: {
                  ...oldData.todayStats,
                  newRepairs: (oldData.todayStats.newRepairs || 0) + 1
                },
                recentRepairs: [newRecord, ...(oldData.recentRepairs || [])].slice(0, 5)
              };
            });

            toast.success(`New repair order received: ${newRecord.job_number || 'GK-Repair'}`);
          }

          // Trigger a background refetch to recalculate aggregates, brand distributions, and lists accurately
          queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, queryClient]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['carousel-slides'] })
    ]);
    setRefreshing(false);
    toast.success('Dashboard metrics refreshed!');
  };

  // 2. Mutation to change status quickly
  const updateStatusMutation = useMutation({
    mutationFn: (payload: { status: string; notes?: string }) => 
      apiClient.put(`/repairs/${selectedRepairId}/status`, payload),
    onSuccess: () => {
      toast.success('Repair status updated!');
      setSelectedRepairId(null);
      setStatusNote('');
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update status');
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Loading Analytics Dashboard...
        </span>
      </div>
    );
  }

  const stats = data?.todayStats;
  const statusData = data?.repairsByStatus;
  const recentRepairs = data?.recentRepairs || [];
  const monthlyRevenue = data?.monthlyRevenue || [];
  const topDeviceBrands = data?.topDeviceBrands || [];

  // Pie chart data formatting
  const pieData = [
    { name: 'Pending', value: statusData?.pending || 0, color: '#f59e0b' },
    { name: 'Repairing', value: statusData?.repairing || 0, color: '#3b82f6' },
    { name: 'Ready', value: statusData?.ready || 0, color: '#10b981' },
    { name: 'Delivered', value: statusData?.delivered || 0, color: '#94a3b8' },
    { name: 'Cancelled', value: statusData?.cancelled || 0, color: '#ef4444' }
  ].filter(d => d.value > 0);

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20',
    repairing: 'bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20',
    ready: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20',
    delivered: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    cancelled: 'bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/20'
  };

  const statusDot: Record<string, string> = {
    pending: 'bg-amber-500',
    repairing: 'bg-blue-500',
    ready: 'bg-emerald-500',
    delivered: 'bg-slate-400',
    cancelled: 'bg-red-500'
  };

  const totalActiveRepairs = pieData.reduce((acc, curr) => acc + curr.value, 0);

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* Welcome & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-3xl font-black text-foreground tracking-tight">
              Shop Overview
            </h2>
            <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary-foreground bg-primary rounded-full uppercase shadow-[0_0_15px_rgba(168,85,247,0.35)]">
              {authRole}
            </span>
          </div>
          <p className="text-muted-foreground text-xs flex items-center gap-1.5 mt-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Real-time shop diagnostics &bull; {todayDate}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1.5 border-border/80 text-foreground bg-secondary/15 hover:bg-secondary/40"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button onClick={() => navigate('/repairs/new')} className="gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.25)] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]">
            <Plus className="h-4.5 w-4.5" />
            <span>New Ticket</span>
          </Button>
        </div>
      </div>

      {/* Slide Carousel Banner */}
      <div 
        style={activeSlides[currentSlide]?.image_url ? { 
          backgroundImage: `linear-gradient(to right, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.1) 100%), url(${activeSlides[currentSlide].image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : undefined}
        className={`relative overflow-hidden p-6 rounded-2xl border transition-all duration-500 shadow-md flex items-center gap-4 min-h-[140px] ${
          !activeSlides[currentSlide]?.image_url 
            ? ('bg-gradient-to-r ' + (activeSlides[currentSlide].color || 'from-primary/25 to-secondary/15 border-primary/30')) 
            : 'border-border/85'
        }`}
      >
        {isSuperAdmin && (
          <Link 
            to="/superadmin?tab=carousel" 
            className="absolute top-4 right-4 z-20 px-2.5 py-1 rounded bg-black/60 hover:bg-primary text-[10px] font-bold text-white transition-colors flex items-center gap-1 uppercase tracking-wider"
          >
            Edit Slides
          </Link>
        )}
        <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 shrink-0 shadow-sm relative z-10">
          {activeSlides[currentSlide].icon || <Smartphone className="h-6 w-6 text-primary" />}
        </div>
        <div className="space-y-1.5 flex-1 min-w-0 pr-12 relative z-10">
          <h4 className="text-sm font-black tracking-tight text-white uppercase">
            {activeSlides[currentSlide].title}
          </h4>
          <p className="text-xs text-neutral-200 dark:text-muted-foreground leading-relaxed max-w-2xl">
            {activeSlides[currentSlide].description}
          </p>
        </div>
        
        {/* Carousel controls */}
        <div className="absolute right-4 bottom-4 flex items-center gap-1.5 z-10">
          {activeSlides.map((_: any, idx: number) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                currentSlide === idx ? 'w-4 bg-primary' : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Search Billing Number Bar */}
      <div className="bg-gradient-to-r from-secondary/10 via-secondary/20 to-secondary/10 border border-border/85 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Search Billing Number</h3>
          <p className="text-[11px] text-muted-foreground">Find a repair order instantly by entering its unique job ID.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="e.g. GK-20260701-001"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchBilling();
              }}
              className="pl-9 bg-background/50 border-border/80 focus:border-primary text-foreground placeholder:text-muted-foreground text-xs font-semibold text-white"
            />
          </div>
          <Button 
            onClick={handleSearchBilling} 
            disabled={searchingBilling}
            className="shrink-0 text-xs font-bold uppercase tracking-wider px-4 shadow-[0_0_15px_rgba(168,85,247,0.15)] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {searchingBilling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Today's New Repairs */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-card/30 to-secondary/30 border border-border/85 hover:border-amber-500/30 transition-all duration-300 group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-none bg-clip-border text-current">
                Today&apos;s New Repairs
              </CardTitle>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-550 border border-amber-500/20 transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                <Wrench className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-foreground tracking-tight">
                {stats.newRepairs}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2.5 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span>Active tickets initialized today</span>
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Ready for Pickup */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-card/30 to-secondary/30 border border-border/85 hover:border-emerald-500/30 transition-all duration-300 group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-none bg-clip-border text-current">
                Ready for Pickup
              </CardTitle>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20 transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                <Clock className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-foreground tracking-tight">
                {stats.pendingDeliveries}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2.5 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                <span>Awaiting customer delivery</span>
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Today's Advances */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-card/30 to-secondary/30 border border-border/85 hover:border-primary/30 transition-all duration-300 group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-none bg-clip-border text-current">
                Today&apos;s Advances
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(168,85,247,0.25)]">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-foreground tracking-tight">
                ₹{Number(stats.revenueCollected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2.5 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span>Collected cash advances today</span>
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Outstanding Balance */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-card/30 to-secondary/30 border border-border/85 hover:border-red-500/30 transition-all duration-300 group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-none bg-clip-border text-current">
                Outstanding Balance
              </CardTitle>
              <div className="p-2 rounded-lg bg-red-500/10 text-red-650 dark:text-red-500 border border-red-500/20 transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(239,68,68,0.25)]">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-foreground tracking-tight">
                ₹{Number(stats.totalOutstandingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2.5 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <span>Outstanding dues for active jobs</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* QUICK ACTIONS ROW */}
      <div className="flex flex-wrap items-center gap-3 bg-secondary/10 border border-border/40 p-2.5 rounded-xl w-fit">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2">Quick Filters:</span>
        <button
          onClick={() => navigate('/repairs?status=pending')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all duration-200"
        >
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          <span>Pending Pipeline</span>
        </button>
        <button
          onClick={() => navigate('/repairs?status=ready')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all duration-200"
        >
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          <span>Ready for Pickup</span>
        </button>
      </div>

      {/* CHARTS CONTAINER GRID */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Dual Axis Monthly Revenue chart */}
        <Card className="md:col-span-2">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base text-foreground bg-none bg-clip-border text-current font-bold">Monthly Repair & Revenues</CardTitle>
            <CardDescription>Aggregate orders and estimated values over the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="h-80 pt-6">
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue} margin={{ left: -10, right: -10, top: 10 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.85}/>
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                    </linearGradient>
                    <linearGradient id="repairsCountGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.85}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.15}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.15)" vertical={false} />
                  <XAxis dataKey="month" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} dy={4} />
                  <YAxis yAxisId="left" orientation="left" stroke="#a855f7" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} dx={-4} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} tickLine={false} axisLine={false} dx={4} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar yAxisId="left" dataKey="revenue" fill="url(#revenueGradient)" name="Revenue Forecast" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar yAxisId="right" dataKey="repairsCount" fill="url(#repairsCountGradient)" name="Repairs Count" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No monthly data trends found.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut Chart: Repairs by status */}
        <Card>
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base text-foreground bg-none bg-clip-border text-current font-bold">Repairs by Status</CardTitle>
            <CardDescription>Status breakdown of repair orders.</CardDescription>
          </CardHeader>
          <CardContent className="h-80 flex flex-col justify-between pt-6">
            {pieData.length > 0 ? (
              <>
                <div className="h-44 relative flex items-center justify-center">
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                    <span className="text-2xl font-black text-foreground tracking-tight">{totalActiveRepairs}</span>
                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Active</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.15)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 px-1">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 p-1.5 rounded-lg bg-secondary/15 border border-border/30">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] text-muted-foreground font-semibold uppercase truncate">{d.name}</span>
                        <span className="text-xs font-bold text-foreground font-mono leading-none mt-0.5">{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-10">
                No status distributions available.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart: Top 5 Brands */}
        <Card className="md:col-span-3">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base text-foreground bg-none bg-clip-border text-current font-bold">Top Hardware Brands</CardTitle>
            <CardDescription>Frequency breakdown of device brands.</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-6">
            {topDeviceBrands.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDeviceBrands} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.85}/>
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0.45}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.15)" vertical={false} />
                  <XAxis type="number" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="brand" type="category" stroke="#888888" fontSize={10} width={80} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="url(#brandGradient)" name="Orders Checked" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No brand demographics logged.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RECENT REPAIRS TABLE */}
      <Card>
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-foreground bg-none bg-clip-border text-current font-bold">Recent Repair Orders</CardTitle>
              <CardDescription>Overview of the last 5 registered repairs.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild className="gap-1 border-border/80 text-foreground bg-secondary/15 hover:bg-secondary/40">
              <Link to="/repairs">
                <span>All Repairs</span> <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentRepairs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/40">
                  <TableHead className="py-3 px-6 text-xs font-bold text-muted-foreground uppercase tracking-wider">Job ID</TableHead>
                  <TableHead className="py-3 px-6 text-xs font-bold text-muted-foreground uppercase tracking-wider">Client / Device</TableHead>
                  <TableHead className="py-3 px-6 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                  <TableHead className="py-3 px-6 text-xs font-bold text-muted-foreground uppercase tracking-wider">Assigned Staff</TableHead>
                  <TableHead className="py-3 px-6 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRepairs.map((r) => (
                  <TableRow key={r.id} className="hover:bg-secondary/10 border-b border-border/40 transition-colors duration-200">
                    <TableCell className="py-4 px-6 font-mono text-xs font-bold text-primary">
                      {r.job_number}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-secondary/45 border border-border/40 text-primary shrink-0">
                          <Smartphone className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground text-xs">
                            {r.device ? `${r.device.brand} ${r.device.model}` : 'Unknown Device'}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {r.device?.customer?.name || 'Walk-In Customer'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${statusColors[r.status] || ''}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot[r.status] || 'bg-white'}`} />
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 px-6 text-xs text-muted-foreground">
                      {r.assigned_staff ? (
                        <span className="font-semibold text-foreground">{r.assigned_staff.name}</span>
                      ) : (
                        <span className="italic text-muted-foreground/60">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRepairId(r.id);
                            setSelectedStatus(r.status);
                          }}
                          className="h-8 text-[11px] font-semibold border-border/85 text-foreground bg-secondary/10 hover:bg-secondary/35"
                        >
                          Quick Status
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/repairs/${r.id}`)}
                          className="h-8 w-8 p-0 hover:bg-secondary/30"
                        >
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-xs text-muted-foreground">
              No recent repairs found.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Status Update Dialog */}
      <Dialog
        isOpen={!!selectedRepairId}
        onClose={() => {
          setSelectedRepairId(null);
          setStatusNote('');
        }}
        title="Quick Status Transition"
        description="Alter repair pipeline state indicator."
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Select Pipeline State</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground focus:border-primary focus-visible:outline-none cursor-pointer"
            >
              <option value="pending">Pending</option>
              <option value="repairing">Repairing</option>
              <option value="ready">Ready (For Pick-up)</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Add status change note</label>
            <textarea
              placeholder="e.g. Completed screen calibration..."
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground focus:border-primary focus-visible:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-border/40 pt-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedRepairId(null);
                setStatusNote('');
              }}
              disabled={updateStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => updateStatusMutation.mutate({ status: selectedStatus, notes: statusNote })}
              disabled={updateStatusMutation.isPending}
              className="gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.25)] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
            >
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
