import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Loader2,
  Building2,
  MessageCircle,
  BarChart3,
  ClipboardList,
  TrendingUp,
  ChevronDown,
  X,
  ExternalLink,
  Banknote,
  ArrowUpRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../lib/api';

// ─── Interfaces ────────────────────────────────────────────────────────────

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
  january: number; january_paid_at?: string | null;
  february: number; february_paid_at?: string | null;
  march: number; march_paid_at?: string | null;
  april: number; april_paid_at?: string | null;
  may: number; may_paid_at?: string | null;
  june: number; june_paid_at?: string | null;
  july: number; july_paid_at?: string | null;
  august: number; august_paid_at?: string | null;
  september: number; september_paid_at?: string | null;
  october: number; october_paid_at?: string | null;
  november: number; november_paid_at?: string | null;
  december: number; december_paid_at?: string | null;
  total_received: number;
  notes?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

const MONTHS = [
  { key: 'january',   label: 'January',   short: 'Jan' },
  { key: 'february',  label: 'February',  short: 'Feb' },
  { key: 'march',     label: 'March',     short: 'Mar' },
  { key: 'april',     label: 'April',     short: 'Apr' },
  { key: 'may',       label: 'May',       short: 'May' },
  { key: 'june',      label: 'June',      short: 'Jun' },
  { key: 'july',      label: 'July',      short: 'Jul' },
  { key: 'august',    label: 'August',    short: 'Aug' },
  { key: 'september', label: 'September', short: 'Sep' },
  { key: 'october',   label: 'October',   short: 'Oct' },
  { key: 'november',  label: 'November',  short: 'Nov' },
  { key: 'december',  label: 'December',  short: 'Dec' },
] as const;

