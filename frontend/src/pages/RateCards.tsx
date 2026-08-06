import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Save, Loader2, Edit3, X, Smartphone, Upload, ImageIcon, Search
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';
import { DEVICE_BRANDS, DEFAULT_SERVICES, RateCard, RateCardService } from '../data/deviceCatalog';

const getBrandLogoUrl = (brand: string) => {
  const name = brand.toLowerCase().trim();
  if (name.includes('apple') || name.includes('iphone')) return 'https://cdn.simpleicons.org/apple/currentColor';
  if (name.includes('samsung')) return 'https://cdn.simpleicons.org/samsung/1428A0';
  if (name.includes('google') || name.includes('pixel')) return 'https://cdn.simpleicons.org/google/4285F4';
  if (name.includes('oneplus')) return 'https://cdn.simpleicons.org/oneplus/F50F20';
  if (name.includes('xiaomi') || name.includes('redmi') || name.includes('poco')) return 'https://cdn.simpleicons.org/xiaomi/FF6700';
  if (name.includes('oppo')) return 'https://cdn.simpleicons.org/oppo/008148';
  if (name.includes('vivo')) return 'https://cdn.simpleicons.org/vivo/415FFF';
  if (name.includes('realme')) return 'https://cdn.simpleicons.org/realme/FFC900';
  if (name.includes('huawei')) return 'https://cdn.simpleicons.org/huawei/FF0000';
  if (name.includes('motorola') || name.includes('moto')) return 'https://cdn.simpleicons.org/motorola/001438';
  return null;
};

