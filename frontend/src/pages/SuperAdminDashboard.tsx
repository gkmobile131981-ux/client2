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
  Image as ImageIcon
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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
  const initialTab = searchParams.get('tab') === 'carousel' ? 'carousel' : 'shops';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'shops' | 'carousel'>(initialTab);

  // Slide form state
  const [slideTitle, setSlideTitle] = useState('');
  const [slideDescription, setSlideDescription] = useState('');
  const [slideFile, setSlideFile] = useState<File | null>(null);

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
      refetchSlides();
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

  // Mutation to delete slide
  const deleteSlideMutation = useMutation({
    mutationFn: (slideId: string) => apiClient.delete(`/carousel/${slideId}`),
    onSuccess: (res: any) => {
      toast.success(res.message || 'Slide deleted successfully');
      refetchSlides();
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
    if (!slideTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!slideDescription.trim()) {
      toast.error('Description is required');
      return;
    }

    const formData = new FormData();
    formData.append('title', slideTitle.trim());
    formData.append('description', slideDescription.trim());
    if (slideFile) {
      formData.append('image', slideFile);
    }

    createSlideMutation.mutate(formData);
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
      </div>

      {/* Tab Contents */}
      {activeTab === 'shops' ? (
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
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Add Slide Panel */}
          <Card className="bg-card/45 backdrop-blur-xl border-border/85 h-fit md:col-span-1">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold">Add Carousel Slide</CardTitle>
              <CardDescription className="text-xs">Publish custom banners, training instructions, or news cards to all shop dashboards.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleCreateSlide} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Slide Title</label>
                  <Input
                    placeholder="e.g., Original vs Copy Part Rates"
                    value={slideTitle}
                    onChange={(e) => setSlideTitle(e.target.value)}
                    className="bg-secondary/35 border-border/80 text-xs h-9.5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Slide Description / Bio</label>
                  <textarea
                    rows={4}
                    placeholder="Describe best practices, parts quality notices, or association announcements..."
                    value={slideDescription}
                    onChange={(e) => setSlideDescription(e.target.value)}
                    className="flex w-full rounded-md border border-border/80 bg-secondary/35 px-3 py-2 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-white resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Upload Custom Banner Image (Optional)</label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border border-dashed rounded-lg cursor-pointer bg-secondary/15 hover:bg-secondary/25 border-border/60 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Plus className="h-6 w-6 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground font-semibold">Click to upload banner</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">PNG, JPG or WEBP (Max 5MB)</p>
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

                <Button 
                  type="submit" 
                  className="w-full text-xs font-bold uppercase tracking-wider"
                  disabled={createSlideMutation.isPending}
                >
                  {createSlideMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Slide...
                    </>
                  ) : (
                    'Add Banner Slide'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Current Slides Panel */}
          <Card className="bg-card/45 backdrop-blur-xl border-border/85 md:col-span-2">
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
                        <button
                          onClick={() => handleDeleteSlide(slide.id, slide.title)}
                          disabled={deleteSlideMutation.isPending}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500 text-white hover:text-white transition-colors cursor-pointer"
                          title="Delete Slide"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
                            {new Date(slide.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric'
                            })}
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
      )}
    </div>
  );
}
