import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Smartphone, BookOpen, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { apiClient } from '../lib/api';
import { SearchSelect } from '../components/ui/SearchSelect';
import { DEVICE_BRANDS, DEFAULT_SERVICES, RateCard } from '../data/deviceCatalog';
import { findBestMatchingRateCard } from '../utils/modelMatching';

export default function RepairPriceList() {
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  // Fetch all rate cards
  const { data, isLoading, refetch, isFetching } = useQuery<{ rateCards: RateCard[] }>({
    queryKey: ['rate-cards'],
    queryFn: () => apiClient.get('/ratecards'),
  });

  const rateCards = data?.rateCards || [];

  // Get unique brands list from DB rate cards combined with predefined brands
  const uniqueBrands = useMemo(() => {
    const brandsSet = new Set([
      ...rateCards.map((rc) => rc.brand.toUpperCase()),
      ...Object.keys(DEVICE_BRANDS),
    ]);
    return Array.from(brandsSet).sort();
  }, [rateCards]);

  // Options for Brand SearchSelect
  const brandOptions = useMemo(() => {
    return uniqueBrands.map((b) => {
      const count = rateCards.filter((rc) => rc.brand.toUpperCase() === b).length;
      return {
        value: b,
        label: b,
        sublabel: count > 0 ? `${count} rate card${count > 1 ? 's' : ''} saved` : undefined,
      };
    });
  }, [uniqueBrands, rateCards]);

  // Filter models based on selected brand — DB rate cards take precedence, and any
  // catalog models without a saved card are still shown as selectable fallbacks
  const filteredModels = useMemo(() => {
    if (!selectedBrand) return [];

    const brandUpper = selectedBrand.toUpperCase();
    const dbByModel = new Map<string, string>();
    rateCards
      .filter((rc) => rc.brand.toUpperCase() === brandUpper)
      .forEach((rc) => dbByModel.set(rc.model.toUpperCase(), rc.id));

    const models: { id: string; model: string }[] = [];

    // 1. Models that already have a saved rate card (real DB id)
    Array.from(dbByModel.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([model]) => models.push({ id: dbByModel.get(model)!, model }));

    // 2. Catalog models without a saved rate card (fallback template)
    (DEVICE_BRANDS[brandUpper] || [])
      .filter((m) => !dbByModel.has(m.toUpperCase()))
      .sort((a, b) => a.localeCompare(b))
      .forEach((m) => models.push({ id: `fallback-${m}`, model: m }));

    return models;
  }, [selectedBrand, rateCards]);

  // Options for Model SearchSelect
  const modelOptions = useMemo(() => {
    return filteredModels.map((m) => ({
      value: m.id,
      label: m.model.toUpperCase(),
    }));
  }, [filteredModels]);

  // Build the active model (DB rate card or fallback template for models without a saved card)
  const activeModel = useMemo(() => {
    if (!selectedModelId) return null;
    if (selectedModelId.startsWith('fallback-')) {
      const model = selectedModelId.replace('fallback-', '');
      const matched = findBestMatchingRateCard(rateCards, selectedBrand, model);
      if (matched) return matched;
      return {
        brand: selectedBrand,
        model,
        model_image_url: null,
        services: DEFAULT_SERVICES,
      } as RateCard;
    }
    return rateCards.find((rc) => rc.id === selectedModelId) || null;
  }, [selectedModelId, selectedBrand, rateCards]);

  const isFallbackModel = !!selectedModelId && selectedModelId.startsWith('fallback-');

  // Show the template services for fallback models, DB services otherwise
  const activeServices = useMemo(() => {
    if (!activeModel) return [];
    return activeModel.services && activeModel.services.length > 0
      ? activeModel.services
      : DEFAULT_SERVICES;
  }, [activeModel]);

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
                <SearchSelect
                  label="Brand"
                  placeholder="Search brand (e.g. type V for Vivo)..."
                  options={brandOptions}
                  value={selectedBrand}
                  onChange={(val) => {
                    setSelectedBrand(val);
                    setSelectedModelId('');
                  }}
                  emptyMessage="No brand found starting with"
                />

                {/* Model Selector */}
                <SearchSelect
                  label="Model"
                  placeholder={!selectedBrand ? "Select a brand first" : "Search model (e.g. V20, iPhone 15)..."}
                  disabled={!selectedBrand}
                  options={modelOptions}
                  value={selectedModelId}
                  onChange={(val) => {
                    setSelectedModelId(val);
                  }}
                  emptyMessage="No model found matching"
                />
              </CardContent>
            </Card>

            {/* Device Image Box */}
            <Card className="bg-slate-900/40 border-border/80 overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/40">
                <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Device Photo</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center p-6 bg-slate-950/20 min-h-[220px]">

                {activeModel ? (
                  activeModel.model_image_url ? (
                    <div className="relative rounded-xl overflow-hidden border border-border/60 max-h-[300px]">
                      <img
                        src={activeModel.model_image_url}
                        alt={`${activeModel.brand} ${activeModel.model}`}
                        className="object-contain max-h-[260px] max-w-full rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
                      <div className="p-4 rounded-full bg-secondary/35 border border-border/60">
                        <Smartphone className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <span className="text-xs font-semibold">
                        {isFallbackModel ? 'No rate card or photo uploaded for this model yet.' : 'No model image uploaded.'}
                      </span>
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
            {activeModel ? (
              <Card className="bg-slate-900/40 border-border/80 shadow-lg">
                <CardHeader className="pb-4 border-b border-border/40 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-black text-white uppercase tracking-wider">
                      {activeModel.brand} {activeModel.model}
                    </CardTitle>
                    <CardDescription>Official repair service price schedule.</CardDescription>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-primary/20 text-primary border border-primary/30 tracking-wider">
                    {isFallbackModel ? 'Default Template' : `${activeModel.services.length} Configured`}
                  </span>
                </CardHeader>
                <CardContent className="pt-6">
                  {isFallbackModel && (
                    <div className="mb-4 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-[11px] font-semibold leading-relaxed">
                      No saved rate card for this model yet — showing the default template. Visit the
                      Rate Cards page to configure a custom pricing sheet.
                    </div>
                  )}
                  {activeServices.length > 0 ? (
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
                            <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              Ditto Cost (₹)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-transparent divide-y divide-border/30">
                          {[...activeServices]
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((service, idx) => (
                              <tr key={service.id || idx} className="hover:bg-secondary/10 transition-colors">
                                <td className="px-4 py-3 text-xs font-semibold text-white whitespace-nowrap">
                                  {service.service_name}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono font-bold text-emerald-400 text-right whitespace-nowrap">
                                  ₹ {Number(service.og_cost ?? 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono font-bold text-pink-400 text-right whitespace-nowrap">
                                  ₹ {Number(service.copy_cost ?? 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono font-bold text-sky-400 text-right whitespace-nowrap">
                                  ₹ {Number(service.ditto_cost ?? 0).toFixed(2)}
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
