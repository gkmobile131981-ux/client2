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
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  Image as ImageIcon,
  HardDrive,
  Folder,
  FileText,
  ExternalLink,
  Database,
  Minus,
  Gauge,
  KeyRound
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/date';
import toast from 'react-hot-toast';

interface StorageSummary {
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeMB: string;
  quotaLimitMB: number;
  usagePercent: string;
  status: string;
}

interface BucketFile {
  name: string;
  size: number;
  created_at: string;
  url: string;
}

interface BucketMetric {
  name: string;
  fileCount: number;
  totalSizeBytes: number;
  totalSizeMB: string;
  files: BucketFile[];
}

interface StorageMetricsResponse {
  summary: StorageSummary;
  buckets: BucketMetric[];
}

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

interface CarouselSlide {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'carousel' ? 'carousel' : searchParams.get('tab') === 'storage' ? 'storage' : 'shops';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'shops' | 'carousel' | 'storage'>(initialTab);
  const [selectedBucketFilter, setSelectedBucketFilter] = useState<string>('all');

  // Slide form state
  const [slideTitle, setSlideTitle] = useState('');
  const [slideDescription, setSlideDescription] = useState('');
  const [slideFile, setSlideFile] = useState<File | null>(null);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);

  // Marquee settings state
  const [marqueeTitle, setMarqueeTitle] = useState('Latest Updates');
  const [marqueeText, setMarqueeText] = useState('');
  const [marqueeActive, setMarqueeActive] = useState(true);
  const [marqueeSpeedSeconds, setMarqueeSpeedSeconds] = useState(40);

  // Passwords are stored as one-way hashes by Supabase Auth and cannot be retrieved in plain text.
  // We generate temporary passwords on demand and reveal them here (Super Admin only).
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [resettingShopId, setResettingShopId] = useState<string | null>(null);

  // Fetch Super Admin data
  const { data, isLoading, refetch, isFetching } = useQuery<SuperAdminDashboardResponse>({
    queryKey: ['superadmin-dashboard'],
    queryFn: () => apiClient.get('/superadmin/dashboard')
  });

  // Fetch Carousel slides
  const { data: responseData, refetch: refetchSlides, isLoading: isSlidesLoading } = useQuery<any>({
    queryKey: ['carousel-slides'],
    queryFn: () => apiClient.get('/carousel')
  });

  // Fetch Marquee text
  const { refetch: refetchMarquee } = useQuery<any>({
    queryKey: ['marquee-text-admin'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/carousel/marquee');
      setMarqueeTitle(res.title || 'Latest Updates');
      setMarqueeText(res.text || '');
      setMarqueeActive(res.is_active ?? true);
      setMarqueeSpeedSeconds(res.speed_seconds != null ? Number(res.speed_seconds) : 40);
      return res;
    }
  });

  // Mutation to save marquee text
  const saveMarqueeMutation = useMutation({
    mutationFn: (payload: { title: string; text: string; is_active: boolean; speed_seconds: number }) =>
      apiClient.post('/carousel/marquee', payload),
    onSuccess: (res: any) => {
      toast.success(res.message || 'Marquee text saved successfully');
      queryClient.invalidateQueries({ queryKey: ['marquee-text-admin'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save marquee text');
    }
  });

  // Fetch Supabase Storage Metrics
  const { data: storageMetricsData, refetch: refetchStorage, isLoading: isStorageLoading } = useQuery<StorageMetricsResponse>({
    queryKey: ['storage-metrics'],
    queryFn: () => apiClient.get('/superadmin/storage-metrics')
  });

  const deleteStorageFileMutation = useMutation({
    mutationFn: ({ bucket, file }: { bucket: string; file: string }) =>
      apiClient.delete(`/superadmin/storage-file?bucket=${encodeURIComponent(bucket)}&file=${encodeURIComponent(file)}`),
    onSuccess: (res: any) => {
      toast.success(res.message || 'File deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['storage-metrics'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete storage file');
    }
  });

  const slides = responseData?.slides || [];

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

  // Mutation to generate a fresh temporary password for a shop owner (secure alternative to viewing hashed passwords)
  const resetPasswordMutation = useMutation({
    mutationFn: (shopId: string) => apiClient.post<{ temporaryPassword: string; message: string }>(`/superadmin/shops/${shopId}/reset-password`, {}),
    onMutate: (shopId: string) => setResettingShopId(shopId),
    onSuccess: (res: any, shopId: string) => {
      toast.success('Temporary password generated. Share it with the shop owner.');
      setRevealedPasswords(prev => ({ ...prev, [shopId]: res.temporaryPassword }));
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reset password');
    },
    onSettled: () => setResettingShopId(null)
  });

  // Mutation to create slide
  const createSlideMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.post('/carousel', formData),
    onSuccess: (res: any) => {
      toast.success(res.message || 'Slide created successfully');
      setSlideTitle('');
      setSlideDescription('');
      setSlideFile(null);
      // Reset file input element
      const fileInput = document.getElementById('slide-image') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      queryClient.invalidateQueries({ queryKey: ['carousel-slides'] });
    },
    onError: (err: any) => {
      if (err.details && Array.isArray(err.details)) {
        const errorMsgs = err.details.map((d: any) => d.message).join(', ');
        toast.error(`Validation failed: ${errorMsgs}`);
      } else {
        toast.error(err.message || 'Failed to create slide');
      }
    }
  });

  // Mutation to update slide
  const updateSlideMutation = useMutation({
    mutationFn: ({ slideId, formData }: { slideId: string; formData: FormData }) => 
      apiClient.put(`/carousel/${slideId}`, formData),
    onSuccess: (res: any) => {
      toast.success(res.message || 'Slide updated successfully');
      setSlideFile(null);
      setEditingSlideId(null);
      setEditingImageUrl(null);
      // Reset file input element
      const fileInput = document.getElementById('slide-image') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      queryClient.invalidateQueries({ queryKey: ['carousel-slides'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update slide');
    }
  });

  // Mutation to delete slide
  const deleteSlideMutation = useMutation({
    mutationFn: (slideId: string) => apiClient.delete(`/carousel/${slideId}`),
    onSuccess: (res: any) => {
      toast.success(res.message || 'Slide deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['carousel-slides'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete slide');
    }
  });

  const handleToggleStatus = (shopId: string, shopName: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (window.confirm(`Are you sure you want to ${action} the shop "${shopName}" and all associated user accounts?`)) {
      toggleStatusMutation.mutate(shopId);
    }
  };

  const handleCreateSlide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideFile && !editingSlideId) {
      toast.error('Banner image is required');
      return;
    }

    const formData = new FormData();
    formData.append('title', '');
    formData.append('description', '');
    if (slideFile) {
      formData.append('image', slideFile);
    }

    if (editingSlideId) {
      updateSlideMutation.mutate({ slideId: editingSlideId, formData });
    } else {
      createSlideMutation.mutate(formData);
    }
  };

  const handleDeleteSlide = (slideId: string, slideTitle: string) => {
    if (window.confirm(`Are you sure you want to delete the carousel slide "${slideTitle}"?`)) {
      deleteSlideMutation.mutate(slideId);
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
            Monitor registered shops, manage custom marketing/info carousel slides, and control account accesses.
          </p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            refetch();
            refetchSlides();
            refetchMarquee();
          }} 
          disabled={isFetching || isSlidesLoading}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching || isSlidesLoading ? 'animate-spin' : ''}`} />
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

      {/* Tabs */}
      <div className="flex border-b border-border/40 gap-6">
        <button
          onClick={() => setActiveTab('shops')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all relative ${
            activeTab === 'shops'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Shops Overview
        </button>
        <button
          onClick={() => setActiveTab('carousel')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all relative ${
            activeTab === 'carousel'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Manage Carousel Slides
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all relative flex items-center gap-1.5 ${
            activeTab === 'storage'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Database className="h-4 w-4" />
          <span>Supabase Storage Monitor</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'shops' ? (
        <Card className="bg-card/90 border-border/80">
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
                              <p className="text-[10px] text-muted-foreground font-mono">
                                Password: {revealedPasswords[shop.owner.id] || '••••••••'}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">No owner linked</span>
                          )}
                        </td>

                        {/* Registered Column */}
                        <td className="p-4 text-muted-foreground">
                          {shop.owner?.created_at ? (
                            formatDate(shop.owner.created_at)
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
                          <div className="flex flex-col items-center gap-2">
                            <Button
                              variant={isActive ? 'destructive' : 'default'}
                              size="sm"
                              onClick={() => handleToggleStatus(shop.id, shop.name, isActive)}
                              disabled={toggleStatusMutation.isPending}
                              className="h-8 text-[11px] font-bold uppercase tracking-wider px-3.5"
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            {shop.owner && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resetPasswordMutation.mutate(shop.id)}
                                disabled={resettingShopId === shop.id}
                                className="h-8 text-[11px] font-bold uppercase tracking-wider px-3.5"
                              >
                                {resettingShopId === shop.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <KeyRound className="h-3.5 w-3.5" />
                                )}
                                Reset Password
                              </Button>
                            )}
                          </div>
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
      ) : activeTab === 'carousel' ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-1">
            {/* Add/Edit Slide Panel */}
            <Card className="bg-card/90 border-border/85 h-fit">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-lg font-bold">{editingSlideId ? 'Edit Carousel Slide' : 'Add Carousel Slide'}</CardTitle>
                <CardDescription className="text-xs">
                  {editingSlideId 
                    ? 'Update the banner image for this active slide. Choose a new image file below to replace the current one.' 
                    : 'Publish custom banners, training instructions, or news cards to all shop dashboards.'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleCreateSlide} className="space-y-4">
                  {editingImageUrl && !slideFile && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Current Banner Slide</label>
                      <div className="relative rounded-lg overflow-hidden h-24 border border-border/40 bg-secondary/15">
                        <img src={editingImageUrl} className="w-full h-full object-cover opacity-60" alt="Current banner" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="text-[10px] text-white font-extrabold uppercase tracking-widest">Active Slide Image</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      {editingSlideId ? 'Upload New Banner Image (To Replace)' : 'Upload Slide Banner Image'}
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border border-dashed rounded-lg cursor-pointer bg-secondary/15 hover:bg-secondary/25 border-border/60 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Plus className="h-6 w-6 text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground font-semibold">Click to upload banner</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">PNG, JPG or WEBP (Max 5MB)</p>
                          <p className="text-[9px] text-primary font-medium mt-0.5">Landscape (16:9 / ~1200x500px) recommended</p>
                        </div>
                        <input 
                          id="slide-image"
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => setSlideFile(e.target.files?.[0] || null)}
                          className="hidden" 
                        />
                      </label>
                    </div>
                    {slideFile && (
                      <div className="mt-2 p-2 bg-secondary/25 border border-border/40 rounded flex items-center justify-between text-xs text-white">
                        <span className="truncate max-w-[200px]">{slideFile.name}</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            setSlideFile(null);
                            const fileInput = document.getElementById('slide-image') as HTMLInputElement;
                            if (fileInput) fileInput.value = '';
                          }}
                          className="text-red-400 hover:text-red-300 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Button 
                      type="submit" 
                      className="w-full text-xs font-bold uppercase tracking-wider"
                      disabled={createSlideMutation.isPending || updateSlideMutation.isPending}
                    >
                      {createSlideMutation.isPending || updateSlideMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {editingSlideId ? 'Updating Slide...' : 'Creating Slide...'}
                        </>
                      ) : (
                        editingSlideId ? 'Save Slide Changes' : 'Add Banner Slide'
                      )}
                    </Button>

                    {editingSlideId && (
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => {
                          setEditingSlideId(null);
                          setEditingImageUrl(null);
                          setSlideFile(null);
                          const fileInput = document.getElementById('slide-image') as HTMLInputElement;
                          if (fileInput) fileInput.value = '';
                        }}
                        className="w-full text-xs font-bold uppercase tracking-wider"
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Marquee Ticker Settings */}
            <Card className="bg-card/90 border-border/85 h-fit">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-lg font-bold">Marquee Ticker Text</CardTitle>
                <CardDescription className="text-xs">
                  This custom notice will scroll continuously beneath the main dashboard carousel banner across all store profiles.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Ticker Text Content</label>
                  <input
                    type="text"
                    placeholder="Marquee title"
                    value={marqueeTitle}
                    onChange={(e) => setMarqueeTitle(e.target.value)}
                    className="w-full bg-secondary/35 border border-border/80 focus:border-primary rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Ticker Text Content</label>
                  <textarea
                    placeholder="Enter marquee announcement message..."
                    value={marqueeText}
                    onChange={(e) => setMarqueeText(e.target.value)}
                    rows={4}
                    className="w-full bg-secondary/35 border border-border/80 focus:border-primary rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-xs font-bold text-foreground block">Active Notice Status</span>
                    <span className="text-[10px] text-muted-foreground">Toggle to show or hide the ticker on dashboards</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMarqueeActive(!marqueeActive)}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                      marqueeActive ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        marqueeActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Marquee scroll speed control */}
                <div className="flex items-center justify-between gap-3 py-1">
                  <div>
                    <span className="text-xs font-bold text-foreground block flex items-center gap-1.5">
                      <Gauge className="h-3.5 w-3.5 text-primary" /> Scroll Speed
                    </span>
                    <span className="text-[10px] text-muted-foreground">Seconds per full marquee cycle (slower = higher value)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMarqueeSpeedSeconds((s) => Math.min(Math.max(Math.round((Number(s) || 40) - 1), 10), 120))}
                      disabled={Number(marqueeSpeedSeconds) <= 10}
                      className="w-8 h-8 rounded-lg bg-secondary/40 border border-border/70 text-foreground hover:bg-secondary/70 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                      title="Slow down marquee"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center text-xs font-black text-foreground font-mono">
                      {Number(marqueeSpeedSeconds) || 40}s
                    </span>
                    <button
                      type="button"
                      onClick={() => setMarqueeSpeedSeconds((s) => Math.min(Math.max(Math.round((Number(s) || 40) + 1), 10), 120))}
                      disabled={Number(marqueeSpeedSeconds) >= 120}
                      className="w-8 h-8 rounded-lg bg-secondary/40 border border-border/70 text-foreground hover:bg-secondary/70 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                      title="Speed up marquee"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <Button
                  onClick={() => saveMarqueeMutation.mutate({ title: marqueeTitle, text: marqueeText, is_active: marqueeActive, speed_seconds: Number(marqueeSpeedSeconds) || 40 })}
                  className="w-full text-xs font-bold uppercase tracking-wider gap-1.5"
                  disabled={saveMarqueeMutation.isPending}
                >
                  {saveMarqueeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving Notice...
                    </>
                  ) : (
                    'Save Marquee Notice'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Current Slides Panel */}
          <Card className="bg-card/90 border-border/85 md:col-span-2">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold">Current Active Slides</CardTitle>
              <CardDescription className="text-xs">Banners rotation order is based on published dates. Built-in announcements will fallback if empty.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {isSlidesLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : slides && slides.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {slides.map((slide: any) => (
                    <div 
                      key={slide.id} 
                      className="group border border-border/60 bg-secondary/10 rounded-xl overflow-hidden flex flex-col relative"
                    >
                      {/* Banners display */}
                      <div className="h-32 bg-secondary/25 relative overflow-hidden flex items-center justify-center border-b border-border/40">
                        {slide.image_url ? (
                          <img 
                            src={slide.image_url} 
                            alt={slide.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground gap-1.5 p-4">
                            <ImageIcon className="h-6 w-6 opacity-60" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider">No Custom Banner</span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button
                            onClick={() => {
                              setEditingSlideId(slide.id);
                              setEditingImageUrl(slide.image_url);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-primary text-white hover:text-white transition-colors cursor-pointer"
                            title="Edit Slide Banner"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSlide(slide.id, slide.title || 'Untitled')}
                            disabled={deleteSlideMutation.isPending}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-red-500 text-white hover:text-white transition-colors cursor-pointer"
                            title="Delete Slide"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content display */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-white text-sm line-clamp-1">{slide.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">
                            {slide.description}
                          </p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/20 text-[10px] text-muted-foreground flex justify-between">
                          <span>ID: {slide.id.substring(0, 8)}...</span>
                          <span>
                            {formatDate(slide.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-white">No slides in database</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    The platform is currently showing the system default placeholder slides. Add a custom slide above to override them.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Storage Monitor View */
        <div className="space-y-6">
          <Card className="bg-card/90 border-border/80">
            <CardHeader className="pb-3 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                  <Database className="h-5 w-5 text-primary" />
                  Supabase Cloud Storage Monitor
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time health, quota usage, and bucket asset inspection across all shop image stores.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchStorage()} 
                  disabled={isStorageLoading}
                  className="gap-2 shrink-0 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isStorageLoading ? 'animate-spin' : ''}`} />
                  <span>Scan Storage</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {isStorageLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Scanning Supabase Storage Buckets...
                  </span>
                </div>
              ) : storageMetricsData ? (
                <>
                  {/* Summary Bar */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="bg-secondary/35 border border-border/60 rounded-xl p-4 space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Storage Usage</span>
                      <p className="text-2xl font-extrabold text-white font-mono">
                        {storageMetricsData.summary.totalSizeMB} MB
                      </p>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        Limit: {storageMetricsData.summary.quotaLimitMB} MB (Free Quota)
                      </span>
                    </div>

                    <div className="bg-secondary/35 border border-border/60 rounded-xl p-4 space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Assets Stored</span>
                      <p className="text-2xl font-extrabold text-white font-mono">
                        {storageMetricsData.summary.totalFiles} Files
                      </p>
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> All Buckets Active
                      </span>
                    </div>

                    <div className="bg-secondary/35 border border-border/60 rounded-xl p-4 space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quota Utilized</span>
                      <p className="text-2xl font-extrabold text-emerald-400 font-mono">
                        {storageMetricsData.summary.usagePercent}%
                      </p>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                        <div 
                          className="bg-emerald-500 h-1.5 rounded-full" 
                          style={{ width: `${Math.min(100, Math.max(1, Number(storageMetricsData.summary.usagePercent)))}%` }} 
                        />
                      </div>
                    </div>

                    <div className="bg-secondary/35 border border-border/60 rounded-xl p-4 space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Storage Health</span>
                      <p className="text-xl font-extrabold text-emerald-400 flex items-center gap-1.5">
                        <ShieldAlert className="h-5 w-5 text-emerald-400" />
                        {storageMetricsData.summary.status}
                      </p>
                      <span className="text-[10px] text-muted-foreground">Supabase S3 Compatible Object API</span>
                    </div>
                  </div>

                  {/* Buckets Grid */}
                  <div>
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <Folder className="h-4 w-4 text-primary" /> Registered Buckets ({storageMetricsData.buckets.length})
                    </h3>

                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      <button
                        onClick={() => setSelectedBucketFilter('all')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedBucketFilter === 'all'
                            ? 'bg-white text-slate-950 border-white font-bold shadow-md'
                            : 'bg-secondary/30 border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-extrabold">ALL BUCKETS</div>
                        <div className="text-xs mt-1 font-mono">
                          {storageMetricsData.summary.totalFiles} Files ({storageMetricsData.summary.totalSizeMB} MB)
                        </div>
                      </button>

                      {storageMetricsData.buckets.map((b) => {
                        const isSelected = selectedBucketFilter === b.name;
                        return (
                          <button
                            key={b.name}
                            onClick={() => setSelectedBucketFilter(b.name)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white text-slate-950 border-white font-bold shadow-md'
                                : 'bg-secondary/30 border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-white'
                            }`}
                          >
                            <div className="text-xs font-extrabold uppercase font-mono">{b.name}</div>
                            <div className="text-xs mt-1 font-mono">
                              {b.fileCount} Files ({b.totalSizeMB} MB)
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* File Assets Inspector Table */}
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> 
                        Stored Assets Inspector {selectedBucketFilter !== 'all' && `(${selectedBucketFilter})`}
                      </h3>
                      <span className="text-xs text-muted-foreground">Showing stored images & files</span>
                    </div>

                    {(() => {
                      const allFiles: Array<{ bucket: string; name: string; size: number; created_at: string; url: string }> = [];
                      storageMetricsData.buckets.forEach(b => {
                        if (selectedBucketFilter === 'all' || selectedBucketFilter === b.name) {
                          b.files.forEach(f => {
                            allFiles.push({ ...f, bucket: b.name });
                          });
                        }
                      });

                      if (allFiles.length === 0) {
                        return (
                          <div className="text-center py-12 bg-secondary/20 rounded-xl border border-border/40">
                            <Folder className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                            <p className="text-xs font-semibold text-muted-foreground">No files uploaded in this storage bucket yet.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="rounded-xl border border-border/60 overflow-hidden overflow-x-auto bg-card/60">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-border/60 bg-secondary/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                                <th className="py-3 px-4">Preview</th>
                                <th className="py-3 px-4">Bucket</th>
                                <th className="py-3 px-4">Filename</th>
                                <th className="py-3 px-4">Size</th>
                                <th className="py-3 px-4">Uploaded Date</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40 text-foreground">
                              {allFiles.map((file, idx) => (
                                <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                                  <td className="py-2.5 px-4">
                                    <div className="w-10 h-10 rounded-lg border border-border bg-slate-900 overflow-hidden flex items-center justify-center">
                                      {file.url ? (
                                        <img src={file.url} alt="asset thumbnail" className="w-full h-full object-cover" />
                                      ) : (
                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 font-mono font-bold text-amber-400">
                                    {file.bucket}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-white max-w-xs truncate">
                                    {file.name}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-muted-foreground">
                                    {(file.size / 1024).toFixed(1)} KB
                                  </td>
                                  <td className="py-2.5 px-4 text-muted-foreground">
                                    {formatDateTime(file.created_at)}
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <a
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg bg-secondary/60 hover:bg-primary text-white transition-colors"
                                        title="View full file"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (window.confirm(`Delete storage file "${file.name}" from bucket "${file.bucket}"?`)) {
                                            deleteStorageFileMutation.mutate({ bucket: file.bucket, file: file.name });
                                          }
                                        }}
                                        disabled={deleteStorageFileMutation.isPending}
                                        className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white transition-colors cursor-pointer"
                                        title="Delete file"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Unable to fetch Supabase storage metrics.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
