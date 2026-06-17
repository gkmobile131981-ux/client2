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
  CheckCircle
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
  Legend,
  CartesianGrid
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
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

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role: authRole, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  
  // Status update modal state
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');

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
    await refetch();
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
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    repairing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    ready: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    delivered: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20'
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">System Dashboard</h2>
          <p className="text-muted-foreground text-sm">
            Overview of today&apos;s metrics, shop revenues, and technician pipelines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </Button>
          <Button onClick={() => navigate('/repairs/new')} className="gap-1.5 sm:flex">
            <Plus className="h-4.5 w-4.5" />
            <span>New Repair Ticket</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-none bg-clip-border text-current">
                Today&apos;s New Repairs
              </CardTitle>
              <Wrench className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white tracking-tight">{stats.newRepairs}</div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span>Active tickets initialized today</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-none bg-clip-border text-current">
                Ready for Pickup
              </CardTitle>
              <Clock className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white tracking-tight">{stats.pendingDeliveries}</div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span>Awaiting customer delivery</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-none bg-clip-border text-current">
                Today&apos;s Advances
              </CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white tracking-tight">${Number(stats.revenueCollected).toFixed(2)}</div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span>Collected cash advances today</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-none bg-clip-border text-current">
                Outstanding Balance
              </CardTitle>
              <DollarSign className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white tracking-tight">${Number(stats.totalOutstandingBalance).toFixed(2)}</div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <span>Outstanding dues for active jobs</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* QUICK ACTIONS ROW */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/repairs?status=pending')} className="bg-secondary/25 border-border/80 text-white gap-1.5">
          <Clock className="h-4 w-4" /> View Pending list
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/repairs?status=ready')} className="bg-secondary/25 border-border/80 text-white gap-1.5">
          <CheckCircle className="h-4 w-4 text-emerald-400" /> View Ready for pickup
        </Button>
      </div>

      {/* CHARTS CONTAINER GRID */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Dual Axis Monthly Revenue chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-white">Monthly Repair & Revenues</CardTitle>
            <CardDescription>Aggregate orders and estimated values over the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue} margin={{ left: -10, right: -10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
                  <XAxis dataKey="month" stroke="#888888" fontSize={11} />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" fontSize={11} label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft', style: { fill: '#8884d8' } }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" fontSize={11} label={{ value: 'Repairs Count', angle: 90, position: 'insideRight', style: { fill: '#82ca9d' } }} />
                  <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#2e2e2e', borderRadius: '8px' }} />
                  <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Revenue Forecast" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="repairsCount" fill="#82ca9d" name="Repairs count" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
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
          <CardHeader>
            <CardTitle className="text-base text-white">Repairs by Status</CardTitle>
            <CardDescription>Status breakdown of repair orders.</CardDescription>
          </CardHeader>
          <CardContent className="h-72 flex flex-col justify-center">
            {pieData.length > 0 ? (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#2e2e2e', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-4">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1 text-[10px] text-white">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span>{d.name}: {d.value}</span>
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
          <CardHeader>
            <CardTitle className="text-base text-white">Top Hardware Brands</CardTitle>
            <CardDescription>Frequency breakdown of device brands.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {topDeviceBrands.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDeviceBrands} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
                  <XAxis type="number" stroke="#888888" fontSize={11} />
                  <YAxis dataKey="brand" type="category" stroke="#888888" fontSize={11} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#2e2e2e', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#8884d8" name="Orders Checked" radius={[0, 4, 4, 0]} barSize={20} />
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-white">Recent Repair Orders</CardTitle>
              <CardDescription>Overview of the last 5 registered repairs.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild className="gap-1">
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
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Client / Device</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned staff</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRepairs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      {r.job_number}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-white">
                        {r.device ? `${r.device.brand} ${r.device.model}` : 'Unknown Device'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.device?.customer?.name || 'Walk-In'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${statusColors[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.assigned_staff ? r.assigned_staff.name : 'Unassigned'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRepairId(r.id);
                            setSelectedStatus(r.status);
                          }}
                          className="h-8 text-[11px]"
                        >
                          Quick Status
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/repairs/${r.id}`)}
                          className="h-8 w-8 p-0"
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
            <div className="text-center py-10 text-xs text-muted-foreground">
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
              className="flex w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-white focus:border-primary focus-visible:outline-none"
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
              className="gap-1.5"
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
