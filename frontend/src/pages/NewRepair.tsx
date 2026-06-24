import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  ArrowLeft,
  Search,
  Plus,
  X,
  Camera,
  Video,
  Clipboard,
  Smile,
  ShieldCheck,
  CheckCircle,
  Loader2,
  Calendar,
  Clock,
  Sparkles,
  Smartphone,
  MessageSquare
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

// ----------------------------------------------------
// Zod Schema for the complete Unified Form
// ----------------------------------------------------
const repairOrderSchema = z.object({
  status: z.enum(['pending', 'repairing', 'ready', 'delivered', 'cancelled']).default('pending'),
  customerId: z.string().uuid('Please select or register a customer'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  problem: z.string().min(5, 'Problem description must be at least 5 characters'),
  quality: z.enum(['good', 'fair', 'poor', 'damaged']).default('good'),
  physicalDamage: z.string().optional().nullable(),
  lockCode: z.string().optional().nullable(),
  patternLock: z.string().optional().nullable(),
  accessoryAdapter: z.boolean().optional().default(false),
  accessoryKeyboardMouse: z.boolean().optional().default(false),
  accessoryOther: z.boolean().optional().default(false),
  serialNumber: z.string().optional().nullable(),
  imei: z.string().optional().nullable(),
  warranty: z.string().optional().nullable(),
  estimate: z.number().positive('Estimate cost must be positive'),
  advance: z.number().nonnegative('Paid/Advance payment must be positive or zero'),
  allowCashback: z.boolean().optional().default(false),
  expense: z.number().nonnegative('Expense must be zero or positive').optional().default(0),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date').or(z.literal('')).optional().nullable(),
  staffId: z.string().uuid('Invalid staff selection').or(z.literal('')).optional().nullable(),
  notes: z.string().or(z.literal('')).optional().nullable(),
  sendWhatsapp: z.boolean().optional().default(false),
  sendEmail: z.boolean().optional().default(false),
  kycDetails: z.string().optional().nullable(),
  reminderEnable: z.boolean().optional().default(false)
}).refine((data) => data.advance <= data.estimate, {
  message: 'Paid/Advance cannot exceed estimate',
  path: ['advance']
});

type RepairOrderFormValues = z.infer<typeof repairOrderSchema>;

interface Staff {
  id: string;
  name: string;
  staff_id: string | null;
  role: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
}

export default function NewRepair() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser, role: authRole } = useAuth();
  const { id: routeCustomerId } = useParams<{ id: string }>();

  // Modals & Popups States
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [patternLockOpen, setPatternLockOpen] = useState(false);
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);

  // Core Data States
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [selectedServices, setSelectedServices] = useState<Array<{ service_name: string; labor_cost: number }>>([]);
  const [customProblem, setCustomProblem] = useState('');
  const [deviceSearchText, setDeviceSearchText] = useState('');

  // Date and Time Fields Displays
  const [repairDateDisplay, setRepairDateDisplay] = useState('');
  const [repairTimeDisplay, setRepairTimeDisplay] = useState('');

  // Pattern Lock State
  const [patternNodes, setPatternNodes] = useState<number[]>([]);

  // KYC Files & Signature States
  const [kycData, setKycData] = useState<{
    idCardFront: string | null;
    idCardBack: string | null;
    mobileFront: string | null;
    mobileBack: string | null;
    customerPhoto: string | null;
    video: string | null;
    signature: string | null;
    documentNumber: string;
  }>({
    idCardFront: null,
    idCardBack: null,
    mobileFront: null,
    mobileBack: null,
    customerPhoto: null,
    video: null,
    signature: '',
    documentNumber: ''
  });

  const [mobileFrontFile, setMobileFrontFile] = useState<File | null>(null);
  const [mobileBackFile, setMobileBackFile] = useState<File | null>(null);

  // Signature Drawing Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Form initialization
  const form = useForm<RepairOrderFormValues>({
    resolver: zodResolver(repairOrderSchema),
    defaultValues: {
      status: 'pending',
      customerId: '',
      brand: '',
      model: '',
      problem: '',
      quality: 'good',
      physicalDamage: '',
      lockCode: '',
      patternLock: '',
      accessoryAdapter: false,
      accessoryKeyboardMouse: false,
      accessoryOther: false,
      serialNumber: '',
      imei: '',
      warranty: '',
      estimate: 0,
      advance: 0,
      allowCashback: false,
      expense: 0,
      deliveryDate: '',
      staffId: '',
      notes: '',
      sendWhatsapp: false,
      sendEmail: false,
      kycDetails: '',
      reminderEnable: false
    }
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;

  // Pre-load current date and time
  useEffect(() => {
    const today = new Date();
    const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
    const formattedTime = `${String(today.getHours()).padStart(2, '0')}H:${String(today.getMinutes()).padStart(2, '0')}M:${String(today.getSeconds()).padStart(2, '0')}S`;
    setRepairDateDisplay(formattedDate);
    setRepairTimeDisplay(formattedTime);

    // Set deliveryDate in DB format YYYY-MM-DD
    const deliveryString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setValue('deliveryDate', deliveryString);
  }, [setValue]);

  // Fetch tech staff
  const { data: staffData } = useQuery<{ staff: Staff[] }>({
    queryKey: ['staff-list'],
    queryFn: () => apiClient.get('/auth/staff'),
    enabled: authRole === 'owner'
  });

  // Autocomplete customer search
  const { data: customersSearchData } = useQuery<{ customers: Customer[] }>({
    queryKey: ['customers-search', phoneSearch],
    queryFn: () => apiClient.get(`/customers?search=${phoneSearch}`),
    enabled: phoneSearch.length >= 2
  });

  // Pre-load customer if ID is in URL parameters
  useEffect(() => {
    if (routeCustomerId) {
      const fetchPreSelectedCustomer = async () => {
        try {
          const res = await apiClient.get<{ customer: Customer }>(`/customers/${routeCustomerId}`);
          setSelectedCustomer(res.customer);
          setValue('customerId', res.customer.id, { shouldValidate: true });
        } catch {
          toast.error('Failed to load customer profile.');
        }
      };
      fetchPreSelectedCustomer();
    }
  }, [routeCustomerId, setValue]);

  // Fetch Rate Cards based on Brand and Model
  const watchBrand = watch('brand');
  const watchModel = watch('model');
  const { data: rateCardData } = useQuery<{ rateCard: { services: Array<{ id: string; service_name: string; og_cost: number; ditto_cost: number }> } | null }>({
    queryKey: ['rate-card-lookup', watchBrand, watchModel],
    queryFn: () => apiClient.get(`/ratecards/lookup?brand=${encodeURIComponent(watchBrand)}&model=${encodeURIComponent(watchModel)}`),
    enabled: watchBrand.length > 0 && watchModel.length > 0
  });

  // Dynamic balance calculations
  const watchEstimate = watch('estimate');
  const watchAdvance = watch('advance');
  const outstandingBalance = Math.max(0, (watchEstimate || 0) - (watchAdvance || 0));

  // Toggle selected rate card services and update estimate price sum
  const toggleService = (svc: { service_name: string; labor_cost: number }) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.service_name === svc.service_name);
      const next = exists
        ? prev.filter((s) => s.service_name !== svc.service_name)
        : [...prev, svc];

      const total = next.reduce((sum, s) => sum + s.labor_cost, 0);
      if (total > 0) {
        setValue('estimate', total, { shouldValidate: true });
      }

      // Add to write problem description
      const serviceNames = next.map(s => s.service_name).join(', ');
      setValue('problem', serviceNames || customProblem || 'Repair diagnostics');

      return next;
    });
  };

  // Add custom problem description text to form state
  const handleAddCustomProblem = () => {
    if (customProblem.trim()) {
      const currentDesc = watch('problem');
      const newDesc = currentDesc ? `${currentDesc}, ${customProblem}` : customProblem;
      setValue('problem', newDesc, { shouldValidate: true });
      setCustomProblem('');
      toast.success('Problem instruction added');
    }
  };

  // File Upload Helper to convert files into Base64 strings
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, key: keyof typeof kycData, isDevicePhoto: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isDevicePhoto) {
      if (key === 'mobileFront') setMobileFrontFile(file);
      if (key === 'mobileBack') setMobileBackFile(file);
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setKycData(prev => ({
        ...prev,
        [key]: reader.result as string
      }));
    };
    reader.readAsDataURL(file);
  };

  // Signature Canvas Drawing Logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64Sig = canvas.toDataURL('image/png');
    setKycData(prev => ({ ...prev, signature: base64Sig }));
    setSignatureOpen(false);
    toast.success('Signature saved successfully');
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Save KYC Data as a JSON string to form values
  const handleSaveKyc = () => {
    setValue('kycDetails', JSON.stringify(kycData));
    setKycModalOpen(false);
    toast.success('Customer KYC Details captured!');
  };

  // Pattern Lock Grid node tap/click
  const handlePatternNodeClick = (node: number) => {
    if (patternNodes.includes(node)) {
      if (patternNodes[patternNodes.length - 1] === node) {
        setPatternNodes(prev => prev.slice(0, -1));
      }
    } else {
      setPatternNodes(prev => [...prev, node]);
    }
  };

  const handleSavePatternLock = () => {
    const code = patternNodes.join('-');
    setValue('patternLock', code);
    setPatternLockOpen(false);
    toast.success(`Pattern Lock code recorded: ${code}`);
  };

  // Create Inline Customer Submission
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddr, setNewCustAddr] = useState('');

  const registerCustomerInline = async () => {
    if (!newCustName || !newCustPhone) {
      toast.error('Please fill in Name and Phone number');
      return;
    }
    try {
      const res = await apiClient.post<{ customer: Customer }>('/customers', {
        name: newCustName,
        phone: newCustPhone,
        address: newCustAddr
      });
      setSelectedCustomer(res.customer);
      setValue('customerId', res.customer.id, { shouldValidate: true });
      setNewCustomerOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddr('');
      toast.success('Customer registered successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to register customer');
    }
  };

  // Main Submit Mutation
  const createRepairMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.post<{ repair: { id: string; job_number: string } }>('/repairs', formData),
    onSuccess: (data) => {
      toast.success(`Repair Order Job #${data.repair.job_number} created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['repairs-list'] });
      navigate(`/repairs/${data.repair.id}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit repair order ticket.');
    }
  });

  const onFormSubmit = (values: RepairOrderFormValues) => {
    const formData = new FormData();
    formData.append('customerId', values.customerId);
    formData.append('brand', values.brand);
    formData.append('model', values.model);
    formData.append('problem', values.problem);
    formData.append('quality', values.quality);
    if (values.status) formData.append('status', values.status);
    if (values.physicalDamage) formData.append('physicalDamage', values.physicalDamage);
    if (values.lockCode) formData.append('lockCode', values.lockCode);
    if (values.patternLock) formData.append('patternLock', values.patternLock);
    
    formData.append('accessoryAdapter', String(values.accessoryAdapter));
    formData.append('accessoryKeyboardMouse', String(values.accessoryKeyboardMouse));
    formData.append('accessoryOther', String(values.accessoryOther));
    if (values.serialNumber) formData.append('serialNumber', values.serialNumber);
    if (values.imei) formData.append('imei', values.imei);
    if (values.warranty) formData.append('warranty', values.warranty);

    formData.append('estimate', String(values.estimate));
    formData.append('advance', String(values.advance));
    formData.append('allowCashback', String(values.allowCashback));
    formData.append('expense', String(values.expense));

    if (values.deliveryDate) formData.append('deliveryDate', values.deliveryDate);
    
    const finalStaffId = authRole === 'owner' ? values.staffId : authUser?.id;
    if (finalStaffId) formData.append('staffId', finalStaffId);

    if (values.notes) formData.append('notes', values.notes);
    formData.append('sendWhatsapp', String(values.sendWhatsapp));
    formData.append('sendEmail', String(values.sendEmail));
    
    // Store KYC JSON
    const finalKyc = {
      ...kycData,
      documentNumber: kycData.documentNumber
    };
    formData.append('kycDetails', JSON.stringify(finalKyc));

    // Upload Files
    if (mobileFrontFile) formData.append('frontPhoto', mobileFrontFile);
    if (mobileBackFile) formData.append('backPhoto', mobileBackFile);

    if (selectedServices.length > 0) {
      formData.append('services', JSON.stringify(selectedServices));
    }

    createRepairMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 bg-background rounded-3xl overflow-hidden shadow-2xl border border-border/85">
      {/* Theme Matched Purple/Indigo Top Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 p-6 relative">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/repairs')}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white uppercase">Add New Customer Details</h1>
            <p className="text-white/80 text-xs mt-0.5">Structured repair order logging terminal</p>
          </div>
        </div>
        <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
          <Smile className="h-16 w-16 text-white" />
        </div>
      </div>

      {/* Main Form Form */}
      <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-6">
        
        {/* ORDER STATUS SECTION */}
        <div className="space-y-2 border-b border-border/40 pb-4">
          <label className="text-xs font-bold text-primary uppercase tracking-wider block">Order Status</label>
          <div className="relative">
            <select
              {...register('status')}
              className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-bold uppercase cursor-pointer"
            >
              <option value="pending">😊 PENDING</option>
              <option value="repairing">🔧 REPAIRING</option>
              <option value="ready">✅ READY</option>
              <option value="delivered">📦 DELIVERED</option>
              <option value="cancelled">❌ CANCELLED</option>
            </select>
          </div>
        </div>

        {/* CUSTOMER DETAILS & AUTOCOMPLETE SECTION */}
        <div className="bg-secondary/10 border border-border/60 p-4 rounded-2xl space-y-4">
          <label className="text-xs font-bold text-primary uppercase tracking-wider block">Customer Details</label>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Customer..."
                value={phoneSearch}
                onChange={(e) => {
                  setPhoneSearch(e.target.value);
                  setCustomerSearchOpen(true);
                }}
                className="w-full pl-9 pr-3 py-3 bg-secondary/35 border border-border rounded-xl text-sm focus:outline-none focus:border-primary text-white"
              />
            </div>
            
            <Button
              type="button"
              onClick={() => setCustomerSearchOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold uppercase text-xs px-4"
            >
              SELECT
            </Button>
            
            <Button
              type="button"
              onClick={() => setNewCustomerOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold uppercase text-xs px-4"
            >
              ADD
            </Button>
          </div>

          {/* Autocomplete Search Dropdown */}
          {customerSearchOpen && phoneSearch.length >= 2 && (
            <div className="bg-secondary/95 border border-border rounded-xl divide-y divide-border/60 overflow-hidden">
              {customersSearchData?.customers && customersSearchData.customers.length > 0 ? (
                customersSearchData.customers.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setValue('customerId', cust.id, { shouldValidate: true });
                      setPhoneSearch('');
                      setCustomerSearchOpen(false);
                    }}
                    className="p-3 hover:bg-primary/10 cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{cust.name}</div>
                      <div className="text-xs text-muted-foreground">{cust.phone}</div>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-primary">Pick</span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No matching clients. Click ADD to register.
                </div>
              )}
            </div>
          )}

          {/* Selected Customer Card Banner */}
          {selectedCustomer && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/15 border border-primary/30">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-primary/95 font-bold block">Selected Client</span>
                <span className="text-sm font-bold text-white block">{selectedCustomer.name}</span>
                <span className="text-xs text-muted-foreground">{selectedCustomer.phone}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setValue('customerId', '');
                }}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-white"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          )}
          {errors.customerId && (
            <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.customerId.message}</p>
          )}

          {/* Device Model Input */}
          <div className="space-y-1">
            <input
              type="text"
              placeholder="Model (e.g. Apple iPhone 14)"
              value={deviceSearchText}
              onChange={(e) => {
                const val = e.target.value;
                setDeviceSearchText(val);
                
                const trimmed = val.trim();
                const splitIdx = trimmed.indexOf(' ');
                if (splitIdx > 0) {
                  setValue('brand', trimmed.substring(0, splitIdx).trim(), { shouldValidate: true });
                  setValue('model', trimmed.substring(splitIdx + 1).trim(), { shouldValidate: true });
                } else {
                  setValue('brand', trimmed, { shouldValidate: true });
                  setValue('model', trimmed, { shouldValidate: true });
                }
              }}
              className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold text-white"
            />
            <input type="hidden" {...register('brand')} />
            <input type="hidden" {...register('model')} />
            {errors.model && (
              <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.model.message}</p>
            )}
          </div>

          {/* Problem description with Add Button */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Write Problem Description..."
              value={customProblem}
              onChange={(e) => setCustomProblem(e.target.value)}
              className="flex-1 bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold text-white"
            />
            <Button
              type="button"
              onClick={handleAddCustomProblem}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold uppercase text-xs px-4"
            >
              ADD
            </Button>
          </div>
          
          <input type="hidden" {...register('problem')} />
          {errors.problem && (
            <p className="text-[11px] text-red-500 font-semibold">{errors.problem.message}</p>
          )}

          {/* Rate Card Autocomplete Services List */}
          {rateCardData?.rateCard?.services && rateCardData.rateCard.services.length > 0 && (
            <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-black text-primary/95 uppercase tracking-widest block">Quick Rate Card Services</span>
              <div className="space-y-3">
                {rateCardData.rateCard.services.map((svc: any) => {
                  const ogName = `${svc.service_name} (OG)`;
                  const dittoName = `${svc.service_name} (Ditto)`;
                  const isOgSelected = selectedServices.some(s => s.service_name === ogName);
                  const isDittoSelected = selectedServices.some(s => s.service_name === dittoName);

                  return (
                    <div key={svc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-lg bg-secondary/20 border border-border/40">
                      <span className="text-xs font-bold text-foreground">{svc.service_name}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleService({ service_name: ogName, labor_cost: svc.og_cost ?? 0 })}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-extrabold transition-all flex items-center gap-1.5 ${
                            isOgSelected
                              ? 'bg-primary text-white border-transparent shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                              : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/50'
                          }`}
                        >
                          <span>OG: ₹{svc.og_cost ?? 0}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleService({ service_name: dittoName, labor_cost: svc.ditto_cost ?? 0 })}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-extrabold transition-all flex items-center gap-1.5 ${
                            isDittoSelected
                              ? 'bg-emerald-600 text-white border-transparent shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                              : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground hover:border-emerald-500/50'
                          }`}
                        >
                          <span>Ditto: ₹{svc.ditto_cost ?? 0}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Problem display text */}
          {watch('problem') && (
            <div className="p-3 bg-secondary/30 rounded-xl text-xs text-white/90 italic border border-border/60">
              <span className="font-bold text-primary/95 not-italic block mb-1">Diagnostic Log:</span>
              "{watch('problem')}"
            </div>
          )}
        </div>

        {/* CUSTOMER KYC MAIN ACCORDION BUTTON */}
        <div>
          <button
            type="button"
            onClick={() => setKycModalOpen(true)}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3.5 px-4 rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-between shadow-lg"
          >
            <span>CUSTOMER KYC</span>
            <span>{kycData.idCardFront || kycData.signature ? '✓ EDIT DETAILS' : '▾ OPEN PANEL'}</span>
          </button>
          
          {/* KYC Summary Indicators */}
          {(kycData.idCardFront || kycData.signature) && (
            <div className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex flex-wrap gap-4 text-xs font-bold text-emerald-400">
              {kycData.idCardFront && <span>ID Front ✓</span>}
              {kycData.idCardBack && <span>ID Back ✓</span>}
              {kycData.mobileFront && <span>Mobile Front ✓</span>}
              {kycData.mobileBack && <span>Mobile Back ✓</span>}
              {kycData.video && <span>Video ✓</span>}
              {kycData.signature && <span>Signature Saved ✓</span>}
            </div>
          )}
        </div>

        {/* ESTIMATED PRICE & PAID SIDE BY SIDE */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-primary uppercase tracking-wider block">Estimated Price ($)</label>
            <Input
              type="number"
              placeholder="0.00"
              {...register('estimate', { valueAsNumber: true })}
              className={errors.estimate ? 'border-red-500' : ''}
            />
            {errors.estimate && (
              <p className="text-[11px] text-red-500 font-semibold">{errors.estimate.message}</p>
            )}
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-primary uppercase tracking-wider block">Paid (Advance)</label>
            <Input
              type="number"
              placeholder="0.00"
              {...register('advance', { valueAsNumber: true })}
              className={errors.advance ? 'border-red-500' : ''}
            />
            {errors.advance && (
              <p className="text-[11px] text-red-500 font-semibold">{errors.advance.message}</p>
            )}
          </div>
        </div>

        {/* Balances Display Banner */}
        <div className="p-4 bg-secondary/20 border border-border/80 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Remaining Balance</span>
            <div className="text-2xl font-black text-white mt-0.5">₹{outstandingBalance.toFixed(2)}</div>
          </div>
          <span className="text-xs text-muted-foreground italic">Balance = Estimate - Paid</span>
        </div>

        {/* LOCK CODE & PATTERN LOCK */}
        <div className="grid grid-cols-2 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-primary uppercase tracking-wider block">Lock Code (optional)</label>
            <Input
              type="text"
              placeholder="PIN / Password"
              {...register('lockCode')}
            />
          </div>

          <Button
            type="button"
            onClick={() => setPatternLockOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl font-bold uppercase tracking-wider text-xs h-[42px]"
          >
            {watch('patternLock') ? 'EDIT PATTERN' : 'PATTERN LOCK'}
          </Button>
        </div>
        {watch('patternLock') && (
          <div className="p-2.5 bg-primary/15 rounded-lg text-xs font-mono text-primary/95 border border-primary/20 text-center">
            Selected Pattern Lock Sequence: <span className="font-black text-white">{watch('patternLock')}</span>
          </div>
        )}

        {/* REPAIR DATE & TIME SETTERS */}
        <div className="grid grid-cols-2 gap-4 items-center p-4 bg-secondary/15 rounded-2xl border border-border/60">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Current repair date</span>
            <div className="text-sm font-bold text-white">{repairDateDisplay || 'Loading...'}</div>
            <Button
              type="button"
              onClick={() => {
                const today = new Date();
                setRepairDateDisplay(`${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`);
                toast.success('Repair date initialized');
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase py-1 px-2.5 h-7 mt-1.5"
            >
              REPAIR DATE
            </Button>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Current repair time</span>
            <div className="text-sm font-bold text-white">{repairTimeDisplay || 'Loading...'}</div>
            <Button
              type="button"
              onClick={() => {
                const today = new Date();
                setRepairTimeDisplay(`${String(today.getHours()).padStart(2, '0')}H:${String(today.getMinutes()).padStart(2, '0')}M:${String(today.getSeconds()).padStart(2, '0')}S`);
                toast.success('Repair time timestamped');
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase py-1 px-2.5 h-7 mt-1.5"
            >
              REPAIR TIME
            </Button>
          </div>

          <div className="col-span-2 pt-3 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs text-white font-semibold">Reminder Enable?</span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('reminderEnable')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        {/* ACCESSORIES YES / NO RADIOS */}
        <div className="p-4 bg-secondary/15 rounded-2xl border border-border/60 space-y-4">
          <label className="text-xs font-bold text-primary uppercase tracking-wider block">Accessories</label>
          
          {/* Power Adapter */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/95 font-bold">Power Adapter</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white font-bold">
                <input
                  type="radio"
                  name="accessoryAdapter"
                  value="true"
                  checked={watch('accessoryAdapter') === true}
                  onChange={() => setValue('accessoryAdapter', true)}
                  className="text-primary focus:ring-primary bg-secondary h-4 w-4"
                />
                <span>Yes</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white font-bold">
                <input
                  type="radio"
                  name="accessoryAdapter"
                  value="false"
                  checked={watch('accessoryAdapter') === false}
                  onChange={() => setValue('accessoryAdapter', false)}
                  className="text-primary focus:ring-primary bg-secondary h-4 w-4"
                />
                <span>No</span>
              </label>
            </div>
          </div>

          {/* Keyboard / Mouse */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/95 font-bold">KeyBoard / Mouse</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white font-bold">
                <input
                  type="radio"
                  name="accessoryKeyboardMouse"
                  value="true"
                  checked={watch('accessoryKeyboardMouse') === true}
                  onChange={() => setValue('accessoryKeyboardMouse', true)}
                  className="text-primary focus:ring-primary bg-secondary h-4 w-4"
                />
                <span>Yes</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white font-bold">
                <input
                  type="radio"
                  name="accessoryKeyboardMouse"
                  value="false"
                  checked={watch('accessoryKeyboardMouse') === false}
                  onChange={() => setValue('accessoryKeyboardMouse', false)}
                  className="text-primary focus:ring-primary bg-secondary h-4 w-4"
                />
                <span>No</span>
              </label>
            </div>
          </div>

          {/* Other Device */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/95 font-bold">Other Device</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white font-bold">
                <input
                  type="radio"
                  name="accessoryOther"
                  value="true"
                  checked={watch('accessoryOther') === true}
                  onChange={() => setValue('accessoryOther', true)}
                  className="text-primary focus:ring-primary bg-secondary h-4 w-4"
                />
                <span>Yes</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white font-bold">
                <input
                  type="radio"
                  name="accessoryOther"
                  value="false"
                  checked={watch('accessoryOther') === false}
                  onChange={() => setValue('accessoryOther', false)}
                  className="text-primary focus:ring-primary bg-secondary h-4 w-4"
                />
                <span>No</span>
              </label>
            </div>
          </div>
        </div>

        {/* SERIAL NUMBERS, IMEI & TECH ASSIGNMENT */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Serial numbers (OPTIONAL)"
                {...register('serialNumber')}
                className="flex-1 bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold text-white"
              />
              <Button
                type="button"
                onClick={() => toast.success('Mock barcode scanner triggered')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold uppercase text-xs px-4"
              >
                SCAN
              </Button>
            </div>
            
            <input
              type="text"
              placeholder="IMEI number (OPTIONAL)"
              {...register('imei')}
              className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold text-white"
            />
          </div>

          {authRole === 'owner' ? (
            <div className="space-y-1">
              <label className="text-xs font-bold text-primary uppercase tracking-wider block">Assign Technician</label>
              <select
                {...register('staffId')}
                className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-bold"
              >
                <option value="">Unassigned (Default)</option>
                {staffData?.staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.staff_id || 'owner'})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-secondary/25 border border-border/80 rounded-xl">
              <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Assigned Staff</span>
              <span className="text-xs font-semibold text-white">{authUser?.name} (You)</span>
            </div>
          )}
        </div>

        {/* MESSAGING & CASHBACK SWITCHES */}
        <div className="space-y-3 bg-[#2a303c]/30 p-4 rounded-2xl border border-border/85">
          {/* Whatsapp Switch */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-emerald-400" />
              <span className="text-xs text-white/95 font-semibold">Send Whatsapp Message ?</span>
            </div>
            <label className="relative inline-flex inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('sendWhatsapp')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Email Switch */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-blue-400" />
              <span className="text-xs text-white/95 font-semibold">Send Email To Customer ?</span>
            </div>
            <label className="relative inline-flex inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('sendEmail')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Cashback Switch */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-amber-400" />
              <span className="text-xs text-white/95 font-semibold">Allow 10% cashback for this order ?</span>
            </div>
            <label className="relative inline-flex inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('allowCashback')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        {/* ADD ID PROOF / DEVICE PHOTO TRIGGER */}
        <div
          onClick={() => setKycModalOpen(true)}
          className="border-2 border-dashed border-border/80 hover:border-primary/80 transition-colors rounded-2xl p-6 text-center cursor-pointer bg-secondary/5 space-y-1.5"
        >
          <Camera className="h-6 w-6 text-muted-foreground mx-auto" />
          <span className="text-xs font-bold text-white block">Add ID Proof / Device Photo (Optional)</span>
          <span className="text-[10px] text-muted-foreground block">Capture front/back documentation in KYC file</span>
        </div>

        {/* ADDITIONAL DETAILS OPTIONAL TEXTAREA */}
        <div className="space-y-1">
          <textarea
            placeholder="Additional details (Optional)"
            {...register('notes')}
            rows={3}
            className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold text-white"
          />
        </div>

        {/* EXPENSE FIELD */}
        <div className="space-y-1">
          <Input
            type="number"
            placeholder="Expense Amount ($)"
            {...register('expense', { valueAsNumber: true })}
          />
        </div>

        {/* WARRANTY FIELD */}
        <div className="space-y-1">
          <textarea
            placeholder="Device Warranty (Optional)"
            {...register('warranty')}
            rows={2}
            className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold text-white"
          />
        </div>

        {/* LARGE GREEN SUBMIT BUTTON */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={createRepairMutation.isPending}
            className="w-full bg-[#4caf50] hover:bg-[#43a047] text-white py-4 rounded-xl font-bold uppercase tracking-wider text-sm border-none shadow-lg transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {createRepairMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> SUBMITTING ORDER...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" /> SUBMIT
              </>
            )}
          </Button>
        </div>

      </form>

      {/* ----------------------------------------------------
          CUSTOMER KYC FULL OVERLAY MODAL
         ---------------------------------------------------- */}
      {kycModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background border border-border/80 w-full max-w-lg rounded-3xl p-6 space-y-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-xl font-extrabold text-primary tracking-tight text-center border-b border-border/60 pb-3">
              Customer KYC Terminal
            </h2>
            
            {/* Grid of KYC Capture points */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* ID Card Front */}
              <div className="space-y-1.5 text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">ID Card Front</span>
                <label className="border border-border/80 rounded-xl p-3.5 bg-secondary/15 relative h-28 flex flex-col justify-center items-center cursor-pointer hover:border-primary/50 overflow-hidden">
                  {kycData.idCardFront ? (
                    <img src={kycData.idCardFront} className="h-full w-full object-cover rounded-lg" alt="ID Front" />
                  ) : (
                    <>
                      <Camera className="h-5 w-5 text-primary" />
                      <span className="text-[10px] text-white font-semibold mt-1">Take Photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'idCardFront')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* ID Card Back */}
              <div className="space-y-1.5 text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">ID Card Back</span>
                <label className="border border-border/80 rounded-xl p-3.5 bg-secondary/15 relative h-28 flex flex-col justify-center items-center cursor-pointer hover:border-primary/50 overflow-hidden">
                  {kycData.idCardBack ? (
                    <img src={kycData.idCardBack} className="h-full w-full object-cover rounded-lg" alt="ID Back" />
                  ) : (
                    <>
                      <Camera className="h-5 w-5 text-primary" />
                      <span className="text-[10px] text-white font-semibold mt-1">Take Photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'idCardBack')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Mobile Device Front */}
              <div className="space-y-1.5 text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Mobile Front</span>
                <label className="border border-border/80 rounded-xl p-3.5 bg-secondary/15 relative h-28 flex flex-col justify-center items-center cursor-pointer hover:border-primary/50 overflow-hidden">
                  {kycData.mobileFront ? (
                    <img src={kycData.mobileFront} className="h-full w-full object-cover rounded-lg" alt="Mobile Front" />
                  ) : (
                    <>
                      <Smartphone className="h-5 w-5 text-primary" />
                      <span className="text-[10px] text-white font-semibold mt-1">Take Photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'mobileFront', true)}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Mobile Device Back */}
              <div className="space-y-1.5 text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Mobile Back</span>
                <label className="border border-border/80 rounded-xl p-3.5 bg-secondary/15 relative h-28 flex flex-col justify-center items-center cursor-pointer hover:border-primary/50 overflow-hidden">
                  {kycData.mobileBack ? (
                    <img src={kycData.mobileBack} className="h-full w-full object-cover rounded-lg" alt="Mobile Back" />
                  ) : (
                    <>
                      <Smartphone className="h-5 w-5 text-primary" />
                      <span className="text-[10px] text-white font-semibold mt-1">Take Photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'mobileBack', true)}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Customer Photo */}
              <div className="space-y-1.5 text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Customer Image</span>
                <label className="border border-border/80 rounded-xl p-3.5 bg-secondary/15 relative h-28 flex flex-col justify-center items-center cursor-pointer hover:border-primary/50 overflow-hidden">
                  {kycData.customerPhoto ? (
                    <img src={kycData.customerPhoto} className="h-full w-full object-cover rounded-lg" alt="Customer Profile" />
                  ) : (
                    <>
                      <Camera className="h-5 w-5 text-primary" />
                      <span className="text-[10px] text-white font-semibold mt-1">Take Photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={(e) => handleFileUpload(e, 'customerPhoto')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Take Video */}
              <div className="space-y-1.5 text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Take Video</span>
                <label className="border border-border/80 rounded-xl p-3.5 bg-secondary/15 relative h-28 flex flex-col justify-center items-center cursor-pointer hover:border-primary/50 overflow-hidden">
                  {kycData.video ? (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase">
                      <Video className="h-4 w-4" /> Ready
                    </div>
                  ) : (
                    <>
                      <Video className="h-5 w-5 text-primary" />
                      <span className="text-[10px] text-white font-semibold mt-1">Upload Video</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleFileUpload(e, 'video')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Sign Terms & Conditions */}
              <div className="space-y-1.5 text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Sign Terms</span>
                <div
                  onClick={() => setSignatureOpen(true)}
                  className="border border-border/80 rounded-xl p-3.5 bg-secondary/15 h-28 flex flex-col justify-center items-center cursor-pointer hover:border-primary/55 overflow-hidden"
                >
                  {kycData.signature ? (
                    <img src={kycData.signature} className="h-full w-full object-contain rounded-lg bg-white" alt="Signature" />
                  ) : (
                    <>
                      <Clipboard className="h-5 w-5 text-primary" />
                      <span className="text-[10px] text-white font-semibold mt-1">Sign Canvas</span>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* Document / KYC ID Number Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Document ID / Card Number</label>
              <input
                type="text"
                placeholder="Enter Passport / National ID card Number"
                value={kycData.documentNumber}
                onChange={(e) => setKycData(prev => ({ ...prev, documentNumber: e.target.value }))}
                className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold text-white"
              />
            </div>

            {/* Done & Cancel buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleSaveKyc}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setKycModalOpen(false)}
                className="w-full bg-secondary/40 hover:bg-secondary/60 text-white py-3 rounded-xl font-bold uppercase tracking-wider text-xs"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          SIGNATURE CANVAS SHEET MODAL
         ---------------------------------------------------- */}
      {signatureOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <div className="bg-background border border-border/80 w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-primary uppercase tracking-widest text-center border-b border-border/60 pb-2">
              Draw Signature on Screen
            </h3>
            
            <div className="border border-border/80 rounded-xl overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={300}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={() => setIsDrawing(false)}
                onMouseLeave={() => setIsDrawing(false)}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={() => setIsDrawing(false)}
                className="w-full cursor-crosshair touch-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearSignature}
                className="flex-1 bg-secondary hover:bg-secondary/80 text-white py-2.5 rounded-xl text-xs font-bold uppercase"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={saveSignature}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-xl text-xs font-bold uppercase"
              >
                Save
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => setSignatureOpen(false)}
              className="w-full text-center text-xs text-muted-foreground uppercase font-bold tracking-wider hover:text-white mt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          PATTERN LOCK DRAWING GRID MODAL
         ---------------------------------------------------- */}
      {patternLockOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-background border border-border/80 w-full max-w-xs rounded-3xl p-6 space-y-5 shadow-2xl relative text-center">
            <h3 className="text-sm font-bold text-primary uppercase tracking-widest border-b border-border/60 pb-2">
              Draw Pattern Lock
            </h3>
            <p className="text-[10px] text-muted-foreground italic">Tap nodes sequentially to record pattern lock</p>

            {/* Visual SVG connecting lines */}
            <div className="relative w-60 h-60 mx-auto bg-[#1a1f2c]/50 rounded-2xl p-4 border border-border">
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {patternNodes.map((node, index) => {
                  if (index === 0) return null;
                  const prevNode = patternNodes[index - 1];
                  
                  const getCoords = (n: number) => {
                    const row = Math.floor((n - 1) / 3);
                    const col = (n - 1) % 3;
                    return {
                      x: `${16.66 + col * 33.33}%`,
                      y: `${16.66 + row * 33.33}%`
                    };
                  };
                  
                  const p1 = getCoords(prevNode);
                  const p2 = getCoords(node);
                  
                  return (
                    <line
                      key={index}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      className="stroke-primary animate-pulse"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>

              {/* Grid Nodes */}
              <div className="grid grid-cols-3 gap-6 h-full relative z-10">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                  const isSelected = patternNodes.includes(n);
                  const selectedIndex = patternNodes.indexOf(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handlePatternNodeClick(n)}
                      className={`flex items-center justify-center rounded-full w-12 h-12 text-sm font-black transition-all ${
                        isSelected
                          ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/35 border-2 border-white/20'
                          : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-white border border-border/40'
                      }`}
                    >
                      {isSelected ? selectedIndex + 1 : n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Sequence Output Text */}
            <div className="text-xs font-mono text-muted-foreground">
              Sequence: <span className="font-bold text-white">{patternNodes.join('-') || '(Empty)'}</span>
            </div>

            {/* Pattern Lock Action Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPatternNodes([])}
                className="flex-1 bg-secondary hover:bg-secondary/80 text-white py-2.5 rounded-xl text-xs font-bold uppercase"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSavePatternLock}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-xl text-xs font-bold uppercase"
              >
                Save
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPatternLockOpen(false)}
              className="w-full text-center text-xs text-muted-foreground uppercase font-bold tracking-wider hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          INLINE REGISTER NEW CUSTOMER MODAL
         ---------------------------------------------------- */}
      {newCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-background border border-border/80 w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-primary uppercase tracking-widest text-center border-b border-border/60 pb-2">
              Register New Customer
            </h3>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Contact Phone</label>
                <input
                  type="text"
                  placeholder="e.g. +91 99999 88888"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Address</label>
                <input
                  type="text"
                  placeholder="e.g. New Delhi, India"
                  value={newCustAddr}
                  onChange={(e) => setNewCustAddr(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold text-white"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={registerCustomerInline}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg"
              >
                Register & Select
              </button>
              <button
                type="button"
                onClick={() => setNewCustomerOpen(false)}
                className="w-full bg-secondary/40 hover:bg-secondary/60 text-white py-3 rounded-xl font-bold uppercase tracking-wider text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
