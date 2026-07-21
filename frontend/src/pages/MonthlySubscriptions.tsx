import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  User, 
  Phone, 
  Store, 
  IndianRupee, 
  Save, 
  RotateCcw, 
  Calendar, 
  Printer, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Building2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../lib/api';

interface CustomerSearchResult {
  customer_id?: string;
  customer_name: string;
  phone_number: string;
  shop_name: string;
}

interface MonthlyRecordData {
  id?: string;
  customer_id?: string | null;
  customer_name: string;
  phone_number: string;
  shop_name: string;
  year: number;
  january: number;
  february: number;
  march: number;
  april: number;
  may: number;
  june: number;
  july: number;
  august: number;
  september: number;
  october: number;
  november: number;
  december: number;
  total_received: number;
  notes?: string;
}

const MONTHS: { key: keyof Omit<MonthlyRecordData, 'id' | 'customer_id' | 'customer_name' | 'phone_number' | 'shop_name' | 'year' | 'total_received' | 'notes'>; label: string }[] = [
  { key: 'january', label: 'January' },
  { key: 'february', label: 'February' },
  { key: 'march', label: 'March' },
  { key: 'april', label: 'April' },
  { key: 'may', label: 'May' },
  { key: 'june', label: 'June' },
  { key: 'july', label: 'July' },
  { key: 'august', label: 'August' },
  { key: 'september', label: 'September' },
  { key: 'october', label: 'October' },
  { key: 'november', label: 'November' },
  { key: 'december', label: 'December' },
];

