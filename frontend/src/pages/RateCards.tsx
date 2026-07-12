import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Save, Loader2, Edit3, X, Smartphone, Upload, ImageIcon, Search
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

const DEVICE_BRANDS: Record<string, string[]> = {
  'APPLE': ['IPHONE 11', 'IPHONE 12', 'IPHONE 13', 'IPHONE 14', 'IPHONE 15', 'IPHONE 15 PRO', 'IPHONE 15 PRO MAX', 'IPHONE 16E', 'IPHONE 17', 'IPHONE 17 PRO', 'IPHONE 17 PRO MAX', 'IPHONE 17 AIR', 'IPHONE SE (4TH GEN)', 'IPAD AIR', 'IPAD PRO'],
  'SAMSUNG': ['GALAXY S21', 'GALAXY S22', 'GALAXY S23', 'GALAXY S24', 'GALAXY S25', 'GALAXY S25+', 'GALAXY S25 ULTRA', 'GALAXY S25 EDGE', 'GALAXY A16', 'GALAXY A36', 'GALAXY A54', 'GALAXY A56', 'GALAXY M-SERIES', 'GALAXY M34', 'GALAXY Z FOLD 5', 'GALAXY Z FOLD 7', 'GALAXY Z FLIP 5', 'GALAXY Z FLIP 7'],
  'ONEPLUS': ['ONEPLUS 10 PRO', 'ONEPLUS 11', 'ONEPLUS 12', 'ONEPLUS 13', 'ONEPLUS 13R', 'ONEPLUS 13T', 'ONEPLUS NORD 3', 'ONEPLUS NORD 5', 'ONEPLUS NORD CE 3 LITE', 'ONEPLUS NORD CE5'],
  'GOOGLE': ['PIXEL 6', 'PIXEL 7', 'PIXEL 7A', 'PIXEL 8', 'PIXEL 8 PRO', 'PIXEL 9A', 'PIXEL 10', 'PIXEL 10 PRO', 'PIXEL 10 PRO XL', 'PIXEL 10 PRO FOLD'],
  'XIAOMI': ['REDMI NOTE 12', 'REDMI NOTE 13', 'REDMI NOTE 14 SERIES', 'REDMI 14C', 'XIAOMI 13 PRO', 'XIAOMI 15', 'XIAOMI 15 ULTRA', 'XIAOMI 15S PRO', 'POCO F5', 'POCO F7', 'POCO X6 PRO', 'POCO X7 SERIES'],
  'OPPO': ['RENO 10', 'RENO 11', 'RENO 13 SERIES', 'FIND X9', 'FIND X9 PRO', 'FIND X9 ULTRA', 'OPPO A-SERIES', 'OPPO F23', 'OPPO A78'],
  'VIVO': ['VIVO V29', 'VIVO V30', 'VIVO V-SERIES', 'VIVO T2X', 'VIVO Y200', 'VIVO Y-SERIES', 'X200', 'X200 PRO', 'X200 PRO+'],
  'REALME': ['REALME 11 PRO+', 'REALME 12 PRO', 'REALME 14 PRO SERIES', 'REALME C53', 'REALME C-SERIES', 'REALME NARZO 60', 'GT 7 PRO'],
  'HUAWEI': ['MATE 70', 'MATE 70 PRO', 'MATE X6', 'PURA 80', 'NOVA SERIES'],
  'HONOR': ['MAGIC 7', 'MAGIC 7 PRO', 'MAGIC V3', 'HONOR 400 SERIES', 'HONOR X-SERIES'],
  'MOTOROLA': ['EDGE 60 SERIES', 'RAZR 60', 'RAZR 60 ULTRA', 'MOTO G SERIES'],
  'NOTHING': ['PHONE (3)', 'PHONE (3A)', 'PHONE (3A) PRO', 'CMF PHONE 2 PRO'],
  'ASUS': ['ROG PHONE 9', 'ROG PHONE 9 PRO', 'ZENFONE 12'],
  'SONY': ['XPERIA 1 VII', 'XPERIA 10 VII'],
  'NOKIA (HMD)': ['HMD SKYLINE', 'HMD PULSE SERIES', 'NOKIA 110'],
  'ZTE': ['NUBIA Z70 ULTRA', 'REDMAGIC 10 PRO', 'ZTE BLADE SERIES'],
  'MEIZU': ['MEIZU 21 SERIES', 'MEIZU NOTE SERIES'],
  'INFINIX': ['ZERO 40 SERIES', 'NOTE 50 SERIES', 'HOT 60 SERIES', 'SMART 10 SERIES'],
  'TECNO': ['CAMON 40 SERIES', 'PHANTOM V FOLD2', 'SPARK 30 SERIES', 'POVA 6 SERIES'],
  'ITEL': ['S25 SERIES', 'A-SERIES'],
  'LAVA': ['BLAZE CURVE', 'YUVA SERIES', 'AGNI 3'],
  'MICROMAX': ['IN NOTE SERIES'],
  'VERTU': ['AGENT Q', 'METAVERTU 2'],
  'FAIRPHONE': ['FAIRPHONE 5'],
  'DOOGEE': ['S-SERIES (RUGGED)', 'V-SERIES (RUGGED)'],
  'ULEFONE': ['ARMOR SERIES (RUGGED)'],
  'CAT (BULLITT)': ['CAT S75'],
  'CUBOT': ['KINGKONG SERIES', 'P-SERIES'],
  'SHARP': ['AQUOS R9', 'AQUOS SENSE SERIES'],
  'TCL': ['TCL 60 SERIES', 'TCL 50 SERIES']
};

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
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');
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

  const filteredRateCards = (data?.rateCards || []).filter(card =>
    card.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.post<{ message: string, rateCard: RateCard }>('/ratecards', formData),
    onSuccess: (resData) => {
      toast.success('Rate card created!');
      setIsCreating(false);
      setNewBrand('');
      setNewModel('');
      setSelectedBrand('');
      setSelectedModel('');
      setCustomBrand('');
      setCustomModel('');
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
    const finalBrand = selectedBrand === 'Other' ? customBrand.trim() : selectedBrand.trim();
    const finalModel = (selectedBrand === 'Other' || selectedModel === 'Other') ? customModel.trim() : selectedModel.trim();

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
    saveServicesMutation.mutate({ id: selectedCard.id, services: validServices });

    if (editImageFile || editBrand !== selectedCard.brand || editModel !== selectedCard.model) {
      const fd = new FormData();
      if (editImageFile) fd.append('modelImage', editImageFile);
      fd.append('brand', editBrand);
      fd.append('model', editModel);
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
              <div className="space-y-1">
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    setSelectedModel('');
                    setCustomBrand('');
                    setCustomModel('');
                  }}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground select-custom cursor-pointer"
                >
                  <option value="" className="bg-neutral-900 text-white">Select Brand</option>
                  <option value="Other" className="bg-neutral-900 text-white">Other (Custom Brand)</option>
                  {Object.keys(DEVICE_BRANDS).map((b) => (
                    <option key={b} value={b} className="bg-neutral-900 text-white">{b}</option>
                  ))}
                </select>
              </div>

              {selectedBrand === 'Other' && (
                <Input
                  placeholder="Brand (e.g. Motorola)"
                  value={customBrand}
                  onChange={(e) => setCustomBrand(e.target.value)}
                  className="uppercase font-semibold text-foreground"
                />
              )}

              {selectedBrand && selectedBrand !== 'Other' && (
                <div className="space-y-1">
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      setCustomModel('');
                    }}
                    className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground select-custom cursor-pointer"
                  >
                    <option value="" className="bg-neutral-900 text-white">Select Model</option>
                    <option value="Other" className="bg-neutral-900 text-white">Other (Custom Model)</option>
                    {DEVICE_BRANDS[selectedBrand]?.map((m) => (
                      <option key={m} value={m} className="bg-neutral-900 text-white">{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {(selectedBrand === 'Other' || selectedModel === 'Other') && (
                <Input
                  placeholder="Model (e.g. G54)"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="uppercase font-semibold text-foreground"
                />
              )}
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
                    setSelectedBrand('');
                    setSelectedModel('');
                    setCustomBrand('');
                    setCustomModel('');
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
              filteredRateCards.map((card) => (
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
              <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-thin">
                <div className="min-w-[600px] space-y-4">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_100px_100px_100px_40px] gap-2 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Service Name</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">OG Cost (₹)</span>
                    <span translate="no" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider notranslate">Copy Cost (₹)</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ditto Cost (₹)</span>
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
                            value={svc.copy_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'copy_cost', parseFloat(e.target.value) || 0)}
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
                      <p className="text-sm font-black text-primary">₹{totalOgLabor.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Copy</p>
                      <p className="text-sm font-black text-rose-500">₹{totalCopyLabor.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Ditto</p>
                      <p className="text-sm font-black text-amber-500">₹{totalDittoLabor.toFixed(2)}</p>
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
