import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Save, Loader2, Edit3, X, Smartphone, Upload, ImageIcon
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

interface RateCardService {
  id?: string;
  service_name: string;
  og_cost: number;
  ditto_cost: number;
  copy_cost: number;
  sort_order: number;
}

interface RateCard {
  id: string;
  brand: string;
  model: string;
  model_image_url: string | null;
  services: RateCardService[];
}

const DEFAULT_SERVICES: RateCardService[] = [
  { service_name: 'Display Replacement', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 0 },
  { service_name: 'Battery Replacement', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 1 },
  { service_name: 'Charging Port Repair', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 2 },
  { service_name: 'Speaker Replacement', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 3 },
  { service_name: 'Microphone Repair', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 4 },
  { service_name: 'Back Cover Replacement', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 5 },
  { service_name: 'Camera Repair', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 6 },
  { service_name: 'Button / Switch Repair', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 7 },
  { service_name: 'Software / Flash', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 8 },
  { service_name: 'Water Damage Treatment', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 9 },
];

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
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [editServices, setEditServices] = useState<RateCardService[]>([]);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery<{ rateCards: RateCard[] }>({
    queryKey: ['rate-cards'],
    queryFn: () => apiClient.get('/ratecards'),
  });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.post('/ratecards', formData),
    onSuccess: () => {
      toast.success('Rate card created!');
      setIsCreating(false);
      setNewBrand('');
      setNewModel('');
      setNewImageFile(null);
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
      apiClient.put(`/ratecards/${id}`, formData),
    onSuccess: () => {
      toast.success('Image updated!');
      setEditImageFile(null);
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update image'),
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
    // Populate services editor — use card's existing services or defaults
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
    if (!newBrand.trim() || !newModel.trim()) {
      toast.error('Brand and model are required');
      return;
    }
    const fd = new FormData();
    fd.append('brand', newBrand.trim());
    fd.append('model', newModel.trim());
    if (newImageFile) fd.append('modelImage', newImageFile);
    createMutation.mutate(fd);
  };

  const handleSaveServices = () => {
    if (!selectedCard) return;
    const validServices = editServices.filter((s) => s.service_name.trim());
    saveServicesMutation.mutate({ id: selectedCard.id, services: validServices });

    if (editImageFile) {
      const fd = new FormData();
      fd.append('modelImage', editImageFile);
      updateImageMutation.mutate({ id: selectedCard.id, formData: fd });
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
      <div className="lg:w-72 xl:w-80 space-y-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Device Models</h3>
          <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Model
          </Button>
        </div>

        {/* Create New Card Form */}
        {isCreating && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-bold text-primary uppercase tracking-wider">New Rate Card</p>
              <Input
                placeholder="Brand (e.g. Apple)"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
              />
              <Input
                placeholder="Model (e.g. iPhone 16)"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
              />
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
                  onClick={() => { setIsCreating(false); setNewBrand(''); setNewModel(''); setNewImageFile(null); }}
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
            {(data?.rateCards || []).map((card) => (
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
                  <p className="text-[10px] text-muted-foreground">{card.brand} · {card.services?.length || 0} services</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Service Editor */}
      <div className="flex-1">
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

                  <div>
                    <CardTitle className="text-base text-foreground bg-none bg-clip-border text-current font-bold">{selectedCard.brand} {selectedCard.model}</CardTitle>
                    <CardDescription>Edit service names and their ₹ labor costs</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400 border-red-500/30 hover:bg-red-500/10 h-8"
                    onClick={() => {
                      if (confirm(`Delete rate card for ${selectedCard.brand} ${selectedCard.model}?`)) {
                        deleteMutation.mutate(selectedCard.id);
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
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_100px_100px_40px] gap-2 px-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Service Name</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">OG Cost (₹)</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ditto Cost (₹)</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Copy Cost (₹)</span>
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
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                      <Input
                        type="number"
                        placeholder="0"
                        value={svc.og_cost || ''}
                        onChange={(e) => updateServiceRow(idx, 'og_cost', parseFloat(e.target.value) || 0)}
                        className="pl-8 text-foreground font-semibold text-white"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                      <Input
                        type="number"
                        placeholder="0"
                        value={svc.ditto_cost || ''}
                        onChange={(e) => updateServiceRow(idx, 'ditto_cost', parseFloat(e.target.value) || 0)}
                        className="pl-8 text-foreground font-semibold text-white"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                      <Input
                        type="number"
                        placeholder="0"
                        value={svc.copy_cost || ''}
                        onChange={(e) => updateServiceRow(idx, 'copy_cost', parseFloat(e.target.value) || 0)}
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

              {/* Add Row + Total + Save */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={addServiceRow} className="gap-1.5 h-8">
                  <Plus className="h-3.5 w-3.5" /> Add Service Row
                </Button>

                <div className="flex items-center gap-4">
                  <div className="text-right flex items-center gap-4 border-r border-border/40 pr-4 mr-1">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total OG</p>
                      <p className="text-sm font-black text-primary">₹{totalOgLabor.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Ditto</p>
                      <p className="text-sm font-black text-emerald-500">₹{totalDittoLabor.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Copy</p>
                      <p className="text-sm font-black text-rose-500">₹{totalCopyLabor.toFixed(2)}</p>
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