export default function MonthlySubscriptions() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Search Inputs
  const [nameSearch, setNameSearch] = useState<string>('');
  const [numberSearch, setNumberSearch] = useState<string>('');
  
  // Member & Shop details
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // 12 Months Payment Amounts
  const [amounts, setAmounts] = useState<Record<string, number>>({
    january: 0,
    february: 0,
    march: 0,
    april: 0,
    may: 0,
    june: 0,
    july: 0,
    august: 0,
    september: 0,
    october: 0,
    november: 0,
    december: 0,
  });

  // UI States
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  // Auto calculate total received amount for the year
  const totalReceivedAmount = useMemo(() => {
    return Object.values(amounts).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [amounts]);

  // Handle Search Execution
  const handleSearch = async (queryOverride?: string) => {
    const query = queryOverride !== undefined ? queryOverride : (nameSearch || numberSearch).trim();
    if (!query) {
      toast.error('Please enter a Name or Phone Number to search');
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiClient.get<{ data: CustomerSearchResult[] }>(
        `/subscriptions/search?search=${encodeURIComponent(query)}`
      );

      const results = response.data || [];
      setSearchResults(results);
      setShowDropdown(true);

      if (results.length === 1) {
        selectCustomer(results[0]);
      } else if (results.length === 0) {
        toast.error('No matching member/customer found');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      toast.error(err.message || 'Failed to search members');
    } finally {
      setIsSearching(false);
    }
  };

  // Select customer from search results and load record for selected year
  const selectCustomer = async (customer: CustomerSearchResult) => {
    setShowDropdown(false);
    setCustomerId(customer.customer_id || null);
    setCustomerName(customer.customer_name);
    setPhoneNumber(customer.phone_number);
    setShopName(customer.shop_name);
    setNameSearch(customer.customer_name);
    setNumberSearch(customer.phone_number);

    await loadSubscriptionRecord(customer.phone_number, customer.customer_id, selectedYear);
  };

  // Fetch record for selected member & year
  const loadSubscriptionRecord = async (phone: string, id: string | null | undefined, year: number) => {
    try {
      const query = id ? `customer_id=${id}&year=${year}` : `phone=${encodeURIComponent(phone)}&year=${year}`;
      const response = await apiClient.get<{ data: MonthlyRecordData }>(`/subscriptions/record?${query}`);
      const rec = response.data;

      if (rec) {
        setAmounts({
          january: Number(rec.january) || 0,
          february: Number(rec.february) || 0,
          march: Number(rec.march) || 0,
          april: Number(rec.april) || 0,
          may: Number(rec.may) || 0,
          june: Number(rec.june) || 0,
          july: Number(rec.july) || 0,
          august: Number(rec.august) || 0,
          september: Number(rec.september) || 0,
          october: Number(rec.october) || 0,
          november: Number(rec.november) || 0,
          december: Number(rec.december) || 0,
        });
        setNotes(rec.notes || '');
        if (rec.shop_name) setShopName(rec.shop_name);
        if (rec.customer_name) setCustomerName(rec.customer_name);
      }
    } catch (err: any) {
      console.error('Load record error:', err);
    }
  };

  // Re-fetch record when selectedYear changes if member is selected
  useEffect(() => {
    if (phoneNumber || customerId) {
      loadSubscriptionRecord(phoneNumber, customerId, selectedYear);
    }
  }, [selectedYear]);

  // Update specific month's amount
  const handleAmountChange = (monthKey: string, value: string) => {
    const numericValue = Math.max(0, parseFloat(value) || 0);
    setAmounts((prev) => ({
      ...prev,
      [monthKey]: numericValue,
    }));
  };

  // Save / Update register entry
  const handleSave = async () => {
    if (!customerName.trim() || !phoneNumber.trim()) {
      toast.error('Please specify a member name and phone number (search or fill manually)');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        customer_name: customerName,
        phone_number: phoneNumber,
        shop_name: shopName,
        year: selectedYear,
        january: amounts.january || 0,
        february: amounts.february || 0,
        march: amounts.march || 0,
        april: amounts.april || 0,
        may: amounts.may || 0,
        june: amounts.june || 0,
        july: amounts.july || 0,
        august: amounts.august || 0,
        september: amounts.september || 0,
        october: amounts.october || 0,
        november: amounts.november || 0,
        december: amounts.december || 0,
        notes: notes
      };

      await apiClient.post('/subscriptions/save', payload);
      toast.success(`Subscription register saved for ${customerName} (${selectedYear})`);
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || 'Failed to save subscription register');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setNameSearch('');
    setNumberSearch('');
    setCustomerId(null);
    setCustomerName('');
    setPhoneNumber('');
    setShopName('');
    setNotes('');
    setSearchResults([]);
    setShowDropdown(false);
    setAmounts({
      january: 0,
      february: 0,
      march: 0,
      april: 0,
      may: 0,
      june: 0,
      july: 0,
      august: 0,
      september: 0,
      october: 0,
      november: 0,
      december: 0,
    });
  };

  // Trigger browser print for physical register record
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Monthly Subscription Register</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Register and record monthly member subscription payments
              </p>
            </div>
          </div>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-2 bg-secondary/60 p-1.5 rounded-xl border border-border/60 self-start sm:self-auto">
          <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
          <span className="text-xs font-semibold text-muted-foreground">Year:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-card text-foreground font-bold text-sm px-3 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Search & Member Summary Section (Yellow Box 1 in Sketch) */}
      <div className="relative bg-gradient-to-br from-amber-500/10 via-card to-amber-500/5 border-2 border-amber-400/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-amber-300/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 className="text-base font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
              Member Search & Identification
            </h2>
          </div>
          {customerName && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/20 text-amber-800 dark:text-amber-200 rounded-full border border-amber-400/40">
              Active Member Loaded
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Name search */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" /> Name search
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter member name..."
                value={nameSearch}
                onChange={(e) => {
                  setNameSearch(e.target.value);
                  setCustomerName(e.target.value);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full bg-card text-foreground px-3.5 py-2.5 rounded-xl border border-border text-sm font-medium focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Number search */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-primary" /> Number search
            </label>
            <input
              type="text"
              placeholder="Enter phone number..."
              value={numberSearch}
              onChange={(e) => {
                setNumberSearch(e.target.value);
                setPhoneNumber(e.target.value);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-card text-foreground px-3.5 py-2.5 rounded-xl border border-border text-sm font-medium focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
            />
          </div>

          {/* Search Button */}
          <div className="md:col-span-4">
            <button
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.98]"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </button>
          </div>
        </div>

        {/* Autocomplete Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute left-6 right-6 top-[130px] z-30 bg-card border border-amber-400/80 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
            <div className="p-2 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border-b border-border">
              Select Member from Results:
            </div>
            {searchResults.map((res, idx) => (
              <div
                key={idx}
                onClick={() => selectCustomer(res)}
                className="p-3 hover:bg-amber-500/15 cursor-pointer border-b border-border/40 last:border-0 flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-bold text-foreground">{res.customer_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>📱 {res.phone_number}</span>
                    {res.shop_name && <span>• 🏬 {res.shop_name}</span>}
                  </p>
                </div>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">
                  Select
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Result Fields Display (Shop name & Total received amount) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-5 pt-4 border-t border-amber-300/40">
          {/* Shop name */}
          <div className="md:col-span-7 space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-amber-600" /> Shop name
            </label>
            <input
              type="text"
              placeholder="Shop or Business name..."
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full bg-card/90 text-foreground px-3.5 py-2.5 rounded-xl border border-border text-sm font-semibold focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Total received amount display box */}
          <div className="md:col-span-5 bg-gradient-to-r from-amber-500/20 to-emerald-500/20 border-2 border-amber-400 p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                Total received amount
              </p>
              <p className="text-[11px] text-muted-foreground">For Year {selectedYear}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300 tracking-tight">
                ₹{totalReceivedAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 12-Month Register Form (Yellow Box 2 in Sketch) */}
      <div className="bg-card border-2 border-amber-400/80 rounded-2xl overflow-hidden shadow-md">
        <div className="bg-amber-400/20 p-4 border-b border-amber-400/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            <h2 className="text-base font-bold text-foreground uppercase tracking-wide">
              Monthly Subscription Register ({selectedYear})
            </h2>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Type monthly payment amount in the fields below
          </span>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left & Right 12 Months Table Grid */}
            <div className="lg:col-span-12 space-y-3">
              <div className="grid grid-cols-12 bg-secondary/80 p-3 rounded-xl border border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-5 sm:col-span-4">Month Name</div>
                <div className="col-span-7 sm:col-span-8 text-right sm:text-left sm:pl-4">
                  Typing amount (₹)
                </div>
              </div>

              <div className="divide-y divide-border/60 border border-border rounded-xl overflow-hidden bg-card">
                {MONTHS.map((m) => (
                  <div
                    key={m.key}
                    className="grid grid-cols-12 p-3 items-center hover:bg-secondary/30 transition-colors"
                  >
                    {/* Left side: Month Label */}
                    <div className="col-span-5 sm:col-span-4 font-bold text-sm text-foreground flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      {m.label}
                    </div>

                    {/* Right side: Typing amount input */}
                    <div className="col-span-7 sm:col-span-8 flex items-center justify-end sm:justify-start sm:pl-4">
                      <div className="relative w-full max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          placeholder="0"
                          value={amounts[m.key] === 0 ? '' : amounts[m.key]}
                          onChange={(e) => handleAmountChange(m.key, e.target.value)}
                          className="w-full bg-background text-foreground font-bold text-base pl-8 pr-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-right sm:text-left transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Bottom Total Row (1 year Total amount in drawing) */}
                <div className="grid grid-cols-12 p-4 bg-amber-500/15 border-t-2 border-amber-400 items-center">
                  <div className="col-span-5 sm:col-span-4 text-base font-extrabold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
                    1 year Total amount
                  </div>
                  <div className="col-span-7 sm:col-span-8 text-right sm:text-left sm:pl-4">
                    <span className="text-2xl font-black text-amber-800 dark:text-amber-200 tracking-tight">
                      ₹{totalReceivedAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Register Notes */}
          <div className="mt-6 space-y-1.5">
            <label className="text-xs font-bold text-foreground">Register Notes / Remarks (Optional)</label>
            <textarea
              rows={2}
              placeholder="Add any notes regarding this year's subscription (e.g. Paid via Cash / UPI ref...)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-background text-foreground px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Form Action Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-sm font-semibold transition-all flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-sm font-semibold transition-all flex items-center gap-2"
              >
                <Printer className="h-4 w-4" /> Print Register
              </button>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-7 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-base font-bold transition-all flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98]"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Save Register Entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
