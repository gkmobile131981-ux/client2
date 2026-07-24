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
  ArrowUpRight,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Lock,
  ShieldAlert,
  Clock,
  UserCheck,
  Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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

interface SubscriptionMember {
  id: string;
  shop_id: string;
  member_name: string;
  phone_number: string;
  shop_name: string;
  address?: string | null;
  notes?: string | null;
  subscription_start_date?: string | null;
  is_active: boolean;
  year_total_received?: number;
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
  return (v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate?: string | null) {
  if (!isoDate) return '—';
  try {
    const parts = isoDate.slice(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  } catch {
    return isoDate;
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export default function MonthlySubscriptions() {
  const currentYear = new Date().getFullYear();
  const { role } = useAuth();
  const isAdmin = role === 'owner';

  const startYear = Math.min(2024, currentYear - 2);
  const endYear = currentYear + 15;
  const yearsArray = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  // ── Top-level state ──
  const [activeTab, setActiveTab] = useState<'register' | 'members' | 'analytics'>('register');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // ── Register tab state ──
  const [nameSearch, setNameSearch]       = useState('');
  const [numberSearch, setNumberSearch]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expenses, setExpenses] = useState<Record<MonthKey, number>>(
    Object.fromEntries(MONTHS.map(m => [m.key, 0])) as Record<MonthKey, number>
  );
  const [savingMonthExpense, setSavingMonthExpense] = useState<Record<MonthKey, boolean>>(
    Object.fromEntries(MONTHS.map(m => [m.key, false])) as Record<MonthKey, boolean>
  );
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

  // ── Members & Shops tab state (Admin CRUD) ──
  const [membersList, setMembersList]     = useState<SubscriptionMember[]>([]);
  const [allMembers, setAllMembers]       = useState<SubscriptionMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch]   = useState('');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<SubscriptionMember | null>(null);

  // Member Form State
  const [formMemberName, setFormMemberName] = useState('');
  const [formPhoneNumber, setFormPhoneNumber] = useState('');
  const [formShopName, setFormShopName]     = useState('');
  const [formAddress, setFormAddress]       = useState('');
  const [formNotes, setFormNotes]           = useState('');
  const [formStartDate, setFormStartDate]   = useState(todayISO());
  const [isSavingMember, setIsSavingMember] = useState(false);

  // ── Shop Details & Audit Modal State ──
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [loadingAudit, setLoadingAudit]         = useState(false);
  const [auditMemberInfo, setAuditMemberInfo]   = useState<any | null>(null);
  const [auditRecords, setAuditRecords]         = useState<MonthlyRecordData[]>([]);
  const [auditLifetimeTotal, setAuditLifetimeTotal] = useState<number>(0);
  const [auditSelectedYear, setAuditSelectedYear] = useState<number>(currentYear);

  // ── Analytics tab state ──
  const [summaryRecords, setSummaryRecords]           = useState<MonthlyRecordData[]>([]);
  const [loadingSummary, setLoadingSummary]           = useState(false);
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState<MonthKey | null>(null);

  // ── Live total for register form ──
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

  const yearTotalTaken = useMemo(
    () => MONTHS.reduce((s, m) => s + (expenses[m.key] || 0), 0),
    [expenses]
  );

  const activeMonthRecords = useMemo(
    () => selectedAnalyticsMonth
      ? summaryRecords.filter(r => (Number((r as any)[selectedAnalyticsMonth]) || 0) > 0)
      : [],
    [summaryRecords, selectedAnalyticsMonth]
  );

  const filteredMembers = useMemo(() => {
    const q = nameSearch.trim().toLowerCase();
    if (!q) return [];

    const matches = allMembers.filter(m => 
      m.member_name.toLowerCase().includes(q) || 
      m.phone_number.toLowerCase().includes(q) ||
      (m.shop_name && m.shop_name.toLowerCase().includes(q))
    );

    return matches.sort((a, b) => {
      const aName = a.member_name.toLowerCase();
      const bName = b.member_name.toLowerCase();
      const aPhone = a.phone_number.toLowerCase();
      const bPhone = b.phone_number.toLowerCase();

      const aStartsWith = aName.startsWith(q) || aPhone.startsWith(q);
      const bStartsWith = bName.startsWith(q) || bPhone.startsWith(q);

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      const aWordStart = aName.split(/\s+/).some(w => w.startsWith(q));
      const bWordStart = bName.split(/\s+/).some(w => w.startsWith(q));

      if (aWordStart && !bWordStart) return -1;
      if (!aWordStart && bWordStart) return 1;

      return aName.localeCompare(bName);
    });
  }, [nameSearch, allMembers]);

  const clientSearchResults = useMemo<CustomerSearchResult[]>(() => {
    return filteredMembers.map(m => ({
      customer_id: m.id,
      customer_name: m.member_name,
      phone_number: m.phone_number,
      shop_name: m.shop_name
    }));
  }, [filteredMembers]);

  // ─── Loaders ───────────────────────────────────────────────────────────

  const loadSummary = useCallback(async (year: number) => {
    setLoadingSummary(true);
    try {
      const res = await apiClient.get<{ data: MonthlyRecordData[] }>(`/subscriptions/summary?year=${year}`);
      setSummaryRecords(res.data || []);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadExpenses = useCallback(async (year: number) => {
    try {
      const res = await apiClient.get<{ data: Array<{ month: string; amount_taken: number }> }>(`/subscriptions/expenses?year=${year}`);
      const mapped = Object.fromEntries(MONTHS.map(m => [m.key, 0])) as Record<MonthKey, number>;
      if (res.data) {
        res.data.forEach(item => {
          if (item.month in mapped) {
            mapped[item.month as MonthKey] = Number(item.amount_taken) || 0;
          }
        });
      }
      setExpenses(mapped);
    } catch {
      // Silently handle
    }
  }, []);

  const loadMembers = useCallback(async (search: string = '', year: number = currentYear) => {
    setLoadingMembers(true);
    try {
      const res = await apiClient.get<{ data: SubscriptionMember[] }>(
        `/subscriptions/members?search=${encodeURIComponent(search)}&year=${year}`
      );
      setMembersList(res.data || []);
    } catch {
      toast.error('Failed to load members list');
    } finally {
      setLoadingMembers(false);
    }
  }, [currentYear]);

  const handleSaveExpense = async (month: MonthKey, amountTaken: number, totalReceived: number) => {
    setSavingMonthExpense(prev => ({ ...prev, [month]: true }));
    try {
      await apiClient.post('/subscriptions/expenses', {
        year: selectedYear,
        month,
        amount_taken: amountTaken,
        total_received: totalReceived
      });
      toast.success(`Expense saved for ${month.toUpperCase()}`);
      await loadExpenses(selectedYear);
    } catch {
      toast.error('Failed to save expense');
    } finally {
      setSavingMonthExpense(prev => ({ ...prev, [month]: false }));
    }
  };

  const loadAllMembers = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: SubscriptionMember[] }>(
        `/subscriptions/members?search=&year=${selectedYear}`
      );
      setAllMembers(res.data || []);
    } catch {
      // Silently handle
    }
  }, [selectedYear]);

  useEffect(() => {
    loadSummary(selectedYear);
    loadExpenses(selectedYear);
    loadAllMembers();
    if (activeTab === 'members') {
      loadMembers(memberSearch, selectedYear);
    }
  }, [selectedYear, activeTab, loadSummary, loadExpenses, loadAllMembers, loadMembers, memberSearch]);

  // Execute search automatically when debounced search term changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(nameSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [nameSearch]);

  useEffect(() => {
    if (debouncedSearch.length >= 1) {
      handleSearch(debouncedSearch);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [debouncedSearch]);

  // ─── Search Customers / Members ─────────────────────────────────────────

  const handleSearch = async (term: string) => {
    if (!term || term.trim().length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await apiClient.get<{ data: CustomerSearchResult[] }>(
        `/subscriptions/search?search=${encodeURIComponent(term.trim())}`
      );
      setSearchResults(res.data || []);
      setShowDropdown(true);
    } catch {
      toast.error('Error searching members');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCustomer = async (item: CustomerSearchResult) => {
    setCustomerId(item.customer_id || null);
    setCustomerName(item.customer_name);
    setPhoneNumber(item.phone_number);
    setShopName(item.shop_name);
    setNameSearch(''); // Clear search input
    setNumberSearch('');
    setShowDropdown(false);

    await loadSubscriptionRecord(item.phone_number, item.customer_id, selectedYear);
  };

  const loadSubscriptionRecord = async (phone: string, custId?: string | null, year: number = selectedYear) => {
    try {
      const queryParam = phone ? `phone=${encodeURIComponent(phone)}` : `customer_id=${custId}`;
      const res = await apiClient.get<{ data: MonthlyRecordData }>(
        `/subscriptions/record?${queryParam}&year=${year}`
      );

      if (res.data) {
        setRecordId(res.data.id);
        if (res.data.customer_name) setCustomerName(res.data.customer_name);
        if (res.data.shop_name) setShopName(res.data.shop_name);
        if (res.data.notes) setNotes(res.data.notes);

        const newAmounts: Record<MonthKey, number> = {} as any;
        const newPaidDates: Record<MonthKey, string> = {} as any;

        MONTHS.forEach(m => {
          newAmounts[m.key] = Number((res.data as any)[m.key]) || 0;
          newPaidDates[m.key] = (res.data as any)[`${m.key}_paid_at`] || '';
        });

        setAmounts(newAmounts);
        setPaidDates(newPaidDates);
        toast.success(`Loaded subscription record for ${year}`);
      }
    } catch {
      toast.error('Failed to load subscription record');
    }
  };

  const handleAmountChange = (key: MonthKey, val: string) => {
    const num = parseFloat(val) || 0;
    setAmounts(prev => ({ ...prev, [key]: num }));

    if (num > 0 && !paidDates[key]) {
      setPaidDates(prev => ({ ...prev, [key]: todayISO() }));
    } else if (num === 0) {
      setPaidDates(prev => ({ ...prev, [key]: '' }));
    }
  };

  const handleDateChange = (key: MonthKey, dateVal: string) => {
    setPaidDates(prev => ({ ...prev, [key]: dateVal }));
  };

  const handleSaveRecord = async () => {
    if (!customerName.trim() || !phoneNumber.trim()) {
      toast.error('Please enter customer name and phone number');
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
        notes: notes,
        ...amounts
      };

      MONTHS.forEach(m => {
        payload[`${m.key}_paid_at`] = paidDates[m.key] || null;
      });

      const res = await apiClient.post<{ message: string; data: MonthlyRecordData }>(
        '/subscriptions/save',
        payload
      );

      if (res.data) {
        setRecordId(res.data.id);
      }
      toast.success('Subscription record saved successfully!');
      loadSummary(selectedYear);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save subscription record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetForm = () => {
    setNameSearch('');
    setNumberSearch('');
    setCustomerId(null);
    setCustomerName('');
    setPhoneNumber('');
    setShopName('');
    setNotes('');
    setRecordId(undefined);
    setAmounts(Object.fromEntries(MONTHS.map(m => [m.key, 0])) as Record<MonthKey, number>);
    setPaidDates(Object.fromEntries(MONTHS.map(m => [m.key, ''])) as Record<MonthKey, string>);
    toast.success('Form cleared');
  };

  const handleSendBill = async (monthKey: MonthKey, monthLabel: string) => {
    const amt = amounts[monthKey];
    if (!amt || amt <= 0) {
      toast.error(`No payment recorded for ${monthLabel}`);
      return;
    }

    if (!phoneNumber) {
      toast.error('Phone number required to send WhatsApp bill');
      return;
    }

    setSendingBill(monthKey);
    try {
      const res = await apiClient.post<{ message: string; success: boolean; whatsappUrl?: string }>(
        '/subscriptions/send-bill',
        {
          id: recordId,
          customer_name: customerName,
          phone_number: phoneNumber,
          shop_name: shopName,
          year: selectedYear,
          month_name: monthLabel,
          amount: amt,
          total_received: totalReceivedAmount,
          notes: notes
        }
      );

      toast.success(`WhatsApp bill generated for ${monthLabel}!`);
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send WhatsApp bill');
    } finally {
      setSendingBill(null);
    }
  };

  // ─── Member CRUD Handlers (Admin Only) ──────────────────────────────────

  const openCreateMemberModal = () => {
    if (!isAdmin) {
      toast.error('Admin Access Required to register members');
      return;
    }
    setEditingMember(null);
    setFormMemberName('');
    setFormPhoneNumber('');
    setFormShopName('');
    setFormAddress('');
    setFormNotes('');
    setFormStartDate(todayISO());
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (m: SubscriptionMember) => {
    if (!isAdmin) {
      toast.error('Admin Access Required to edit members');
      return;
    }
    setEditingMember(m);
    setFormMemberName(m.member_name);
    setFormPhoneNumber(m.phone_number);
    setFormShopName(m.shop_name);
    setFormAddress(m.address || '');
    setFormNotes(m.notes || '');
    setFormStartDate(m.subscription_start_date || todayISO());
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!formMemberName.trim() || !formPhoneNumber.trim() || !formShopName.trim()) {
      toast.error('Member name, phone, and shop name are required');
      return;
    }

    setIsSavingMember(true);
    try {
      const payload = {
        member_name: formMemberName.trim(),
        phone_number: formPhoneNumber.trim(),
        shop_name: formShopName.trim(),
        address: formAddress.trim(),
        notes: formNotes.trim(),
        subscription_start_date: formStartDate
      };

      if (editingMember) {
        await apiClient.put(`/subscriptions/members/${editingMember.id}`, payload);
        toast.success('Member details updated successfully');
      } else {
        await apiClient.post('/subscriptions/members', payload);
        toast.success('New Member & Shop registered successfully');
      }

      setIsMemberModalOpen(false);
      loadMembers(memberSearch, selectedYear);
      loadAllMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save member details');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!isAdmin) {
      toast.error('Admin Access Required');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete member "${name}"?`)) return;

    try {
      await apiClient.delete(`/subscriptions/members/${id}`);
      toast.success(`Member "${name}" removed`);
      loadMembers(memberSearch, selectedYear);
      loadAllMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete member');
    }
  };

  // ─── Shop Details & Audit History Modal Handlers ───────────────────────

  const openShopAudit = async (phone: string, shop_name: string, member_id?: string) => {
    setIsAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const res = await apiClient.get<{ member: any; records: MonthlyRecordData[]; lifetime_total_received: number }>(
        `/subscriptions/shop-history?phone=${encodeURIComponent(phone)}&shop_name=${encodeURIComponent(shop_name)}&member_id=${member_id || ''}`
      );
      setAuditMemberInfo(res.member);
      setAuditRecords(res.records || []);
      setAuditLifetimeTotal(res.lifetime_total_received || 0);
    } catch {
      toast.error('Failed to load shop subscription audit history');
    } finally {
      setLoadingAudit(false);
    }
  };

  const selectedAuditYearRecord = useMemo(() => {
    return auditRecords.find(r => r.year === auditSelectedYear);
  }, [auditRecords, auditSelectedYear]);

  // Quick switch from Audit Modal or Members table to Register Form
  const loadMemberIntoRegister = (mem: { member_name: string; phone_number: string; shop_name: string }) => {
    setNameSearch(mem.member_name);
    setNumberSearch(mem.phone_number);
    setCustomerName(mem.member_name);
    setPhoneNumber(mem.phone_number);
    setShopName(mem.shop_name);
    setActiveTab('register');
    loadSubscriptionRecord(mem.phone_number, null, selectedYear);
    setIsAuditModalOpen(false);
  };

  return (
    <div className="space-y-6">

      {/* ─── Top Header & Year Selector ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl text-black font-extrabold shadow-md shadow-amber-500/20">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Monthly Subscription Register
              </h2>
              <p className="text-muted-foreground text-xs font-semibold">
                Record and manage monthly member subscription payments & shop audit history
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Year Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-secondary/40 border border-border/80 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => setActiveTab('register')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" /> Register
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'members'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Store className="h-3.5 w-3.5" /> Members & Shops
              {!isAdmin && <Lock className="h-3 w-3 text-amber-400 ml-0.5" />}
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Analytics
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5">
            <Calendar className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-muted-foreground uppercase">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent text-sm font-black text-foreground focus:outline-none cursor-pointer"
            >
              {yearsArray.map(y => (
                <option key={y} value={y} className="bg-card text-foreground font-bold">{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB 1: REGISTER PAYMENT FORM
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'register' && (
        <div className="space-y-6">

          {/* Member Search & Info Header Card */}
          <div className="bg-card/90 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-amber-400" /> Member Registration & Identification
              </span>
              {phoneNumber && (
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active Member Loaded
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end relative">
              <div className="md:col-span-9 relative">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">
                  Quick Member Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search registered member name, number, or shop..."
                    value={nameSearch}
                    onChange={(e) => {
                      setNameSearch(e.target.value);
                    }}
                    className="w-full bg-secondary/35 border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="md:col-span-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSearch(nameSearch)}
                  disabled={isSearching}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="bg-secondary/60 hover:bg-secondary text-foreground p-2.5 rounded-xl border border-border transition-all cursor-pointer"
                  title="Clear Form"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              {/* Search Dropdown Overlay */}
              {nameSearch.trim().length >= 1 && clientSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-amber-500/40 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                  {clientSearchResults.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectCustomer(item)}
                      className="p-3 hover:bg-amber-500/10 cursor-pointer border-b border-border/40 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-extrabold text-sm text-foreground">{item.customer_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>📱 {item.phone_number}</span>
                          {item.shop_name && <span>🏬 {item.shop_name}</span>}
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-amber-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Member Details Readout */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-t-amber-500/10">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Shop Name</label>
                <input
                  type="text"
                  placeholder="Enter shop name..."
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full bg-secondary/20 border border-border/60 rounded-lg px-3 py-1.5 text-sm font-extrabold text-foreground"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Customer Name</label>
                <input
                  type="text"
                  placeholder="Enter customer name..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-secondary/20 border border-border/60 rounded-lg px-3 py-1.5 text-sm font-extrabold text-foreground"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Phone Number</label>
                <input
                  type="text"
                  placeholder="Enter phone number..."
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-secondary/20 border border-border/60 rounded-lg px-3 py-1.5 text-sm font-extrabold text-foreground"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider block">
                    {phoneNumber ? 'Member Year Total' : 'Total Received Amount'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {phoneNumber ? `Loaded Shop Total` : `All Shops Total (Year ${selectedYear})`}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-amber-400">
                    ₹{formatINR(phoneNumber ? totalReceivedAmount : yearTotal)}
                  </div>
                  {phoneNumber && (
                    <div className="text-[10px] text-muted-foreground font-semibold">
                      All Shops Year Total: ₹{formatINR(yearTotal)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Month Payments Grid Form */}
          <div className="bg-card/90 border border-border rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <span className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Banknote className="h-4 w-4 text-amber-500" /> Monthly Payment Entry ({selectedYear})
              </span>
              <span className="text-xs text-muted-foreground font-medium">Type payment amounts & timestamps below</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MONTHS.map((m) => {
                const isPaid = (amounts[m.key] || 0) > 0;
                return (
                  <div
                    key={m.key}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isPaid
                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
                        : 'bg-secondary/25 border-border/60 hover:border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase text-foreground flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                        {m.label}
                      </span>

                      {isPaid && (
                        <button
                          type="button"
                          onClick={() => handleSendBill(m.key, m.label)}
                          disabled={sendingBill === m.key}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer"
                          title="Send WhatsApp Bill"
                        >
                          {sendingBill === m.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                          Bill
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={amounts[m.key] || ''}
                          onChange={(e) => handleAmountChange(m.key, e.target.value)}
                          className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-1.5 text-sm font-extrabold text-foreground focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      {isPaid && (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                          <Clock className="h-3 w-3 text-emerald-400" />
                          <span>Paid Date:</span>
                          <input
                            type="date"
                            value={paidDates[m.key] || todayISO()}
                            onChange={(e) => handleDateChange(m.key, e.target.value)}
                            className="bg-background border border-border/80 rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Action Footer */}
            <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Add notes / remark for this subscription..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full sm:w-96 bg-secondary/35 border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveRecord}
                disabled={isSaving}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider px-6 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Subscription Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 2: REGISTERED MEMBERS & SHOPS (ADMIN CRUD + AUDIT)
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <div className="space-y-6">

          {/* Admin Restricted Access Warning Banner */}
          {!isAdmin ? (
            <div className="p-6 bg-amber-500/10 border border-amber-500/40 rounded-2xl flex flex-col items-center text-center gap-3">
              <div className="p-3 bg-amber-500/20 rounded-full text-amber-400">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-400">Admin Restricted Access</h3>
                <p className="text-sm text-muted-foreground max-w-lg mt-1">
                  Member & shop CRUD registration operations are restricted to Shop Owners/Admins. Staff members can view shop histories and record subscription payments in the Register tab.
                </p>
              </div>
            </div>
          ) : null}

          {/* Members Table Card */}
          <div className="bg-card/90 border border-border rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
              <div>
                <h3 className="text-base font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Store className="h-5 w-5 text-amber-500" />
                  Registered Association Members & Shops ({membersList.length})
                </h3>
                <p className="text-xs text-muted-foreground font-semibold">
                  Manage member database records & view comprehensive shop audit histories
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search name, phone, shop..."
                    value={memberSearch}
                    onChange={(e) => {
                      setMemberSearch(e.target.value);
                      loadMembers(e.target.value, selectedYear);
                    }}
                    className="w-full bg-secondary/35 border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-amber-500 font-semibold"
                  />
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={openCreateMemberModal}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Register Member
                  </button>
                )}
              </div>
            </div>

            {/* Table Content */}
            {loadingMembers ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                <span className="text-xs font-semibold">Loading members & shop directory...</span>
              </div>
            ) : membersList.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground space-y-2">
                <Store className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold text-foreground">No registered members found</p>
                <p className="text-xs">Click "Register Member" above to add your first association member & shop.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-secondary/30 text-muted-foreground uppercase font-black text-[10px] tracking-wider">
                      <th className="p-3">Member Name</th>
                      <th className="p-3">Shop Name & Address</th>
                      <th className="p-3">Phone Number</th>
                      <th className="p-3">Joined Date</th>
                      <th className="p-3 text-right">Year Total ({selectedYear})</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {membersList.map((m) => (
                      <tr key={m.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3 font-extrabold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500">
                              <User className="h-3.5 w-3.5" />
                            </div>
                            <span>{m.member_name}</span>
                          </div>
                        </td>

                        <td className="p-3 font-bold text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{m.shop_name}</span>
                          </div>
                          {m.address && <div className="text-[10px] text-muted-foreground pl-5">{m.address}</div>}
                        </td>

                        <td className="p-3 font-semibold text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>📱 {m.phone_number}</span>
                            <a
                              href={`https://wa.me/91${m.phone_number.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:text-emerald-300"
                              title="WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </td>

                        <td className="p-3 font-medium text-muted-foreground">
                          {formatDisplayDate(m.subscription_start_date)}
                        </td>

                        <td className="p-3 text-right font-black text-sm text-emerald-400">
                          ₹{formatINR(m.year_total_received || 0)}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Audit Details Button */}
                            <button
                              type="button"
                              onClick={() => openShopAudit(m.phone_number, m.shop_name, m.id)}
                              className="p-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all cursor-pointer"
                              title="View Shop Details & Audit History"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* Load into Register */}
                            <button
                              type="button"
                              onClick={() => loadMemberIntoRegister(m)}
                              className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg transition-all cursor-pointer"
                              title="Register Payment"
                            >
                              <Banknote className="h-3.5 w-3.5" />
                            </button>

                            {/* Admin Edit */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => openEditMemberModal(m)}
                                className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg transition-all cursor-pointer"
                                title="Edit Member (Admin)"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Admin Delete */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMember(m.id, m.member_name)}
                                className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-lg transition-all cursor-pointer"
                                title="Delete Member (Admin)"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 3: ANALYTICS & SUMMARY
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">

          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 bg-card/90 border border-border rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider block">Total Members</span>
                <span className="text-3xl font-black text-foreground mt-1 block">{summaryRecords.length}</span>
              </div>
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <Store className="h-6 w-6" />
              </div>
            </div>

            <div className="p-5 bg-card/90 border border-border rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider block">Year Total Collected</span>
                <span className="text-3xl font-black text-emerald-400 mt-1 block">₹{formatINR(yearTotal)}</span>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <IndianRupee className="h-6 w-6" />
              </div>
            </div>

            <div className="p-5 bg-card/90 border border-border rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider block">Total Amount Taken</span>
                <span className="text-3xl font-black text-rose-400 mt-1 block">₹{formatINR(yearTotalTaken)}</span>
              </div>
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                <ArrowUpRight className="h-6 w-6" />
              </div>
            </div>

            <div className="p-5 bg-card/90 border border-border rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider block">Yearly Remaining Balance</span>
                <span className="text-3xl font-black text-sky-400 mt-1 block">₹{formatINR(yearTotal - yearTotalTaken)}</span>
              </div>
              <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                <Banknote className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Monthly Collection Matrix */}
          <div className="bg-card/90 border border-border rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <span className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-amber-500" /> Monthly Collection Breakdown ({selectedYear})
              </span>
              <span className="text-xs text-muted-foreground">Click any month to expand paying shops</span>
            </div>

            {loadingSummary ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                <span className="text-xs font-semibold">Loading analytics summary...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {MONTHS.map((m) => {
                  const total = monthlyTotals[m.key] || 0;
                  const isSelected = selectedAnalyticsMonth === m.key;
                  const count = summaryRecords.filter(r => (Number((r as any)[m.key]) || 0) > 0).length;

                  return (
                    <div key={m.key} className="border border-border/60 rounded-xl overflow-hidden">
                      <div
                        onClick={() => setSelectedAnalyticsMonth(isSelected ? null : m.key)}
                        className={`grid grid-cols-12 items-center p-3.5 cursor-pointer transition-all ${
                          isSelected ? 'bg-amber-500/10' : 'bg-secondary/20 hover:bg-secondary/40'
                        } gap-2`}
                      >
                        <div className="col-span-3 font-extrabold text-sm text-foreground uppercase">
                          <div>{m.label}</div>
                          <div className="text-[10px] text-muted-foreground font-semibold font-sans capitalize">{count} shops paid</div>
                        </div>
                        <div className="col-span-2 text-right font-black text-sm text-emerald-400" title="Total Received">
                          ₹{formatINR(total)}
                        </div>
                        <div className="col-span-4 px-2 flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">Taken:</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={expenses[m.key] || ''}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setExpenses(prev => ({ ...prev, [m.key]: val }));
                            }}
                            className="w-20 bg-slate-950 border border-border/80 rounded px-2 py-1 text-xs font-bold text-foreground focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveExpense(m.key, expenses[m.key] || 0, total)}
                            disabled={savingMonthExpense[m.key]}
                            className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-1 rounded text-[10px] font-black uppercase transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                          >
                            {savingMonthExpense[m.key] ? '...' : 'Save'}
                          </button>
                        </div>
                        <div className="col-span-2 text-right font-black text-xs text-sky-400" title="Remaining Amount">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase mr-1">Rem:</span>
                          ₹{formatINR(Math.max(0, total - (expenses[m.key] || 0)))}
                        </div>
                        <div className="col-span-1 text-right">
                          <span className="text-xs text-amber-400 font-bold">{isSelected ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="p-4 bg-background border-t border-border/40 space-y-2">
                          {activeMonthRecords.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">No payments recorded for this month.</p>
                          ) : (
                            activeMonthRecords.map((r, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-lg border border-border/40">
                                <div>
                                  <div className="font-extrabold text-xs text-foreground">{r.customer_name} ({r.shop_name})</div>
                                  <div className="text-[10px] text-muted-foreground">Paid on: {formatDisplayDate((r as any)[`${m.key}_paid_at`])}</div>
                                </div>
                                <div className="font-black text-sm text-emerald-400">₹{formatINR(Number((r as any)[m.key]))}</div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MEMBER REGISTRATION / EDIT MODAL (ADMIN ONLY)
      ════════════════════════════════════════════════════════════════════ */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-amber-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                <Store className="h-5 w-5 text-amber-500" />
                {editingMember ? 'Edit Member & Shop' : 'Register New Member & Shop'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-primary uppercase block mb-1">Member Name *</label>
                <input
                  type="text"
                  placeholder="Enter full member name..."
                  value={formMemberName}
                  onChange={(e) => setFormMemberName(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-primary uppercase block mb-1">Phone Number *</label>
                <input
                  type="text"
                  placeholder="Enter 10-digit phone number..."
                  value={formPhoneNumber}
                  onChange={(e) => setFormPhoneNumber(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-primary uppercase block mb-1">Shop Name *</label>
                <input
                  type="text"
                  placeholder="Enter member shop name..."
                  value={formShopName}
                  onChange={(e) => setFormShopName(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase block mb-1">Shop Address / Location</label>
                <input
                  type="text"
                  placeholder="Enter shop address..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase block mb-1">Subscription Start Date</label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase block mb-1">Notes</label>
                <textarea
                  placeholder="Optional notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-border/40 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs px-5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingMember ? 'Update Member' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SHOP SUBSCRIPTION AUDIT DETAILS MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-amber-500/40 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-amber-500/20 to-yellow-600/10 border-b border-border/40 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                  <Store className="h-5 w-5 text-amber-500" />
                  {auditMemberInfo?.shop_name || 'Shop Details & Audit History'}
                </h3>
                <p className="text-xs text-muted-foreground font-semibold">
                  Member: <span className="text-foreground font-bold">{auditMemberInfo?.member_name}</span> · Phone: <span className="text-foreground font-bold">{auditMemberInfo?.phone_number}</span>
                  {auditMemberInfo?.subscription_start_date && (
                    <span> · Joined: {formatDisplayDate(auditMemberInfo.subscription_start_date)}</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {loadingAudit ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                  <span className="text-xs font-semibold">Loading detailed shop audit history...</span>
                </div>
              ) : (
                <>
                  {/* Summary Banner */}
                  <div className="p-4 bg-secondary/30 border border-border rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">Lifetime Total Paid</span>
                      <span className="text-2xl font-black text-emerald-400">₹{formatINR(auditLifetimeTotal)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">Audit Year:</span>
                      <select
                        value={auditSelectedYear}
                        onChange={(e) => setAuditSelectedYear(parseInt(e.target.value))}
                        className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-extrabold text-foreground"
                      >
                        {yearsArray.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Monthly Audit Table */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Monthly Payment Matrix & Timestamps ({auditSelectedYear})
                    </h4>

                    {!selectedAuditYearRecord ? (
                      <div className="p-8 text-center bg-secondary/20 rounded-xl text-muted-foreground text-xs font-semibold">
                        No subscription record found for year {auditSelectedYear}.
                      </div>
                    ) : (
                      <div className="border border-border/60 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-secondary/40 border-b border-border/60 text-muted-foreground font-black text-[10px] uppercase tracking-wider">
                              <th className="p-3">Month</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Amount Paid</th>
                              <th className="p-3 text-center">Payment Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {MONTHS.map((m) => {
                              const amt = Number((selectedAuditYearRecord as any)[m.key]) || 0;
                              const paidAt = (selectedAuditYearRecord as any)[`${m.key}_paid_at`];
                              const isPaid = amt > 0;

                              return (
                                <tr key={m.key} className={isPaid ? 'bg-emerald-500/5' : ''}>
                                  <td className="p-3 font-extrabold uppercase text-foreground">{m.label}</td>
                                  <td className="p-3">
                                    {isPaid ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        <Check className="h-3 w-3" /> Paid
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-secondary text-muted-foreground border border-border">
                                        Unpaid / Pending
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-black text-sm">
                                    {isPaid ? <span className="text-emerald-400">₹{formatINR(amt)}</span> : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  <td className="p-3 text-center font-semibold text-muted-foreground">
                                    {isPaid ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-foreground">
                                        <Clock className="h-3 w-3 text-amber-400" />
                                        {formatDisplayDate(paidAt)}
                                      </span>
                                    ) : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-border/40 bg-secondary/20 flex items-center justify-between">
              {auditMemberInfo && (
                <button
                  type="button"
                  onClick={() => loadMemberIntoRegister(auditMemberInfo)}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Banknote className="h-4 w-4" />
                  Load into Payment Register
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-xl text-xs font-extrabold text-foreground"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
