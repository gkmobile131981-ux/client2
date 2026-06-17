import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Download, 
  Calendar, 
  Users, 
  Clock, 
  Loader2, 
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface RepairReportItem {
  id: string;
  job_number: string;
  estimate: number;
  advance: number;
  balance: number;
  status: string;
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
  };
}

interface StaffPerformanceItem {
  staff_id: string;
  name: string;
  assigned_count: number;
  completed_count: number;
  avg_turnaround_days: number;
  total_collected: number;
}

interface AgingRepairItem {
  id: string;
  job_number: string;
  created_at: string;
  status: string;
  daysOpen: number;
  device?: {
    brand: string;
    model: string;
    customer?: {
      name: string;
    };
  };
  assigned_staff?: {
    id: string;
    name: string;
  };
}

export default function Reports() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role: authRole } = useAuth();

  // Date filters
  const getPastMonthDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  };

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [from, setFrom] = useState(getPastMonthDate());
  const [to, setTo] = useState(getTodayDate());
  const [status, setStatus] = useState('all');
  const [staffFilter, setStaffFilter] = useState('');

  // 1. Fetch repairs summary report
  const { data: summaryData, isLoading: loadingSummary } = useQuery<{ repairs: RepairReportItem[] }>({
    queryKey: ['repairs-report', from, to, status, staffFilter],
    queryFn: () => apiClient.get(`/reports/repairs?from=${from}&to=${to}&status=${status}&staffId=${staffFilter}`)
  });

  // 2. Fetch staff performance report
  const { data: performanceData, isLoading: loadingPerformance } = useQuery<{ performance: StaffPerformanceItem[] }>({
    queryKey: ['staff-performance-report', from, to],
    queryFn: () => apiClient.get(`/reports/staff-performance?from=${from}&to=${to}`),
    enabled: authRole === 'owner'
  });

  // 3. Fetch aging tickets report
  const { data: agingData, isLoading: loadingAging } = useQuery<{ agingRepairs: AgingRepairItem[] }>({
    queryKey: ['aging-report'],
    queryFn: () => apiClient.get('/reports/aging')
  });

  // 4. Fetch staff list for reassignments and filters
  const { data: staffList } = useQuery<{ staff: { id: string; name: string }[] }>({
    queryKey: ['staff-list'],
    queryFn: () => apiClient.get('/auth/staff'),
    enabled: authRole === 'owner'
  });

  // Reassignment mutation (owner only)
  const reassignMutation = useMutation({
    mutationFn: (payload: { id: string; staffId: string }) => 
      apiClient.put(`/repairs/${payload.id}`, { staffId: payload.staffId }),
    onSuccess: () => {
      toast.success('Technician reassigned successfully!');
      queryClient.invalidateQueries({ queryKey: ['aging-report'] });
      queryClient.invalidateQueries({ queryKey: ['repairs-report'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reassign technician');
    }
  });

  // Export to CSV helper
  const handleExportCSV = () => {
    const list = summaryData?.repairs || [];
    if (list.length === 0) {
      toast.error('No data points to export.');
      return;
    }

    const headers = [
      'Job ID',
      'Client Name',
      'Client Phone',
      'Device brand',
      'Device model',
      'Status',
      'Estimated Cost',
      'Advance collected',
      'Outstanding Balance',
      'Date Opened'
    ];

    const rows = list.map((r) => [
      r.job_number,
      r.device?.customer?.name || '',
      r.device?.customer?.phone || '',
      r.device?.brand || '',
      r.device?.model || '',
      r.status,
      r.estimate,
      r.advance,
      r.balance,
      new Date(r.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GK-Repairs-Report-${from}-to-${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Download initiated!');
  };

  // Calculations for Totals row
  const repairsList = summaryData?.repairs || [];
  const totals = repairsList.reduce(
    (acc, cur) => {
      acc.estimate += parseFloat(cur.estimate as any || 0);
      acc.advance += parseFloat(cur.advance as any || 0);
      acc.balance += parseFloat(cur.balance as any || 0);
      return acc;
    },
    { estimate: 0, advance: 0, balance: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> Reports Terminal
          </h2>
          <p className="text-muted-foreground text-sm">
            Generate custom date filters, performance audits, and CSV reports.
          </p>
        </div>
      </div>

      {/* Date Filters Controls Card */}
      <Card>
        <CardContent className="p-4 grid gap-4 sm:grid-cols-4 items-center">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
              <Calendar className="h-3 w-3" /> From Date
            </label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
              <Calendar className="h-3 w-3" /> To Date
            </label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status filter</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground focus:border-primary focus-visible:outline-none cursor-pointer"
            >
              <option value="all">All status codes</option>
              <option value="pending">Pending</option>
              <option value="repairing">Repairing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {authRole === 'owner' && (
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Technician filter</label>
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground focus:border-primary focus-visible:outline-none cursor-pointer"
              >
                <option value="">All staff</option>
                {staffList?.staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* REPORT 1: REPAIR SUMMARY REPORT */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-white">Repair Summary Log</CardTitle>
              <CardDescription>Filtered list of repair tickets.</CardDescription>
            </div>
            <Button onClick={handleExportCSV} disabled={loadingSummary} variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingSummary ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Loading Summaries...</span>
            </div>
          ) : repairsList.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Device Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Estimate</TableHead>
                    <TableHead className="text-right">Advance</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repairsList.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">{r.job_number}</TableCell>
                      <TableCell className="text-white text-xs">{r.device?.customer?.name || 'Walk-In'}</TableCell>
                      <TableCell className="text-white text-xs">{r.device ? `${r.device.brand} ${r.device.model}` : 'Unknown'}</TableCell>
                      <TableCell className="capitalize text-xs text-muted-foreground">{r.status}</TableCell>
                      <TableCell className="text-right text-white">${Number(r.estimate).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-emerald-400">${Number(r.advance).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-amber-400">${Number(r.balance).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-secondary/20 border-t border-border font-bold">
                    <TableCell colSpan={4} className="text-white">TOTAL SUMMARY</TableCell>
                    <TableCell className="text-right text-white">${totals.estimate.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-emerald-400">${totals.advance.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-amber-400">${totals.balance.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-muted-foreground">
              No matching records for date criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* REPORT 2: STAFF PERFORMANCE REPORT */}
      {authRole === 'owner' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-primary" /> Staff Performance Metrics
            </CardTitle>
            <CardDescription>Turnaround times and revenues collected per technician.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingPerformance ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Loading Performance...</span>
              </div>
            ) : performanceData?.performance && performanceData.performance.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician Name</TableHead>
                    <TableHead className="text-center">Assigned Jobs</TableHead>
                    <TableHead className="text-center">Delivered Count</TableHead>
                    <TableHead className="text-center">Avg Turnaround</TableHead>
                    <TableHead className="text-right">Total Collected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceData.performance.map((staff) => (
                    <TableRow key={staff.staff_id}>
                      <TableCell className="font-semibold text-white">{staff.name}</TableCell>
                      <TableCell className="text-center text-white">{staff.assigned_count}</TableCell>
                      <TableCell className="text-center text-white">{staff.completed_count}</TableCell>
                      <TableCell className="text-center text-white">{staff.avg_turnaround_days} days</TableCell>
                      <TableCell className="text-right text-emerald-400 font-bold">${Number(staff.total_collected).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-10 text-xs text-muted-foreground">
                No staff performance metrics available.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* REPORT 3: AGING TICKET REPORT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-primary" /> Aging Repairs Queue
          </CardTitle>
          <CardDescription>Pending or repairing orders sorted by days elapsed.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingAging ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Loading Queue...</span>
            </div>
          ) : agingData?.agingRepairs && agingData.agingRepairs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Device Model</TableHead>
                  <TableHead>Age (Days)</TableHead>
                  <TableHead>Assigned technician</TableHead>
                  {authRole === 'owner' && <TableHead className="text-right">Reassign Staff</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {agingData.agingRepairs.map((r) => {
                  // Color thresholds
                  const ageColor = 
                    r.daysOpen <= 3 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                    r.daysOpen <= 7 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                    'text-red-400 bg-red-500/10 border-red-500/20 animate-pulse';

                  return (
                    <TableRow key={r.id}>
                      <TableCell
                        onClick={() => navigate(`/repairs/${r.id}`)}
                        className="font-mono text-xs font-semibold text-primary cursor-pointer hover:underline"
                      >
                        {r.job_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-white">{r.device ? `${r.device.brand} ${r.device.model}` : 'Unknown'}</div>
                        <div className="text-[10px] text-muted-foreground">{r.device?.customer?.name || 'Walk-In'}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${ageColor}`}>
                          {r.daysOpen} days open
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.assigned_staff ? r.assigned_staff.name : 'Unassigned'}
                      </TableCell>
                      
                      {/* Reassign technician inline */}
                      {authRole === 'owner' && (
                        <TableCell className="text-right">
                          <select
                            value={r.assigned_staff?.id || ''}
                            onChange={(e) => reassignMutation.mutate({ id: r.id, staffId: e.target.value })}
                            className="text-xs rounded border border-border bg-secondary/40 text-foreground px-2 py-1 focus:border-primary focus:outline-none cursor-pointer"
                          >
                            <option value="">Unassigned</option>
                            {staffList?.staff.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-xs text-muted-foreground">
              No aging repair tickets pending.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
