import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Save, Loader2, Upload, ImageIcon, ChevronDown
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
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
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [editServices, setEditServices] = useState<RateCardService[]>([]);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

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
    Object.entries(DEVICE_BRANDS).forEach(([b, models]) => {
      models.forEach((m) => {
        const key = `${b.toUpperCase()}:${m.toUpperCase()}`;
        if (!cardsMap.has(key)) {
          cardsMap.set(key, {
            id: `virtual-${b}-${m}`,
            brand: b,
            model: m,
            model_image_url: null,
            services: []
          });
        }
      });
    });
    
    return Array.from(cardsMap.values());
  }, [data?.rateCards]);

  // Find rate card matching current brand and model
  const matchedCard = useMemo(() => {
    if (!brand.trim() || !model.trim()) return null;
    const key = `${brand.trim().toUpperCase()}:${model.trim().toUpperCase()}`;
    return allRateCards.find(rc => `${rc.brand.toUpperCase()}:${rc.model.toUpperCase()}` === key) || null;
  }, [allRateCards, brand, model]);

  // Load services when brand, model, or matchedCard changes.
  // Never preload a rate card: services only populate once a Brand AND Model are chosen.
  useEffect(() => {
    if (!brand.trim() || !model.trim()) {
      setEditServices([]);
      setEditImageFile(null);
      return;
    }
    if (matchedCard && matchedCard.services && matchedCard.services.length > 0) {
      setEditServices(matchedCard.services.map((s, i) => ({ 
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
  }, [matchedCard, brand, model]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const brandContainer = document.getElementById('brand-select-container-rc');
      const modelContainer = document.getElementById('model-select-container-rc');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save rate card'),
  });

  const saveServicesMutation = useMutation({
    mutationFn: ({ id, services }: { id: string; services: RateCardService[] }) =>
      apiClient.post(`/ratecards/${id}/services`, { services }),
    onSuccess: () => {
      toast.success('Service rates saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save service rates'),
  });

  const updateImageMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      apiClient.put<{ message: string; rateCard: RateCard }>(`/ratecards/${id}`, formData),
    onSuccess: () => {
      setEditImageFile(null);
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update rate card'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/ratecards/${id}`),
    onSuccess: () => {
      toast.success('Rate card deleted');
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete rate card'),
  });

  const handleSaveServices = () => {
    const finalBrand = brand.trim().toUpperCase();
    const finalModel = model.trim().toUpperCase();

    if (!finalBrand || !finalModel) {
      toast.error('Brand and model are required');
      return;
    }

    const validServices = editServices.filter((s) => s.service_name.trim());

    if (!matchedCard || matchedCard.id.startsWith('virtual-')) {
      const fd = new FormData();
      fd.append('brand', finalBrand);
      fd.append('model', finalModel);
      if (editImageFile) fd.append('modelImage', editImageFile);

      createMutation.mutate(fd, {
        onSuccess: (resData) => {
          if (resData?.rateCard) {
            saveServicesMutation.mutate({ id: resData.rateCard.id, services: validServices });
          }
        }
      });
    } else {
      saveServicesMutation.mutate({ id: matchedCard.id, services: validServices });

      if (editImageFile) {
        const fd = new FormData();
        fd.append('modelImage', editImageFile);
        fd.append('brand', finalBrand);
        fd.append('model', finalModel);
        updateImageMutation.mutate({ id: matchedCard.id, formData: fd });
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

  // Available brands list
  const brandList = Object.keys(DEVICE_BRANDS);
  const filteredBrands = brandList.filter(b => b.toLowerCase().includes(brand.toLowerCase()));

  // Available models list for selected brand
  const modelList = DEVICE_BRANDS[brand.toUpperCase()] || [];
  const filteredModels = modelList.filter(m => m.toLowerCase().includes(model.toLowerCase()));

  const isDBRecorded = matchedCard && !matchedCard.id.startsWith('virtual-');

  return (
    <div className="w-full space-y-3 sm:space-y-4 text-foreground">
      {/* Brand & Model Selector Header */}
      <Card className="border-border/60 bg-card/90">
        <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Brand Input / Selection */}
            <div className="space-y-1 relative" id="brand-select-container-rc">
              <label className="text-[11px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider">
                Brand Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Select Brand..."
                  value={brand}
                  onChange={(e) => {
                    setBrand(e.target.value);
                    setModel('');
                    setBrandDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setBrandDropdownOpen(true);
                    setModelDropdownOpen(false);
                  }}
                  className="w-full bg-secondary/35 border border-border rounded-xl pl-3.5 pr-10 py-2.5 text-sm focus:outline-none focus:border-primary font-bold text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              {brandDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 max-h-56 sm:max-h-60 overflow-y-auto bg-neutral-900 border border-border rounded-xl shadow-xl scrollbar-thin">
                  {filteredBrands.length > 0 ? (
                    filteredBrands.map((b) => (
                      <div
                        key={b}
                        onClick={() => {
                          setBrand(b);
                          setModel('');
                          setBrandDropdownOpen(false);
                        }}
                        className={`px-3.5 py-3 sm:py-2.5 hover:bg-primary/25 cursor-pointer text-sm font-semibold transition-colors flex items-center justify-between ${
                          brand.toUpperCase() === b ? 'bg-primary/20 text-primary font-bold' : 'text-white/90'
                        }`}
                      >
                        <span>{b}</span>
                        <span className="text-[10px] text-muted-foreground">{DEVICE_BRANDS[b]?.length || 0} models</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-3.5 py-3 text-xs text-muted-foreground">Type custom brand: "{brand.toUpperCase()}"</div>
                  )}
                </div>
              )}
            </div>

            {/* Model Input / Selection */}
            <div className="space-y-1 relative" id="model-select-container-rc">
              <label className="text-[11px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider">
                Mobile Model
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Select Model..."
                  value={model}
                  disabled={!brand.trim()}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setModelDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (brand.trim()) {
                      setModelDropdownOpen(true);
                      setBrandDropdownOpen(false);
                    }
                  }}
                  className="w-full bg-secondary/35 border border-border rounded-xl pl-3.5 pr-10 py-2.5 text-sm focus:outline-none focus:border-primary font-bold text-foreground disabled:opacity-45 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  disabled={!brand.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 disabled:opacity-40 disabled:cursor-default disabled:hover:text-muted-foreground"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              {modelDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 max-h-56 sm:max-h-60 overflow-y-auto bg-neutral-900 border border-border rounded-xl shadow-xl scrollbar-thin">
                  {filteredModels.length > 0 ? (
                    filteredModels.map((m) => (
                      <div
                        key={m}
                        onClick={() => {
                          setModel(m);
                          setModelDropdownOpen(false);
                        }}
                        className={`px-3.5 py-3 sm:py-2.5 hover:bg-primary/25 cursor-pointer text-sm font-semibold transition-colors ${
                          model.toUpperCase() === m ? 'bg-primary/20 text-primary font-bold' : 'text-white/90'
                        }`}
                      >
                        {m}
                      </div>
                    ))
                  ) : (
                    <div className="px-3.5 py-3 text-xs text-muted-foreground">Type custom model: "{model.toUpperCase()}"</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Device Card Info Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Brand Logo */}
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary/40 border border-border flex items-center justify-center p-2 shrink-0 shadow-inner">
                {getBrandLogoUrl(brand) ? (
                  <img
                    src={getBrandLogoUrl(brand)!}
                    alt={brand}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-xs font-black text-primary uppercase">
                    {brand.substring(0, 2) || 'MB'}
                  </span>
                )}
              </div>

              {/* Model Image Preview / Upload */}
              <div className="relative group shrink-0">
                <div className="h-10 w-14 sm:h-12 sm:w-16 rounded-xl overflow-hidden bg-secondary/50 border border-border flex items-center justify-center">
                  {editImageFile ? (
                    <img src={URL.createObjectURL(editImageFile)} alt="Preview" className="h-full w-full object-cover" />
                  ) : matchedCard?.model_image_url ? (
                    <img src={matchedCard.model_image_url} alt={model} className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer">
                  <Upload className="h-4 w-4 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setEditImageFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="truncate">{brand.toUpperCase() || 'BRAND'} {model.toUpperCase() || 'MODEL'}</span>
                  {brand.trim() && model.trim() && (
                    isDBRecorded ? (
                      <span className="text-[9px] sm:text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                        Saved Rate Card
                      </span>
                    ) : (
                      <span className="text-[9px] sm:text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                        New Specification
                      </span>
                    )
                  )}
                </h4>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight mt-0.5">
                  {brand.trim() && model.trim()
                    ? 'Price specifications auto-loaded. Edit costs below.'
                    : 'Select a Brand and Model to view saved rates or create a new specification.'}
                </p>
              </div>
            </div>

            {isDBRecorded && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-red-400 border-red-500/30 hover:bg-red-500/10 h-8 text-xs shrink-0"
                onClick={() => {
                  if (confirm(`Delete saved rate card for ${brand} ${model}?`)) {
                    deleteMutation.mutate(matchedCard.id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Saved Card
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PRICE SPECIFICATIONS LIST / TABLE */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : editServices.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No services added yet. Click "Add Service Row" below.</p>
          ) : (
            <>
              {/* MOBILE VIEW CARD LIST (< sm) */}
              <div className="block sm:hidden space-y-3 max-h-[52vh] overflow-y-auto pr-0.5 scrollbar-thin">
                {editServices.map((svc, idx) => (
                  <div key={idx} className="bg-secondary/20 border border-border/60 rounded-xl p-3 space-y-2.5 relative">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        placeholder={`Service Name ${idx + 1}`}
                        value={svc.service_name}
                        onChange={(e) => updateServiceRow(idx, 'service_name', e.target.value)}
                        className="h-9 text-xs font-semibold bg-background/60 flex-1"
                      />
                      <button
                        onClick={() => removeServiceRow(idx)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-400 bg-red-500/10 border border-red-500/20 active:scale-95 transition-all"
                        title="Remove Service"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">OG Cost</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={svc.og_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'og_cost', parseFloat(e.target.value) || 0)}
                            className="pl-6 h-9 text-xs font-bold text-foreground bg-background/60"
                          />
                        </div>
                      </div>

                      <div>
                        <label translate="no" className="text-[9px] font-bold text-muted-foreground uppercase block mb-1 notranslate">Copy Cost</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={svc.copy_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'copy_cost', parseFloat(e.target.value) || 0)}
                            className="pl-6 h-9 text-xs font-bold text-foreground bg-background/60"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Ditto Cost</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={svc.ditto_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'ditto_cost', parseFloat(e.target.value) || 0)}
                            className="pl-6 h-9 text-xs font-bold text-foreground bg-background/60"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* TABLE VIEW FOR TABLET & DESKTOP (>= sm) */}
              <div className="hidden sm:block overflow-x-auto -mx-2 px-2 pb-2 scrollbar-thin">
                <div className="min-w-[600px] space-y-3">
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr_110px_110px_110px_40px] gap-2.5 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Service Name</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">OG Cost (₹)</span>
                    <span translate="no" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider notranslate">Copy Cost (₹)</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ditto Cost (₹)</span>
                    <span />
                  </div>

                  {/* Service Rows */}
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {editServices.map((svc, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_110px_110px_110px_40px] gap-2.5 items-center">
                        <Input
                          placeholder={`Service ${idx + 1}`}
                          value={svc.service_name}
                          onChange={(e) => updateServiceRow(idx, 'service_name', e.target.value)}
                          className="h-10 text-xs font-medium"
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={svc.og_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'og_cost', parseFloat(e.target.value) || 0)}
                            className="pl-7 h-10 text-xs font-bold text-foreground"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={svc.copy_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'copy_cost', parseFloat(e.target.value) || 0)}
                            className="pl-7 h-10 text-xs font-bold text-foreground"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={svc.ditto_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'ditto_cost', parseFloat(e.target.value) || 0)}
                            className="pl-7 h-10 text-xs font-bold text-foreground"
                          />
                        </div>
                        <button
                          onClick={() => removeServiceRow(idx)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove Service"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Footer Controls: Add Row + Totals Summary + Save Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border pt-3 sm:pt-4">
            {/* Totals Grid on Mobile / Flex on Desktop */}
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-4 bg-secondary/15 sm:bg-transparent p-2.5 sm:p-0 rounded-xl border sm:border-0 border-border/40">
              <div className="text-center sm:text-left">
                <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase font-bold">Total OG</p>
                <p className="text-xs sm:text-sm font-black text-primary">₹{totalOgLabor.toFixed(2)}</p>
              </div>
              <div className="text-center sm:text-left border-x border-border/40 sm:border-x-0 px-1 sm:px-0">
                <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase font-bold">Total Copy</p>
                <p className="text-xs sm:text-sm font-black text-rose-500">₹{totalCopyLabor.toFixed(2)}</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase font-bold">Total Ditto</p>
                <p className="text-xs sm:text-sm font-black text-amber-500">₹{totalDittoLabor.toFixed(2)}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={addServiceRow} className="gap-1.5 h-9 w-full sm:w-auto text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Service Row
              </Button>
              <Button
                onClick={handleSaveServices}
                disabled={saveServicesMutation.isPending || updateImageMutation.isPending || createMutation.isPending}
                className="gap-1.5 h-9 w-full sm:w-auto text-xs"
              >
                {saveServicesMutation.isPending || updateImageMutation.isPending || createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4" /> Save Services</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