export default function RateCards() {
  const queryClient = useQueryClient();
  const [selectedCard, setSelectedCard] = useState<RateCard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [editServices, setEditServices] = useState<RateCardService[]>([]);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery<{ rateCards: RateCard[] }>({
    queryKey: ['rate-cards'],
    queryFn: () => apiClient.get('/ratecards'),
  });

  // Merged rate cards list (DB entries + Virtual options from static catalog)
  const allRateCards = useMemo(() => {
    const dbCards = data?.rateCards || [];
    const cardsMap = new Map<string, RateCard>();
    
    // 1. Add all DB rate cards first
    dbCards.forEach((rc) => {
      const key = `${rc.brand.toUpperCase()}:${rc.model.toUpperCase()}`;
      cardsMap.set(key, rc);
    });
    
    // 2. Add all static catalog models as virtual rate cards (if not already in DB)
    Object.entries(DEVICE_BRANDS).forEach(([brand, models]) => {
      models.forEach((model) => {
        const key = `${brand.toUpperCase()}:${model.toUpperCase()}`;
        if (!cardsMap.has(key)) {
          cardsMap.set(key, {
            id: `virtual-${brand}-${model}`,
            brand: brand,
            model: model,
            model_image_url: null,
            services: []
          });
        }
      });
    });
    
    return Array.from(cardsMap.values());
  }, [data?.rateCards]);

  const filteredRateCards = allRateCards.filter((card: RateCard) =>
    card.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close brand/model dropdown lists when clicking outside of them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const brandContainer = document.getElementById('brand-select-container');
      const modelContainer = document.getElementById('model-select-container');
      if (brandContainer && !brandContainer.contains(event.target as Node)) {
        setBrandDropdownOpen(false);
      }
      if (modelContainer && !modelContainer.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.post<{ message: string, rateCard: RateCard }>('/ratecards', formData),
    onSuccess: (resData) => {
      toast.success('Rate card created!');
      setIsCreating(false);
      setNewBrand('');
      setNewModel('');
      setNewImageFile(null);
      
      if (resData?.rateCard) {
        handleSelectCard(resData.rateCard);
      }
      
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create rate card'),
  });

  const saveServicesMutation = useMutation({
    mutationFn: ({ id, services }: { id: string; services: RateCardService[] }) =>
      apiClient.post(`/ratecards/${id}/services`, { services }),
    onSuccess: () => {
      toast.success('Services saved!');
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save services'),
  });

  const updateImageMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      apiClient.put<{ message: string; rateCard: RateCard }>(`/ratecards/${id}`, formData),
    onSuccess: (resData) => {
      toast.success('Rate card updated!');
      setEditImageFile(null);
      if (resData?.rateCard) {
        setSelectedCard((prev) => (prev ? { ...prev, ...resData.rateCard } : null));
      }
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update rate card'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/ratecards/${id}`),
    onSuccess: () => {
      toast.success('Rate card deleted');
      setSelectedCard(null);
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete rate card'),
  });

  const handleSelectCard = (card: RateCard) => {
    setSelectedCard(card);
    setEditBrand(card.brand);
    setEditModel(card.model);
    // Populate services editor â€” use card's existing services or defaults
    if (card.services && card.services.length > 0) {
      setEditServices(card.services.map((s, i) => ({ 
        ...s, 
        og_cost: s.og_cost ?? (s as any).labor_cost ?? 0,
        ditto_cost: s.ditto_cost ?? (s as any).labor_cost ?? 0,
        copy_cost: s.copy_cost ?? (s as any).labor_cost ?? 0,
        sort_order: i 
      })));
    } else {
      setEditServices(DEFAULT_SERVICES.map((s) => ({ ...s })));
    }
    setEditImageFile(null);
  };

  const handleCreateCard = () => {
    const finalBrand = newBrand.trim().toUpperCase();
    const finalModel = newModel.trim().toUpperCase();

    if (!finalBrand || !finalModel) {
      toast.error('Brand and model are required');
      return;
    }
    const fd = new FormData();
    fd.append('brand', finalBrand);
    fd.append('model', finalModel);
    if (newImageFile) fd.append('modelImage', newImageFile);
    createMutation.mutate(fd);
  };

  const handleSaveServices = () => {
    if (!selectedCard) return;
    const validServices = editServices.filter((s) => s.service_name.trim());

    if (selectedCard.id.startsWith('virtual-')) {
      const fd = new FormData();
      fd.append('brand', selectedCard.brand);
      fd.append('model', selectedCard.model);
      if (editImageFile) fd.append('modelImage', editImageFile);

      createMutation.mutate(fd, {
        onSuccess: (resData) => {
          if (resData?.rateCard) {
            saveServicesMutation.mutate({ id: resData.rateCard.id, services: validServices });
          }
        }
      });
    } else {
      saveServicesMutation.mutate({ id: selectedCard.id, services: validServices });

      if (editImageFile || editBrand !== selectedCard.brand || editModel !== selectedCard.model) {
        const fd = new FormData();
        if (editImageFile) fd.append('modelImage', editImageFile);
        fd.append('brand', editBrand);
        fd.append('model', editModel);
        updateImageMutation.mutate({ id: selectedCard.id, formData: fd });
      }
    }
  };

  const updateServiceRow = (idx: number, field: 'service_name' | 'og_cost' | 'ditto_cost' | 'copy_cost', value: string | number) => {
    setEditServices((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const addServiceRow = () => {
    setEditServices((prev) => [
      ...prev,
      { service_name: '', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: prev.length },
    ]);
  };

  const removeServiceRow = (idx: number) => {
    setEditServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalOgLabor = editServices.reduce((sum, s) => sum + Number(s.og_cost || 0), 0);
  const totalDittoLabor = editServices.reduce((sum, s) => sum + Number(s.ditto_cost || 0), 0);
  const totalCopyLabor = editServices.reduce((sum, s) => sum + Number(s.copy_cost || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full text-foreground">
      {/* LEFT PANEL: Rate Card List */}
      <div className="w-full lg:w-72 xl:w-80 space-y-4 flex-shrink-0 block">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Device Models</h3>
          <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Model
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search brand or model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 bg-card border-border/60 text-sm"
          />
        </div>

        {/* Create New Card Form */}
        {isCreating && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-bold text-primary uppercase tracking-wider">New Rate Card</p>
              {/* Brand Select / Type */}
              <div className="space-y-1 relative" id="brand-select-container">
                <label className="text-[10px] text-muted-foreground font-semibold uppercase">Brand</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type or select brand..."
                    value={newBrand}
                    onChange={(e) => {
                      setNewBrand(e.target.value);
                      setBrandDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setBrandDropdownOpen(true);
                      setModelDropdownOpen(false);
                    }}
                    className="w-full bg-secondary/35 border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground select-custom"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <Search className="h-4 w-4" />
                  </div>
                </div>
                {brandDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-neutral-900 border border-border rounded-xl shadow-lg scrollbar-thin">
                    {Object.keys(DEVICE_BRANDS)
                      .filter(b => b.toLowerCase().includes(newBrand.toLowerCase()))
                      .map((b) => (
                        <div
                          key={b}
                          onClick={() => {
                            setNewBrand(b);
                            setBrandDropdownOpen(false);
                          }}
                          className="px-4 py-2 hover:bg-primary/25 hover:text-white cursor-pointer text-sm font-semibold text-white/90"
                        >
                          {b}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Model Select / Type */}
              <div className="space-y-1 relative" id="model-select-container">
                <label className="text-[10px] text-muted-foreground font-semibold uppercase">Model</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type or select model..."
                    value={newModel}
                    onChange={(e) => {
                      setNewModel(e.target.value);
                      setModelDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setModelDropdownOpen(true);
                      setBrandDropdownOpen(false);
                    }}
                    className="w-full bg-secondary/35 border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground select-custom"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <Search className="h-4 w-4" />
                  </div>
                </div>
                {modelDropdownOpen && newBrand.trim() && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-neutral-900 border border-border rounded-xl shadow-lg scrollbar-thin">
                    {(DEVICE_BRANDS[newBrand.toUpperCase()] || [])
                      .filter(m => m.toLowerCase().includes(newModel.toLowerCase()))
                      .map((m) => (
                        <div
                          key={m}
                          onClick={() => {
                            setNewModel(m);
                            setModelDropdownOpen(false);
                          }}
                          className="px-4 py-2 hover:bg-primary/25 hover:text-white cursor-pointer text-sm font-semibold text-white/90"
                        >
                          {m}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold uppercase">Device Image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
                  className="text-xs text-muted-foreground cursor-pointer w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-secondary file:text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateCard}
                  disabled={createMutation.isPending}
                  className="flex-1 gap-1 h-8"
                >
                  {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewBrand('');
                    setNewModel('');
                    setNewImageFile(null);
                  }}
                  className="h-8"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rate Card List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (data?.rateCards || []).length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <Smartphone className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No device models added yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filteredRateCards.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No devices match your search.</p>
            ) : (
              filteredRateCards.map((card: RateCard) => (
              <button
                key={card.id}
                onClick={() => handleSelectCard(card)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  selectedCard?.id === card.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/60 bg-card/30 hover:bg-secondary/20 text-muted-foreground'
                }`}
              >
                {card.model_image_url ? (
                  <img src={card.model_image_url} alt={card.model} className="h-10 w-10 rounded-lg object-cover flex-shrink-0 border border-border" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0 border border-border">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{card.model}</p>
                  <p className="text-[10px] text-muted-foreground">{card.brand} Â· {card.services?.length || 0} services</p>
                </div>
              </button>
            )))}
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Service Editor */}
      <div className="flex-1 w-full block">
        {!selectedCard ? (
          <div className="flex flex-col items-center justify-center h-full py-24 text-center border border-dashed border-border rounded-xl">
            <Edit3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground">Select a device model</h3>
            <p className="text-xs text-muted-foreground mt-1">Choose from the left panel to edit its service rates</p>
          </div>
        ) : (
          <Card className="h-full">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Brand Photo / Logo */}
                  <div className="h-16 w-16 rounded-2xl bg-secondary/35 border border-border flex items-center justify-center p-3.5 shrink-0 shadow-inner">
                    {getBrandLogoUrl(selectedCard.brand) ? (
                      <img 
                        src={getBrandLogoUrl(selectedCard.brand)!} 
                        alt={selectedCard.brand} 
                        className="max-h-full max-w-full object-contain dark:invert-0" 
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-sm font-black text-primary uppercase tracking-tight">
                        {selectedCard.brand.substring(0, 2)}
                      </span>
                    )}
                  </div>

                  {/* Device / Model Image */}
                  <div className="relative group shrink-0">
                    <div className="h-16 w-20 rounded-2xl overflow-hidden bg-secondary/50 border border-border flex items-center justify-center">
                      {editImageFile ? (
                        <img src={URL.createObjectURL(editImageFile)} alt="Preview" className="h-full w-full object-cover" />
                      ) : selectedCard.model_image_url ? (
                        <img src={selectedCard.model_image_url} alt={selectedCard.model} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer">
                      <Upload className="h-5 w-5 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setEditImageFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>

                  <div className="space-y-1">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Input
                        placeholder="Brand"
                        value={editBrand}
                        onChange={(e) => setEditBrand(e.target.value.toUpperCase())}
                        className="h-8 text-xs font-bold text-white w-24 bg-secondary/35 border-border/80"
                      />
                      <Input
                        placeholder="Model"
                        value={editModel}
                        onChange={(e) => setEditModel(e.target.value.toUpperCase())}
                        className="h-8 text-xs font-bold text-white w-32 bg-secondary/35 border-border/80"
                      />
                    </div>
                    <CardDescription className="text-[10px]">Edit brand, model, and service rates</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400 border-red-500/30 hover:bg-red-500/10 h-8"
                    onClick={() => {
                      if (selectedCard.id.startsWith('virtual-')) {
                        setSelectedCard(null);
                        toast.success('Deselected virtual model.');
                      } else {
                        if (confirm(`Delete rate card for ${selectedCard.brand} ${selectedCard.model}?`)) {
                          deleteMutation.mutate(selectedCard.id);
                        }
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedCard(null)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Close
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-thin">
                <div className="min-w-[600px] space-y-4">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_100px_100px_100px_40px] gap-2 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Service Name</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">OG Cost (â‚¹)</span>
                    <span translate="no" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider notranslate">Copy Cost (â‚¹)</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ditto Cost (â‚¹)</span>
                    <span />
                  </div>

                  {/* Service Rows */}
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {editServices.map((svc, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_100px_100px_100px_40px] gap-2 items-center">
                        <Input
                          placeholder={`Service ${idx + 1}`}
                          value={svc.service_name}
                          onChange={(e) => updateServiceRow(idx, 'service_name', e.target.value)}
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">â‚¹</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={svc.og_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'og_cost', parseFloat(e.target.value) || 0)}
                            className="pl-8 text-foreground font-semibold text-white"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">â‚¹</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={svc.copy_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'copy_cost', parseFloat(e.target.value) || 0)}
                            className="pl-8 text-foreground font-semibold text-white"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">â‚¹</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={svc.ditto_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'ditto_cost', parseFloat(e.target.value) || 0)}
                            className="pl-8 text-foreground font-semibold text-white"
                          />
                        </div>
                        <button
                          onClick={() => removeServiceRow(idx)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add Row + Total + Save */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={addServiceRow} className="gap-1.5 h-8">
                  <Plus className="h-3.5 w-3.5" /> Add Service Row
                </Button>

                <div className="flex items-center gap-4">
                  <div className="text-right flex items-center gap-4 border-r border-border/40 pr-4 mr-1 flex-wrap">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total OG</p>
                      <p className="text-sm font-black text-primary">â‚¹{totalOgLabor.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Copy</p>
                      <p className="text-sm font-black text-rose-500">â‚¹{totalCopyLabor.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Ditto</p>
                      <p className="text-sm font-black text-amber-500">â‚¹{totalDittoLabor.toFixed(2)}</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveServices}
                    disabled={saveServicesMutation.isPending || updateImageMutation.isPending}
                    className="gap-1.5"
                  >
                    {saveServicesMutation.isPending || updateImageMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="h-4 w-4" /> Save Services</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
