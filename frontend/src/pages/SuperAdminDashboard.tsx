import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, 
  Wrench, 
  Users, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

interface Shop {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  owner_id: string;
  repairsCount: number;
  owner: {
    id: string;
    name: string;
    email: string;
    is_active: boolean;
    created_at: string;
  } | null;
}

interface SuperAdminDashboardResponse {
  stats: {
    totalShops: number;
    totalRepairs: number;
    totalUsers: number;
  };
  shops: Shop[];
}

export default function SuperAdminDashboard() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch Super Admin data
  const { data, isLoading, refetch, isFetching } = useQuery<SuperAdminDashboardResponse>({
    queryKey: ['superadmin-dashboard'],
    queryFn: () => apiClient.get('/superadmin/dashboard')
  });

  // Mutation to toggle shop status
  const toggleStatusMutation = useMutation({
    mutationFn: (shopId: string) => apiClient.post(`/superadmin/shops/${shopId}/toggle`, {}),
    onSuccess: (res: any) => {
      toast.success(res.message || 'Status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['superadmin-dashboard'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update shop status');
    }
  });

  const handleToggleStatus = (shopId: string, shopName: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (window.confirm(`Are you sure you want to ${action} the shop "${shopName}" and all associated user accounts?`)) {
      toggleStatusMutation.mutate(shopId);
    }
  };

  const filteredShops = data?.shops.filter(shop => {
    const matchesName = shop.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOwnerName = shop.owner?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOwnerEmail = shop.owner?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesName || matchesOwnerName || matchesOwnerEmail;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Loading platform dashboard...
        </span>
      </div>
    );
  }

  const stats = data?.stats || { totalShops: 0, totalRepairs: 0, totalUsers: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Platform Management
          </h2>
          <p className="text-muted-foreground text-sm">
            Monitor registered shops, view aggregate repairs, and control store active statuses.
          </p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          disabled={isFetching}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/40 border-border/60">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Shops</span>
              <p className="text-3xl font-extrabold text-white">{stats.totalShops}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Repairs</span>
              <p className="text-3xl font-extrabold text-white">{stats.totalRepairs}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
              <Wrench className="h-6 w-6 text-violet-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform Users</span>
              <p className="text-3xl font-extrabold text-white">{stats.totalUsers}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Users className="h-6 w-6 text-indigo-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card className="bg-card/45 backdrop-blur-xl border-border/80">
        <CardHeader className="pb-3 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold">Registered Shops</CardTitle>
            <CardDescription className="text-xs">Manage individual store access and view store-level usage statistics.</CardDescription>
          </div>

          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search shops or owners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-secondary/35 border-border/80 w-full text-xs h-9.5"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {filteredShops.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground font-semibold bg-secondary/15 select-none">
                  <th className="p-4">Shop Details</th>
                  <th className="p-4">Owner Profile</th>
                  <th className="p-4">Registered Date</th>
                  <th className="p-4 text-center">Total Repairs</th>
                  <th className="p-4 text-center">Account Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredShops.map((shop) => {
                  const isActive = shop.owner?.is_active ?? true;
                  return (
                    <tr key={shop.id} className="hover:bg-secondary/10 transition-colors">
                      {/* Shop Column */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {shop.logo_url ? (
                            <img 
                              src={shop.logo_url} 
                              alt={`${shop.name} logo`} 
                              className="h-9 w-9 object-cover rounded-lg bg-secondary/40 border border-border/50"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                              <Building2 className="h-4.5 w-4.5 text-primary" />
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <span className="font-bold text-white text-sm">{shop.name}</span>
                            {shop.phone && (
                              <p className="text-[10px] text-muted-foreground">{shop.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Owner Column */}
                      <td className="p-4">
                        {shop.owner ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-white">{shop.owner.name}</span>
                            <p className="text-[10px] text-muted-foreground">{shop.owner.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">No owner linked</span>
                        )}
                      </td>

                      {/* Registered Column */}
                      <td className="p-4 text-muted-foreground">
                        {shop.owner?.created_at ? (
                          new Date(shop.owner.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        ) : (
                          'N/A'
                        )}
                      </td>

                      {/* Repairs Count Column */}
                      <td className="p-4 text-center font-mono font-bold text-white">
                        {shop.repairsCount}
                      </td>

                      {/* Status Column */}
                      <td className="p-4 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                            <XCircle className="h-3 w-3" /> Deactivated
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="p-4 text-center">
                        <Button
                          variant={isActive ? 'destructive' : 'default'}
                          size="sm"
                          onClick={() => handleToggleStatus(shop.id, shop.name, isActive)}
                          disabled={toggleStatusMutation.isPending}
                          className="h-8 text-[11px] font-bold uppercase tracking-wider px-3.5"
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-16">
              <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white">No shops found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                There are no registered shops matching your search query.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
