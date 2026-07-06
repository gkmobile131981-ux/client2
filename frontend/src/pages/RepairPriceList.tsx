import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Smartphone, BookOpen, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { apiClient } from '../lib/api';

interface RateCardService {
  id?: string;
  service_name: string;
  og_cost: number;
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

export default function RepairPriceList() {
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  // Fetch all rate cards
  const { data, isLoading, refetch, isFetching } = useQuery<{ rateCards: RateCard[] }>({
    queryKey: ['rate-cards'],
    queryFn: () => apiClient.get('/ratecards'),
  });

  const rateCards = data?.rateCards || [];

  // Get unique brands list from fetched cards (sorted alphabetically)
  const uniqueBrands = useMemo(() => {
    const brandsSet = new Set(rateCards.map((rc) => rc.brand.toUpperCase()));
    return Array.from(brandsSet).sort();
  }, [rateCards]);

  // Filter models based on selected brand
  const filteredModels = useMemo(() => {
    if (!selectedBrand) return [];
    return rateCards
      .filter((rc) => rc.brand.toUpperCase() === selectedBrand.toUpperCase())
      .sort((a, b) => a.model.localeCompare(b.model));
  }, [selectedBrand, rateCards]);

  // Find the selected rate card details
  const selectedRateCard = useMemo(() => {
    if (!selectedModelId) return null;
    return rateCards.find((rc) => rc.id === selectedModelId) || null;
  }, [selectedModelId, rateCards]);

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBrand(e.target.value);
    setSelectedModelId('');
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModelId(e.target.value);
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 text-foreground max-w-7xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span>Repair Price List</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Quickly query standard repair rates and device model photographs.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-secondary/15 hover:bg-secondary/40 text-xs font-bold text-foreground transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Sync Rates</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-semibold">Loading price list cards...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PANEL: Filters & Device image */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <Card className="bg-slate-900/40 border-border/80 shadow-lg">
              <CardHeader className="pb-4 border-b border-border/40">
                <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Device Search</CardTitle>
                <CardDescription>Select a device brand and model to pull the pricing sheet.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Brand Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary uppercase tracking-wider block">Brand</label>
                  <select
                    value={selectedBrand}
                    onChange={handleBrandChange}
                    className="w-full bg-slate-950 border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground cursor-pointer transition-all animate-none"
                  >
                    <option value="">Select Brand</option>
                    {uniqueBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary uppercase tracking-wider block">Model</label>
                  <select
                    value={selectedModelId}
                    onChange={handleModelChange}
                    disabled={!selectedBrand}
                    className="w-full bg-slate-950 border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground cursor-pointer transition-all disabled:opacity-50"
                  >
                    <option value="">Select Model</option>
                    {filteredModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.model.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Device Image Box */}
            <Card className="bg-slate-900/40 border-border/80 overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/40">
                <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Device Photo</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center p-6 bg-slate-950/20 min-h-[220px]">
                {selectedRateCard ? (
                  selectedRateCard.model_image_url ? (
                    <div className="relative rounded-xl overflow-hidden border border-border/60 max-h-[300px]">
                      <img
                        src={selectedRateCard.model_image_url}
                        alt={`${selectedRateCard.brand} ${selectedRateCard.model}`}
                        className="object-contain max-h-[260px] max-w-full rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
                      <div className="p-4 rounded-full bg-secondary/35 border border-border/60">
                        <Smartphone className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <span className="text-xs font-semibold">No model image uploaded.</span>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground/60 p-8">
                    <Smartphone className="h-12 w-12 stroke-[1.5]" />
                    <span className="text-xs font-medium text-center">Select model to view photos</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL: Price Table Sheet */}
          <div className="lg:col-span-7">
            {selectedRateCard ? (
              <Card className="bg-slate-900/40 border-border/80 shadow-lg">
                <CardHeader className="pb-4 border-b border-border/40 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-black text-white uppercase tracking-wider">
                      {selectedRateCard.brand} {selectedRateCard.model}
                    </CardTitle>
                    <CardDescription>Official repair service price schedule.</CardDescription>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-primary/20 text-primary border border-primary/30 tracking-wider">
                    {selectedRateCard.services.length} Services
                  </span>
                </CardHeader>
                <CardContent className="pt-6">
                  {selectedRateCard.services.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-border/60">
                      <table className="min-w-full divide-y divide-border/40">
                        <thead className="bg-secondary/15">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              Service Name
                            </th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              OG Cost (₹)
                            </th>
                            <th scope="col" translate="no" className="notranslate px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              Copy Cost (₹)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-transparent divide-y divide-border/30">
                          {selectedRateCard.services
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((service, idx) => (
                              <tr key={service.id || idx} className="hover:bg-secondary/10 transition-colors">
                                <td className="px-4 py-3 text-xs font-semibold text-white whitespace-nowrap">
                                  {service.service_name}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono font-bold text-emerald-400 text-right whitespace-nowrap">
                                  ₹ {Number(service.og_cost).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono font-bold text-pink-400 text-right whitespace-nowrap">
                                  ₹ {Number(service.copy_cost).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-xs text-muted-foreground font-medium">
                      No rates configured for this model yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-900/40 border-border/80 border-dashed py-20 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-secondary/15 border border-border/60 mb-4">
                  <BookOpen className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Pricing Sheet Lookup</h3>
                <p className="text-xs text-muted-foreground text-center max-w-sm px-6 leading-relaxed">
                  Choose a device from the selectors on the left side to display its registered servicing prices.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