type MonthKey = typeof MONTHS[number]['key'];

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatINR(v: number) {
  return v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate?: string | null) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function MonthlySubscriptions() {
  const currentYear = new Date().getFullYear();

  // ── Top-level state ──
  const [activeTab, setActiveTab] = useState<'register' | 'analytics'>('register');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // ── Register tab state ──
  const [nameSearch, setNameSearch]       = useState('');
  const [numberSearch, setNumberSearch]   = useState('');
  const [customerId, setCustomerId]       = useState<string | null>(null);
  const [customerName, setCustomerName]   = useState('');
  const [phoneNumber, setPhoneNumber]     = useState('');
  const [shopName, setShopName]           = useState('');
  const [notes, setNotes]                 = useState('');
  const [amounts, setAmounts]             = useState<Record<MonthKey, number>>(
    Object.fromEntries(MONTHS.map(m => [m.key, 0])) as Record<MonthKey, number>
  );
  const [paidDates, setPaidDates]         = useState<Record<MonthKey, string>>(
    Object.fromEntries(MONTHS.map(m => [m.key, ''])) as Record<MonthKey, string>
  );

  // ── UI state ──
  const [isSearching, setIsSearching]     = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [sendingBill, setSendingBill]     = useState<string | null>(null);
  const [recordId, setRecordId]           = useState<string | undefined>();

  // ── Analytics tab state ──
  const [summaryRecords, setSummaryRecords]           = useState<MonthlyRecordData[]>([]);
  const [loadingSummary, setLoadingSummary]           = useState(false);
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState<MonthKey | null>(null);

  // ── Live total ──
  const totalReceivedAmount = useMemo(
    () => MONTHS.reduce((s, m) => s + (Number(amounts[m.key]) || 0), 0),
    [amounts]
  );

  // ── Analytics computations ──
  const monthlyTotals = useMemo<Record<MonthKey, number>>(
    () => Object.fromEntries(
      MONTHS.map(m => [
        m.key,
        summaryRecords.reduce((s, r) => s + (Number((r as any)[m.key]) || 0), 0)
      ])
    ) as Record<MonthKey, number>,
    [summaryRecords]
  );

  const yearTotal = useMemo(
    () => MONTHS.reduce((s, m) => s + monthlyTotals[m.key], 0),
    [monthlyTotals]
  );

  const activeMonthRecords = useMemo(
    () => selectedAnalyticsMonth
      ? summaryRecords.filter(r => (Number((r as any)[selectedAnalyticsMonth]) || 0) > 0)
      : [],
    [summaryRecords, selectedAnalyticsMonth]
  );

  // ─── Load summary when analytics tab is opened or year changes ───
  const loadSummary = useCallback(async (year: number) => {
    setLoadingSummary(true);
    try {
      const res = await apiClient.get<{ data: MonthlyRecordData[] }>(`/subscriptions/summary?year=${year}`);
      setSummaryRecords(res.data || []);
    } catch (err: any) {
      toast.error('Failed to load analytics');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadSummary(selectedYear);
    }
  }, [activeTab, selectedYear, loadSummary]);

  // ─── Search ───────────────────────────────────────────────────────────
  const handleSearch = async (queryOverride?: string) => {
    const query = queryOverride !== undefined
      ? queryOverride
      : (nameSearch || numberSearch).trim();
    if (!query) {
      toast.error('Please enter a Name or Phone Number to search');
      return;
    }
    setIsSearching(true);
    try {
      const res = await apiClient.get<{ data: CustomerSearchResult[] }>(
        `/subscriptions/search?search=${encodeURIComponent(query)}`
      );
      const results = res.data || [];
      setSearchResults(results);
      setShowDropdown(results.length > 0);
      if (results.length === 1) selectCustomer(results[0]);
      else if (results.length === 0) toast.error('No matching member found');
    } catch (err: any) {
      toast.error(err.message || 'Failed to search');
    } finally {
      setIsSearching(false);
    }
  };

  const selectCustomer = async (c: CustomerSearchResult) => {
    setShowDropdown(false);
    setCustomerId(c.customer_id || null);
    setCustomerName(c.customer_name);
    setPhoneNumber(c.phone_number);
    setShopName(c.shop_name);
    setNameSearch(c.customer_name);
    setNumberSearch(c.phone_number);
    await loadRecord(c.phone_number, c.customer_id, selectedYear);
  };

  // ─── Load existing record ─────────────────────────────────────────────
  const loadRecord = async (phone: string, id: string | null | undefined, year: number) => {
    try {
      const q = id ? `customer_id=${id}&year=${year}` : `phone=${encodeURIComponent(phone)}&year=${year}`;
      const res = await apiClient.get<{ data: MonthlyRecordData }>(`/subscriptions/record?${q}`);
      const rec = res.data;
      if (rec) {
        setRecordId(rec.id);
        const newAmounts = {} as Record<MonthKey, number>;
        const newDates   = {} as Record<MonthKey, string>;
        MONTHS.forEach(m => {
          newAmounts[m.key] = Number((rec as any)[m.key]) || 0;
          newDates[m.key]   = (rec as any)[`${m.key}_paid_at`] || '';
        });
        setAmounts(newAmounts);
        setPaidDates(newDates);
        setNotes(rec.notes || '');
        if (rec.shop_name) setShopName(rec.shop_name);
        if (rec.customer_name) setCustomerName(rec.customer_name);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (phoneNumber || customerId) {
      loadRecord(phoneNumber, customerId, selectedYear);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  // ─── Amount change — auto-fill today's date ───────────────────────────
  const handleAmountChange = (monthKey: MonthKey, value: string) => {
    const num = Math.max(0, parseFloat(value) || 0);
    setAmounts(prev => ({ ...prev, [monthKey]: num }));
    if (num > 0 && !paidDates[monthKey]) {
      setPaidDates(prev => ({ ...prev, [monthKey]: todayISO() }));
    }
    if (num === 0) {
      setPaidDates(prev => ({ ...prev, [monthKey]: '' }));
    }
  };

  const handleDateChange = (monthKey: MonthKey, value: string) => {
    setPaidDates(prev => ({ ...prev, [monthKey]: value }));
  };

  // ─── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!customerName.trim() || !phoneNumber.trim()) {
      toast.error('Please specify a member name and phone number');
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        customer_id: customerId,
        customer_name: customerName,
        phone_number: phoneNumber,
        shop_name: shopName,
        year: selectedYear,
        notes,
      };
      MONTHS.forEach(m => {
        payload[m.key]              = amounts[m.key] || 0;
        payload[`${m.key}_paid_at`] = paidDates[m.key] || null;
      });

      const res = await apiClient.post<{ data: MonthlyRecordData }>('/subscriptions/save', payload);
      setRecordId(res.data?.id);
      toast.success(`Subscription saved for ${customerName} (${selectedYear})`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Send WhatsApp bill ───────────────────────────────────────────────
  const handleSendBill = async (monthKey: MonthKey, monthLabel: string) => {
    if (!customerName || !phoneNumber) {
      toast.error('Select a member first');
      return;
    }
    const amount = amounts[monthKey];
    if (!amount || amount <= 0) {
      toast.error(`No payment recorded for ${monthLabel}`);
      return;
    }
    setSendingBill(monthKey);
    try {
      const res = await apiClient.post<{ success: boolean; isSandbox?: boolean; whatsappUrl?: string }>(
        '/subscriptions/send-bill',
        {
          id: recordId,
          customer_name: customerName,
          phone_number: phoneNumber,
          shop_name: shopName,
          year: selectedYear,
          month_name: monthLabel,
          amount,
          total_received: totalReceivedAmount,
          notes,
        }
      );
      if (res.isSandbox && res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank');
        toast.success(`WhatsApp bill opened for ${monthLabel}`);
      } else {
        toast.success(`Bill sent to ${customerName} for ${monthLabel}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send bill');
    } finally {
      setSendingBill(null);
    }
  };

  // ─── Print ────────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ─── Reset ────────────────────────────────────────────────────────────
  const handleReset = () => {
    setNameSearch(''); setNumberSearch('');
    setCustomerId(null); setCustomerName(''); setPhoneNumber(''); setShopName(''); setNotes('');
    setSearchResults([]); setShowDropdown(false); setRecordId(undefined);
    const emptyAmounts = Object.fromEntries(MONTHS.map(m => [m.key, 0])) as Record<MonthKey, number>;
    const emptyDates   = Object.fromEntries(MONTHS.map(m => [m.key, ''])) as Record<MonthKey, string>;
    setAmounts(emptyAmounts);
    setPaidDates(emptyDates);
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-16 max-w-5xl mx-auto">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-xl">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Monthly Subscription Register</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Track member payments, dates, and revenue analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Year Selector */}
          <div className="flex items-center gap-1.5 bg-secondary/60 px-3 py-2 rounded-xl border border-border text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Year:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent text-foreground font-bold text-sm focus:outline-none"
            >
              {[2023,2024,2025,2026,2027,2028,2029,2030].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-1 bg-secondary/60 p-1 rounded-xl border border-border w-fit">
        <button
          onClick={() => setActiveTab('register')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'register'
              ? 'bg-card shadow-sm text-foreground border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Register Entry
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'analytics'
              ? 'bg-card shadow-sm text-foreground border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Analytics & Summary
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB 1 — REGISTER ENTRY
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'register' && (
        <div className="space-y-5">

          {/* ── Member Search Box ── */}
          <div className="relative bg-gradient-to-br from-amber-500/10 via-card to-amber-400/5 border-2 border-amber-400/70 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-amber-300/40 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h2 className="text-sm font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
                  Member Search & Identification
                </h2>
              </div>
              {customerName && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-400/40">
                  <CheckCircle2 className="h-3 w-3" /> Member Loaded
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* Name */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" /> Name search
                </label>
                <input
                  type="text"
                  placeholder="Enter member name..."
                  value={nameSearch}
                  onChange={e => { setNameSearch(e.target.value); setCustomerName(e.target.value); }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-card text-foreground px-3.5 py-2.5 rounded-xl border border-border text-sm font-medium focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                />
              </div>

              {/* Phone */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" /> Phone search
                </label>
                <input
                  type="text"
                  placeholder="Enter phone number..."
                  value={numberSearch}
                  onChange={e => { setNumberSearch(e.target.value); setPhoneNumber(e.target.value); }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-card text-foreground px-3.5 py-2.5 rounded-xl border border-border text-sm font-medium focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                />
              </div>

              {/* Search button */}
              <div className="md:col-span-4">
                <button
                  onClick={() => handleSearch()}
                  disabled={isSearching}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-sm disabled:opacity-60"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {isSearching ? 'Searching...' : 'Search Member'}
                </button>
              </div>
            </div>

            {/* Dropdown results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-5 right-5 top-[158px] z-30 bg-card border border-amber-400/80 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                <div className="px-3 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border-b border-border flex items-center justify-between">
                  Select Member from Results
                  <button onClick={() => setShowDropdown(false)}><X className="h-3.5 w-3.5" /></button>
                </div>
                {searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectCustomer(res)}
                    className="p-3 hover:bg-amber-500/15 cursor-pointer border-b border-border/40 last:border-0 flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="font-bold text-foreground">{res.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        📱 {res.phone_number}{res.shop_name && ` • 🏬 ${res.shop_name}`}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">Select</span>
                  </div>
                ))}
              </div>
            )}

            {/* Shop name & total row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4 pt-4 border-t border-amber-300/40">
              <div className="md:col-span-7 space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-amber-600" /> Shop / Business Name
                </label>
                <input
                  type="text"
                  placeholder="Shop or business name..."
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  className="w-full bg-card/90 text-foreground px-3.5 py-2.5 rounded-xl border border-border text-sm font-semibold focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="md:col-span-5 bg-gradient-to-r from-amber-500/20 to-emerald-500/20 border-2 border-amber-400 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    Year Total Received
                  </p>
                  <p className="text-[11px] text-muted-foreground">Auto-calculated for {selectedYear}</p>
                </div>
                <span className="text-2xl font-black text-amber-700 dark:text-amber-300 tracking-tight">
                  ₹{formatINR(totalReceivedAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* ── 12-Month Register Table ── */}
          <div className="bg-card border-2 border-amber-400/70 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-amber-400/20 px-5 py-3.5 border-b border-amber-400/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                  Monthly Payment Register — {selectedYear}
                </h2>
              </div>
              <span className="text-xs text-muted-foreground hidden sm:block">
                Enter amount & date for each paid month
              </span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 bg-secondary/80 px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
              <div className="col-span-3">Month</div>
              <div className="col-span-4 text-center">Amount (₹)</div>
              <div className="col-span-3 text-center">Payment Date</div>
              <div className="col-span-2 text-center">Bill</div>
            </div>

            <div className="divide-y divide-border/50">
              {MONTHS.map(m => {
                const isPaid = (amounts[m.key] || 0) > 0;
                return (
                  <div
                    key={m.key}
                    className={`grid grid-cols-12 items-center px-4 py-3 transition-colors ${
                      isPaid ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'hover:bg-secondary/30'
                    }`}
                  >
                    {/* Month label */}
                    <div className="col-span-3 flex items-center gap-2 font-bold text-sm text-foreground">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isPaid ? 'bg-emerald-500' : 'bg-border'
                      }`} />
                      <span>{m.label}</span>
                      {isPaid && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                    </div>

                    {/* Amount */}
                    <div className="col-span-4 flex items-center justify-center px-2">
                      <div className="relative w-full max-w-[140px]">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          placeholder="0"
                          value={amounts[m.key] === 0 ? '' : amounts[m.key]}
                          onChange={e => handleAmountChange(m.key, e.target.value)}
                          className="w-full bg-background text-foreground font-bold text-sm pl-7 pr-2 py-2 rounded-lg border border-border focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-right transition-all"
                        />
                      </div>
                    </div>

                    {/* Date */}
                    <div className="col-span-3 flex items-center justify-center px-2">
                      <input
                        type="date"
                        value={paidDates[m.key] || ''}
                        onChange={e => handleDateChange(m.key, e.target.value)}
                        disabled={!isPaid}
                        className="w-full text-xs bg-background text-foreground font-medium py-2 px-2 rounded-lg border border-border focus:ring-2 focus:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      />
                    </div>

                    {/* WhatsApp bill button */}
                    <div className="col-span-2 flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleSendBill(m.key, m.label)}
                        disabled={!isPaid || sendingBill === m.key}
                        title={`Send WhatsApp bill for ${m.label}`}
                        className="p-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {sendingBill === m.key
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <MessageCircle className="h-4 w-4" />
                        }
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Year Total Row */}
              <div className="grid grid-cols-12 px-4 py-4 bg-amber-500/15 border-t-2 border-amber-400 items-center">
                <div className="col-span-3 text-base font-extrabold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
                  1 Year Total
                </div>
                <div className="col-span-9">
                  <span className="text-2xl font-black text-amber-800 dark:text-amber-200 tracking-tight">
                    ₹{formatINR(totalReceivedAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Notes & Actions ── */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Register Notes / Remarks (Optional)</label>
              <textarea
                rows={2}
                placeholder="Add any notes (e.g. Paid via Cash / UPI ref...)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-card text-foreground px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-semibold transition-all"
                >
                  <RotateCcw className="h-4 w-4" /> Reset
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-semibold transition-all"
                >
                  <Printer className="h-4 w-4" /> Print Register
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-all disabled:opacity-60 shadow-lg shadow-primary/25"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save Register Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2 — ANALYTICS & SUMMARY
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">

          {/* ── Year Total Card ── */}
          <div className="bg-gradient-to-br from-amber-500/20 via-card to-amber-400/5 border-2 border-amber-500/60 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-2xl">
                <TrendingUp className="h-7 w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Subscription Revenue</p>
                <p className="text-4xl font-black text-amber-700 dark:text-amber-300 tracking-tight">
                  ₹{formatINR(yearTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summaryRecords.length} active subscriber{summaryRecords.length !== 1 ? 's' : ''} · Year {selectedYear}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-2xl font-black text-foreground">{summaryRecords.length}</p>
                <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">Members</p>
              </div>
              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-2xl font-black text-foreground">
                  {MONTHS.filter(m => monthlyTotals[m.key] > 0).length}
                </p>
                <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">Active Months</p>
              </div>
            </div>
          </div>

          {/* ── Monthly Revenue Grid ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Monthly Revenue Breakdown — {selectedYear}</h2>
            </div>

            {loadingSummary ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading analytics...</span>
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div className="grid grid-cols-12 bg-secondary/60 px-5 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <div className="col-span-3">Month</div>
                  <div className="col-span-3 text-right">Revenue</div>
                  <div className="col-span-3 text-center">Subscribers</div>
                  <div className="col-span-3 text-right">View</div>
                </div>

                <div className="divide-y divide-border/40">
                  {MONTHS.map(m => {
                    const total = monthlyTotals[m.key];
                    const count = summaryRecords.filter(r => (Number((r as any)[m.key]) || 0) > 0).length;
                    const isSelected = selectedAnalyticsMonth === m.key;
                    return (
                      <div key={m.key}>
                        <div
                          className={`grid grid-cols-12 items-center px-5 py-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary/10 border-l-4 border-l-primary'
                              : total > 0
                                ? 'hover:bg-secondary/50'
                                : 'opacity-50'
                          }`}
                          onClick={() => setSelectedAnalyticsMonth(isSelected ? null : m.key)}
                        >
                          {/* Month */}
                          <div className="col-span-3 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${total > 0 ? 'bg-emerald-500' : 'bg-border'}`} />
                            <span className="font-bold text-sm text-foreground">{m.label}</span>
                          </div>

                          {/* Revenue */}
                          <div className="col-span-3 text-right">
                            <span className={`text-base font-black ${total > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                              {total > 0 ? `₹${formatINR(total)}` : '—'}
                            </span>
                          </div>

                          {/* Subscriber count */}
                          <div className="col-span-3 text-center">
                            {count > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                                <Store className="h-3 w-3" /> {count}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>

                          {/* Toggle */}
                          <div className="col-span-3 flex justify-end">
                            {total > 0 && (
                              <span className={`text-xs font-semibold px-2 py-1 rounded-lg transition-all ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary text-muted-foreground hover:text-foreground'
                              }`}>
                                {isSelected ? 'Close' : 'View Shops'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded shops list */}
                        {isSelected && activeMonthRecords.length > 0 && (
                          <div className="px-5 pb-4 bg-primary/5 border-b border-border">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide pt-3 pb-2">
                              Shops that paid in {m.label} {selectedYear}
                            </p>
                            <div className="space-y-2">
                              {activeMonthRecords.map((rec, idx) => (
                                <div
                                  key={rec.id || idx}
                                  className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
                                      <Store className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-sm text-foreground truncate">{rec.customer_name}</p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        📱 {rec.phone_number}
                                        {rec.shop_name && <span> · 🏬 {rec.shop_name}</span>}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="text-right">
                                      <p className="font-black text-base text-emerald-600 dark:text-emerald-400">
                                        ₹{formatINR(Number((rec as any)[m.key]) || 0)}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground">
                                        {formatDisplayDate((rec as any)[`${m.key}_paid_at`])}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Year Total */}
                <div className="grid grid-cols-12 items-center px-5 py-4 bg-amber-500/15 border-t-2 border-amber-400">
                  <div className="col-span-3 font-extrabold text-base text-amber-900 dark:text-amber-300 uppercase">
                    Year Total
                  </div>
                  <div className="col-span-3 text-right font-black text-xl text-amber-800 dark:text-amber-200">
                    ₹{formatINR(yearTotal)}
                  </div>
                  <div className="col-span-3 text-center">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {summaryRecords.length} members
                    </span>
                  </div>
                  <div className="col-span-3" />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
