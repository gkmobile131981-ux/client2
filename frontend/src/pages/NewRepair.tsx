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
  MessageSquare,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';
import SignatureCanvas from 'react-signature-canvas';
const ReactSignatureCanvas = (SignatureCanvas as any).default || SignatureCanvas;

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

export interface DeviceOptionEntry {
  brand: string;
  model: string;
}

export function buildDeviceOptions(rateCards: DeviceOptionEntry[]) {
  const mergedBrands: Record<string, Set<string>> = {};

  Object.entries(DEVICE_BRANDS).forEach(([brand, models]) => {
    mergedBrands[brand] = new Set(models);
  });

  rateCards.forEach(({ brand, model }) => {
    const normalizedBrand = brand.trim();
    const normalizedModel = model.trim();
    if (!normalizedBrand || !normalizedModel) return;

    if (!mergedBrands[normalizedBrand]) {
      mergedBrands[normalizedBrand] = new Set<string>();
    }
    mergedBrands[normalizedBrand].add(normalizedModel);
  });

  const brandOptions = Object.keys(mergedBrands).sort((a, b) => a.localeCompare(b));
  const modelsByBrand = Object.fromEntries(
    brandOptions.map((brand) => [brand, Array.from(mergedBrands[brand]).sort((a, b) => a.localeCompare(b))])
  );

  return { brandOptions, modelsByBrand };
}

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
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [showLockCode, setShowLockCode] = useState(false);
  const [showPattern, setShowPattern] = useState(true);

  // Core Data States
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [selectedServices, setSelectedServices] = useState<Array<{ service_name: string; labor_cost: number }>>([]);
  const [customProblem, setCustomProblem] = useState('');
  // Split brand and model states
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');

  // Date and Time Fields Displays
  const [repairDateDisplay, setRepairDateDisplay] = useState('');
  const [repairTimeDisplay, setRepairTimeDisplay] = useState('');

  // Pattern Lock State
  const [patternNodes, setPatternNodes] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pointerCoords, setPointerCoords] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // KYC Files & Signature States
  const [kycData, setKycData] = useState<{
    idCardFront: string | null;
    idCardBack: string | null;
    mobileFront: string | null;
    mobileBack: string | null;
    customerPhoto: string | null;
    signature: string | null;
    documentNumber: string;
  }>({
    idCardFront: null,
    idCardBack: null,
    mobileFront: null,
    mobileBack: null,
    customerPhoto: null,
    signature: null,
    documentNumber: ''
  });

  const [mobileFrontFile, setMobileFrontFile] = useState<File | null>(null);
  const [mobileBackFile, setMobileBackFile] = useState<File | null>(null);

  // Signature Drawing Canvas Ref
  const sigPadRef = useRef<any>(null);

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
      sendWhatsapp: true,
      sendEmail: true,
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

  const { data: rateCardOptionsData } = useQuery<{ rateCards: DeviceOptionEntry[] }>({
    queryKey: ['rate-card-options'],
    queryFn: () => apiClient.get('/ratecards'),
    staleTime: 5 * 60 * 1000
  });
  const { brandOptions, modelsByBrand } = buildDeviceOptions(rateCardOptionsData?.rateCards || []);

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
  const { data: rateCardData } = useQuery<{ rateCard: { services: Array<{ id: string; service_name: string; og_cost: number; ditto_cost: number; copy_cost: number }> } | null }>({
    queryKey: ['rate-card-lookup', watchBrand, watchModel],
    queryFn: () => apiClient.get(`/ratecards/lookup?brand=${encodeURIComponent(watchBrand)}&model=${encodeURIComponent(watchModel)}`),
    enabled: watchBrand.length > 0 && watchModel.length > 0
  });

  // Fetch Expected Sequential Job Number
  const { data: nextJobNumberData } = useQuery<{ nextJobNumber: string }>({
    queryKey: ['next-job-number'],
    queryFn: () => apiClient.get('/repairs/next-job-number'),
    staleTime: 0
  });
  const nextJobNumber = nextJobNumberData?.nextJobNumber;

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

    const limit = 5 * 1024 * 1024;
    if (file.size > limit) {
      toast.error(`File size exceeds ${limit / (1024 * 1024)}MB limit`);
      return;
    }
    
    if (isDevicePhoto) {
      if (key === 'mobileFront') setMobileFrontFile(file);
      if (key === 'mobileBack') setMobileBackFile(file);
    }

    setUploadProgress(prev => ({ ...prev, [key]: 10 }));

    const reader = new FileReader();
    reader.onloadend = () => {
      let progress = 10;
      const interval = setInterval(() => {
        progress += 30;
        if (progress >= 100) {
          clearInterval(interval);
          setUploadProgress(prev => ({ ...prev, [key]: 100 }));
          setKycData(prev => ({
            ...prev,
            [key]: reader.result as string
          }));
          toast.success(`${key} captured successfully!`);
          setTimeout(() => {
            setUploadProgress(prev => {
              const updated = { ...prev };
              delete updated[key];
              return updated;
            });
          }, 800);
        } else {
          setUploadProgress(prev => ({ ...prev, [key]: progress }));
        }
      }, 100);
    };
    reader.readAsDataURL(file);
  };

  // Signature Canvas Drawing Logic
  const saveSignature = () => {
    if (!sigPadRef.current) return;
    const canvas = sigPadRef.current.getTrimmedCanvas();
    const base64Sig = canvas.toDataURL('image/png');
    setKycData(prev => ({ ...prev, signature: base64Sig }));
    setSignatureOpen(false);
    toast.success('Signature saved successfully');
  };

  const clearSignature = () => {
    sigPadRef.current?.clear();
  };

  // Brand & Model Selection Handlers
  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel('');
    setCustomBrand('');
    setCustomModel('');
    
    if (brand === 'Other') {
      setValue('brand', '', { shouldValidate: true });
      setValue('model', '', { shouldValidate: true });
    } else {
      setValue('brand', brand, { shouldValidate: true });
      setValue('model', '', { shouldValidate: true });
    }
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    if (model === 'Other') {
      setValue('model', '', { shouldValidate: true });
    } else {
      setValue('model', model, { shouldValidate: true });
    }
  };

  const handleCustomBrandChange = (val: string) => {
    setCustomBrand(val);
    setValue('brand', val, { shouldValidate: true });
  };

  const handleCustomModelChange = (val: string) => {
    setCustomModel(val);
    setValue('model', val, { shouldValidate: true });
  };

  // Save KYC Data as a JSON string to form values
  const handleSaveKyc = () => {
    setValue('kycDetails', JSON.stringify(kycData));
    setKycModalOpen(false);
    toast.success('Customer KYC Details captured!');
  };

  // Pattern Lock Grid dragging handlers
  const handlePointerDownPattern = (node: number) => {
    setIsDrawing(true);
    setPatternNodes([node]);
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const handlePointerMovePattern = (e: React.PointerEvent) => {
    if (!isDrawing || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Clamp to boundaries of w-60 h-60 (240x240 pixels)
    const clampedX = Math.max(0, Math.min(240, x));
    const clampedY = Math.max(0, Math.min(240, y));
    setPointerCoords({ x: clampedX, y: clampedY });

    // Hit test 3x3 nodes
    for (let n = 1; n <= 9; n++) {
      const row = Math.floor((n - 1) / 3);
      const col = (n - 1) % 3;
      const cx = 40 + col * 80;
      const cy = 40 + row * 80;
      
      const dist = Math.hypot(clampedX - cx, clampedY - cy);
      // Nodes are 48px wide, so let's use 28px hit test radius
      if (dist < 28) {
        setPatternNodes((prev) => {
          if (prev.includes(n)) return prev;
          const next = [...prev, n];
          if (navigator.vibrate) {
            navigator.vibrate(20);
          }
          return next;
        });
      }
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
      queryClient.invalidateQueries({ queryKey: ['next-job-number'] });
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
    if (nextJobNumber) {
      formData.append('jobNumber', nextJobNumber);
    }
    
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

  const renderUploadCard = (
    label: string,
    key: keyof typeof kycData,
    icon: React.ReactNode,
    fileInputProps: { accept: string; capture?: 'environment' | 'user' }
  ) => {
    const value = kycData[key];
    const progress = uploadProgress[key];
    const isUploading = progress !== undefined;

    return (
      <div className="flex flex-col h-56 bg-card/60 border border-border/80 rounded-2xl overflow-hidden group hover:border-primary/50 transition-all duration-300 relative shadow-md">
        {/* Header Label */}
        <div className="bg-secondary/20 border-b border-border/60 py-2.5 px-4 flex items-center justify-between">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{label}</span>
          {value && (
            <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
              <CheckCircle className="h-3.5 w-3.5" /> Ready
            </span>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col justify-center items-center relative p-4">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="absolute text-[10px] font-black text-foreground">{progress}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider animate-pulse">Uploading file...</span>
            </div>
          ) : value ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center group/preview">
              <img src={value} className="h-full w-full object-cover" alt={label} />
              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/80 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                {key === 'signature' ? (
                  <button
                    type="button"
                    onClick={() => setSignatureOpen(true)}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md transition-all active:scale-[0.98]"
                  >
                    Replace
                  </button>
                ) : (
                  <label className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md transition-all active:scale-[0.98] cursor-pointer">
                    Replace
                    <input
                      type="file"
                      {...fileInputProps}
                      onChange={(e) => handleFileUpload(e, key, key === 'mobileFront' || key === 'mobileBack')}
                      className="hidden"
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setKycData(prev => ({ ...prev, [key]: null }));
                    if (key === 'mobileFront') setMobileFrontFile(null);
                    if (key === 'mobileBack') setMobileBackFile(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md transition-all active:scale-[0.98]"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full w-full flex flex-col justify-center items-center">
              {key === 'signature' ? (
                <div
                  onClick={() => setSignatureOpen(true)}
                  className="w-full h-full border border-dashed border-border/80 rounded-xl flex flex-col justify-center items-center cursor-pointer hover:border-primary/50 hover:bg-secondary/10 transition-colors"
                >
                  {icon}
                  <span className="text-[10px] text-white font-black uppercase tracking-wider mt-2">Sign Canvas</span>
                </div>
              ) : (
                <label className="w-full h-full border border-dashed border-border/80 rounded-xl flex flex-col justify-center items-center cursor-pointer hover:border-primary/50 hover:bg-secondary/10 transition-colors">
                  {icon}
                  <span className="text-[10px] text-white font-black uppercase tracking-wider mt-2">Upload Photo</span>
                  <input
                    type="file"
                    {...fileInputProps}
                    onChange={(e) => handleFileUpload(e, key, key === 'mobileFront' || key === 'mobileBack')}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 bg-background rounded-3xl overflow-hidden shadow-2xl border border-border/85 light text-foreground">
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
          <div className="flex-1">
            <h1 className="text-xl font-black tracking-tight text-white uppercase">Add New Customer Details</h1>
            <p className="text-white/80 text-xs mt-0.5">Structured repair order logging terminal</p>
          </div>
          {nextJobNumber && (
            <div className="bg-white/10 border border-white/20 px-3.5 py-1.5 rounded-xl text-right shrink-0">
              <span className="text-[10px] text-white/70 block uppercase font-bold tracking-wider">Billing ID (Generated)</span>
              <span className="font-mono text-sm font-black text-foreground">{nextJobNumber}</span>
            </div>
          )}
        </div>
        <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
          <Smile className="h-16 w-16 text-white" />
        </div>
      </div>

      {/* Main Form Form */}
      <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-6">
        
        {/* ROW 1: ORDER STATUS & CUSTOMER DETAILS — SIDE BY SIDE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border/40 pb-6">
          {/* Order Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary uppercase tracking-wider block">Order Status</label>
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

          {/* Customer Details Search */}
          <div className="space-y-1.5 relative">
            <label className="text-xs font-bold text-primary uppercase tracking-wider block">Customer Details</label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Searching 🔍"
                value={phoneSearch}
                onChange={(e) => {
                  setPhoneSearch(e.target.value);
                  setCustomerSearchOpen(true);
                }}
                className="w-full pl-9 pr-3 py-3 bg-secondary/35 border border-border rounded-xl text-sm focus:outline-none focus:border-primary text-foreground font-semibold"
              />
            </div>
            {/* Dropdown autocomplete results */}
            {customerSearchOpen && phoneSearch.length >= 2 && (
              <div className="absolute z-30 left-0 right-0 bg-secondary/95 border border-border rounded-xl divide-y divide-border/60 overflow-hidden shadow-xl max-h-52 overflow-y-auto mt-1">
                {customersSearchData?.customers && customersSearchData.customers.length > 0 ? (
                  customersSearchData.customers.map((cust) => (
                    <button
                      type="button"
                      key={cust.id}
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setValue('customerId', cust.id, { shouldValidate: true });
                        setNewCustName(cust.name);
                        setNewCustPhone(cust.phone);
                        setNewCustAddr(cust.address || '');
                        setPhoneSearch('');
                        setCustomerSearchOpen(false);
                      }}
                      className="w-full p-3 text-left hover:bg-primary/10 cursor-pointer flex justify-between items-center gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-foreground">{cust.name}</div>
                        <div className="text-xs text-muted-foreground">{cust.phone}</div>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-primary whitespace-nowrap">Select</span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No match — fill in details below to register.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: REGISTER NEW CUSTOMER — ALWAYS VISIBLE */}
        <div className="bg-secondary/10 border border-border/60 p-4 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground uppercase tracking-[0.2em] underline decoration-primary decoration-2 underline-offset-4">Register New Customer</span>
            {selectedCustomer && (
              <span className="flex items-center gap-1.5 text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
                ✓ {selectedCustomer.name}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setValue('customerId', '');
                    setNewCustName('');
                    setNewCustPhone('');
                    setNewCustAddr('');
                  }}
                  className="ml-0.5 text-red-400 hover:text-red-600"
                >✕</button>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Customer Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Customer Name</label>
              <input
                type="text"
                placeholder="e.g. Jane Doe"
                value={newCustName}
                autoComplete="new-password"
                onChange={(e) => {
                  setNewCustName(e.target.value);
                  if (selectedCustomer) { setSelectedCustomer(null); setValue('customerId', ''); }
                }}
                className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary font-semibold"
              />
            </div>
            {/* Phone */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Phone</label>
              <input
                type="text"
                placeholder="e.g. +91 99999 88888"
                value={newCustPhone}
                autoComplete="off"
                onChange={(e) => {
                  setNewCustPhone(e.target.value);
                  if (selectedCustomer) { setSelectedCustomer(null); setValue('customerId', ''); }
                }}
                className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary font-semibold"
              />
            </div>
            {/* Address */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Address</label>
              <input
                type="text"
                placeholder="e.g. New Delhi"
                value={newCustAddr}
                autoComplete="off"
                onChange={(e) => setNewCustAddr(e.target.value)}
                className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary font-semibold"
              />
            </div>
          </div>

          {!selectedCustomer && (
            <button
              type="button"
              onClick={registerCustomerInline}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs"
            >
              Register & Select
            </button>
          )}

          {errors.customerId && (
            <p className="text-[11px] text-red-500 font-semibold">{errors.customerId.message}</p>
          )}

          {/* Brand & Model Selectors */}
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Brand Select */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Device Brand</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground select-custom"
                >
                  <option value="" className="bg-neutral-900 text-white">Select Brand</option>
                  <option value="Other" className="bg-neutral-900 text-white">Other (Custom Brand)</option>
                  {brandOptions.map((b) => (
                    <option key={b} value={b} className="bg-neutral-900 text-white">{b}</option>
                  ))}
                </select>
                {errors.brand && (
                  <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.brand.message}</p>
                )}
              </div>

              {/* Model Select (only if pre-defined brand is selected) */}
              {selectedBrand && selectedBrand !== 'Other' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Device Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground select-custom"
                  >
                    <option value="" className="bg-neutral-900 text-white">Select Model</option>
                    <option value="Other" className="bg-neutral-900 text-white">Other (Custom Model)</option>
                    {(modelsByBrand[selectedBrand] || []).map((m) => (
                      <option key={m} value={m} className="bg-neutral-900 text-white">{m}</option>
                    ))}
                  </select>
                  {errors.model && (
                    <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.model.message}</p>
                  )}
                </div>
              )}
            </div>

            {/* Custom Brand Input (if Brand is "Other") */}
            {selectedBrand === 'Other' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Enter Custom Brand</label>
                <input
                  type="text"
                  placeholder="e.g. MOTOROLA"
                  value={customBrand}
                  onChange={(e) => handleCustomBrandChange(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold uppercase"
                />
                {errors.brand && (
                  <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.brand.message}</p>
                )}
              </div>
            )}

            {/* Custom Model Input (if Brand is "Other" or Model is "Other") */}
            {(selectedBrand === 'Other' || selectedModel === 'Other') && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Enter Custom Model</label>
                <input
                  type="text"
                  placeholder="e.g. MOTO G54"
                  value={customModel}
                  onChange={(e) => handleCustomModelChange(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold uppercase"
                />
                {errors.model && (
                  <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.model.message}</p>
                )}
              </div>
            )}

            <input type="hidden" {...register('brand')} />
            <input type="hidden" {...register('model')} />
          </div>

          {/* Problem description with Add Button */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Write Problem Description..."
              value={customProblem}
              onChange={(e) => setCustomProblem(e.target.value)}
              className="flex-1 bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold"
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
                  const copyName = `${svc.service_name} (Copy)`;
                  const dittoName = `${svc.service_name} (Ditto)`;
                  const isOgSelected = selectedServices.some(s => s.service_name === ogName);
                  const isCopySelected = selectedServices.some(s => s.service_name === copyName);
                  const isDittoSelected = selectedServices.some(s => s.service_name === dittoName);

                  return (
                    <div key={svc.id} className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-2.5 rounded-lg bg-secondary/20 border border-border/40">
                      <span className="text-xs font-bold text-foreground">{svc.service_name}</span>
                      <div className="flex flex-wrap gap-2">
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
                          onClick={() => toggleService({ service_name: copyName, labor_cost: svc.copy_cost ?? 0 })}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-extrabold transition-all flex items-center gap-1.5 ${
                            isCopySelected
                              ? 'bg-rose-600 text-white border-transparent shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                              : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground hover:border-rose-500/50'
                          }`}
                        >
                          <span translate="no" className="notranslate">Copy: ₹{svc.copy_cost ?? 0}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleService({ service_name: dittoName, labor_cost: svc.ditto_cost ?? 0 })}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-extrabold transition-all flex items-center gap-1.5 ${
                            isDittoSelected
                              ? 'bg-amber-600 text-white border-transparent shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                              : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground hover:border-amber-500/50'
                          }`}
                        >
                          <span translate="no" className="notranslate">Ditto: ₹{svc.ditto_cost ?? 0}</span>
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
            <div className="p-3 bg-secondary/30 rounded-xl text-xs text-foreground/90 italic border border-border/60">
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
              {kycData.signature && <span>Signature Saved ✓</span>}
            </div>
          )}
        </div>

        {/* ESTIMATED PRICE & PAID SIDE BY SIDE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="text-2xl font-black text-foreground mt-0.5">₹{outstandingBalance.toFixed(2)}</div>
          </div>
          <span className="text-xs text-muted-foreground italic">Balance = Estimate - Paid</span>
        </div>

        {/* LOCK CODE & PATTERN LOCK */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-primary uppercase tracking-wider block">Lock Code (optional)</label>
            <div className="relative">
              <Input
                type={showLockCode ? 'text' : 'password'}
                placeholder="PIN / Password"
                {...register('lockCode')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowLockCode(!showLockCode)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                title={showLockCode ? 'Hide password' : 'Show password'}
              >
                {showLockCode ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
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
          <div className="flex flex-col items-center gap-3 p-4 bg-primary/10 rounded-2xl border border-primary/25 relative">
            <button
              type="button"
              onClick={() => setShowPattern(!showPattern)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-1"
              title={showPattern ? 'Hide pattern preview' : 'Show pattern preview'}
            >
              {showPattern ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>

            <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center pr-6">
              Selected Pattern Lock Preview
            </div>
            
            {/* Visual Mini Grid Preview */}
            <div className="relative w-24 h-24 bg-secondary/15 rounded-xl border border-border/80 p-2 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {showPattern && (() => {
                  const nodes = (watch('patternLock') || '').split('-').map(Number);
                  return nodes.map((node, index) => {
                    if (index === 0) return null;
                    const prevNode = nodes[index - 1];
                    const getMiniCoords = (n: number) => {
                      const r = Math.floor((n - 1) / 3);
                      const c = (n - 1) % 3;
                      return { x: 16 + c * 32, y: 16 + r * 32 };
                    };
                    const p1 = getMiniCoords(prevNode);
                    const p2 = getMiniCoords(node);
                    return (
                      <line
                        key={index}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        className="stroke-primary"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                    );
                  });
                })()}
                
                {/* Visual nodes dots */}
                {Array.from({ length: 9 }).map((_, idx) => {
                  const n = idx + 1;
                  const nodes = (watch('patternLock') || '').split('-').map(Number);
                  const isSelected = showPattern && nodes.includes(n);
                  const r = Math.floor((n - 1) / 3);
                  const c = (n - 1) % 3;
                  const x = 16 + c * 32;
                  const y = 16 + r * 32;
                  return (
                    <circle
                      key={n}
                      cx={x}
                      cy={y}
                      r={isSelected ? 4 : 2}
                      className={isSelected ? "fill-primary" : "fill-muted-foreground/35"}
                    />
                  );
                })}
              </svg>
            </div>
            
            <div className="text-xs font-mono text-center text-primary/95">
              Sequence: <span className="font-extrabold text-foreground">{showPattern ? watch('patternLock') : '••••••••'}</span>
            </div>
          </div>
        )}

        {/* REPAIR DATE & TIME SETTERS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center p-4 bg-secondary/15 rounded-2xl border border-border/60">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Current repair date</span>
            <div className="text-sm font-bold text-foreground">{repairDateDisplay || 'Loading...'}</div>
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
            <div className="text-sm font-bold text-foreground">{repairTimeDisplay || 'Loading...'}</div>
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
            <span className="text-xs text-foreground font-semibold">Reminder Enable?</span>
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
            <span className="text-xs text-foreground/95 font-bold">Power Adapter</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground font-bold">
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
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground font-bold">
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
            <span className="text-xs text-foreground/95 font-bold">KeyBoard / Mouse</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground font-bold">
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
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground font-bold">
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
            <span className="text-xs text-foreground/95 font-bold">Other Device</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground font-bold">
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
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground font-bold">
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
                className="flex-1 bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold"
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
              className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold"
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
              <span className="text-xs font-semibold text-foreground">{authUser?.name} (You)</span>
            </div>
          )}
        </div>

        {/* MESSAGING & CASHBACK SWITCHES */}
        <div className="space-y-3 bg-[#2a303c]/30 p-4 rounded-2xl border border-border/85">
          {/* Whatsapp Switch */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-emerald-400" />
              <span className="text-xs text-foreground/95 font-semibold">Send Whatsapp Message ?</span>
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
              <span className="text-xs text-foreground/95 font-semibold">Send Email To Customer ?</span>
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
              <span className="text-xs text-foreground/95 font-semibold">Allow 10% cashback for this order ?</span>
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

        {/* ADDITIONAL DETAILS OPTIONAL TEXTAREA */}
        <div className="space-y-1">
          <textarea
            placeholder="Additional details (Optional)"
            {...register('notes')}
            rows={3}
            className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold"
          />
        </div>



        {/* WARRANTY FIELD */}
        <div className="space-y-1">
          <textarea
            placeholder="Device Warranty (Optional)"
            {...register('warranty')}
            rows={2}
            className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold"
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

      {kycModalOpen && (
        <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center p-3 light text-foreground overflow-y-auto light text-foreground">
          <div className="bg-card border border-border w-[92%] sm:w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative max-h-[85vh] flex flex-col">
            {/* Sticky Header */}
            <div className="bg-secondary/10 border-b border-border/60 p-4 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setKycModalOpen(false)}
                className="p-2 rounded-full bg-secondary/35 hover:bg-secondary/50 transition-colors text-foreground"
                title="Back"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
              <h2 className="text-sm font-extrabold text-primary tracking-tight uppercase">
                Customer KYC Terminal
              </h2>
              <div className="w-8" />
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 p-5 sm:p-6 space-y-6 overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {renderUploadCard('ID Card Front', 'idCardFront', <Camera className="h-6 w-6 text-primary" />, { accept: 'image/*', capture: 'environment' })}
                {renderUploadCard('ID Card Back', 'idCardBack', <Camera className="h-6 w-6 text-primary" />, { accept: 'image/*', capture: 'environment' })}
                {renderUploadCard('Mobile Device Front', 'mobileFront', <Smartphone className="h-6 w-6 text-primary" />, { accept: 'image/*', capture: 'environment' })}
                {renderUploadCard('Mobile Device Back', 'mobileBack', <Smartphone className="h-6 w-6 text-primary" />, { accept: 'image/*', capture: 'environment' })}
                {renderUploadCard('Customer Face Photo', 'customerPhoto', <Camera className="h-6 w-6 text-primary" />, { accept: 'image/*', capture: 'user' })}
                {renderUploadCard('Client Signature', 'signature', <Clipboard className="h-6 w-6 text-primary" />, { accept: '' })}
              </div>

              {/* Document Number */}
              <div className="space-y-1.5 max-w-md border-t border-border/40 pt-4">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Document ID / Card Number</label>
                <input
                  type="text"
                  placeholder="Enter Passport / National ID card Number"
                  value={kycData.documentNumber}
                  onChange={(e) => setKycData(prev => ({ ...prev, documentNumber: e.target.value }))}
                  className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold uppercase"
                />
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="bg-secondary/10 border-t border-border/60 p-4 flex gap-3 items-center justify-end shrink-0">
              <Button
                type="button"
                onClick={() => {
                  setValue('kycDetails', JSON.stringify(kycData));
                  toast.success('KYC details saved as draft!');
                }}
                variant="outline"
                className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground h-10 border-border/80 bg-secondary/15 hover:bg-secondary/40"
              >
                Save Draft
              </Button>
              <Button
                type="button"
                onClick={handleSaveKyc}
                className="px-5 py-2 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 h-10"
              >
                Submit KYC
              </Button>
            </div>
          </div>
        </div>
      )}

      {signatureOpen && (
        <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center p-3 light text-foreground">
          <div className="bg-card border border-border w-[92%] sm:w-full max-w-sm rounded-2xl p-4 sm:p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest text-center border-b border-border/60 pb-2">
              Draw Signature on Screen
            </h3>
            
            <div className="relative border border-border/80 rounded-xl overflow-hidden bg-white h-44">
              <span className="absolute top-2 left-2 text-[10px] uppercase font-bold text-slate-400 select-none bg-slate-100/60 px-1.5 py-0.5 rounded z-10">
                Sign Here
              </span>
              <ReactSignatureCanvas 
                ref={sigPadRef}
                penColor="black"
                canvasProps={{
                  className: 'w-full h-full cursor-crosshair'
                }}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearSignature}
                className="flex-1 bg-secondary/55 hover:bg-secondary/75 text-foreground py-2.5 rounded-xl text-xs font-bold uppercase"
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
              className="w-full text-center text-xs text-muted-foreground uppercase font-bold tracking-wider hover:text-primary mt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {patternLockOpen && (
        <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center p-3 light text-foreground">
          <div className="bg-card border border-border w-[92%] sm:w-full max-w-xs rounded-2xl p-4 sm:p-5 space-y-5 shadow-2xl relative text-center">
            <h3 className="text-sm font-bold text-primary uppercase tracking-widest border-b border-border/60 pb-2">
              Draw Pattern Lock
            </h3>
            <p className="text-[10px] text-muted-foreground italic">Drag across nodes sequentially to draw pattern</p>

            {/* Visual SVG connecting lines */}
            <div 
              ref={gridRef}
              className="relative w-60 h-60 mx-auto bg-secondary/10 rounded-2xl p-4 border border-border touch-none select-none cursor-crosshair"
              onPointerMove={handlePointerMovePattern}
              onPointerUp={() => {
                setIsDrawing(false);
                setPointerCoords(null);
              }}
              onPointerLeave={() => {
                setIsDrawing(false);
                setPointerCoords(null);
              }}
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Connected nodes lines */}
                {patternNodes.map((node, index) => {
                  if (index === 0) return null;
                  const prevNode = patternNodes[index - 1];
                  const getCoords = (n: number) => {
                    const row = Math.floor((n - 1) / 3);
                    const col = (n - 1) % 3;
                    return { x: 40 + col * 80, y: 40 + row * 80 };
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
                      className="stroke-primary"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  );
                })}
                {/* Active line to cursor */}
                {isDrawing && patternNodes.length > 0 && pointerCoords && (
                  (() => {
                    const lastNode = patternNodes[patternNodes.length - 1];
                    const getCoords = (n: number) => {
                      const row = Math.floor((n - 1) / 3);
                      const col = (n - 1) % 3;
                      return { x: 40 + col * 80, y: 40 + row * 80 };
                    };
                    const p1 = getCoords(lastNode);
                    return (
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={pointerCoords.x}
                        y2={pointerCoords.y}
                        className="stroke-primary/60"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray="4 4"
                      />
                    );
                  })()
                )}
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
                      onPointerDown={() => handlePointerDownPattern(n)}
                      className={`flex items-center justify-center rounded-full w-12 h-12 text-sm font-black transition-all pointer-events-auto ${
                        isSelected
                          ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/35 border-2 border-white/20'
                          : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border/40'
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
                className="flex-1 bg-secondary/55 hover:bg-secondary/75 text-foreground py-2.5 rounded-xl text-xs font-bold uppercase"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSavePatternLock}
                className="flex-1 bg-primary hover:bg-primary/95 text-white py-2.5 rounded-xl text-xs font-bold uppercase"
              >
                Save
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setPatternNodes([]);
                setPatternLockOpen(false);
              }}
              className="text-xs text-muted-foreground uppercase font-black tracking-widest hover:text-primary pt-2 border-t border-border/40 block w-full text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
