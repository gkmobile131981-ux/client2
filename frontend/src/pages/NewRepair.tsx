import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Users, 
  Smartphone, 
  DollarSign, 
  UserSquare2, 
  ArrowLeft, 
  ArrowRight,
  CheckCircle,
  Plus,
  Loader2,
  X,
  Search
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

// ----------------------------------------------------
// Validation Schemas for Steps
// ----------------------------------------------------
const step1Schema = z.object({
  customerId: z.string().uuid('Please select or register a customer').or(z.literal('')).optional(),
  // For new customer inline:
  newCustomerName: z.string().min(2, 'Name must be at least 2 characters').or(z.literal('')).optional(),
  newCustomerPhone: z.string().min(5, 'Phone must be at least 5 characters').or(z.literal('')).optional(),
  newCustomerAddress: z.string().or(z.literal('')).optional()
});

const step2Schema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  imei: z.string().optional().nullable(),
  problem: z.string().min(5, 'Problem description must be at least 5 characters'),
  quality: z.enum(['good', 'fair', 'poor', 'damaged']),
  physicalDamage: z.string().optional().nullable()
});

const step3Schema = z.object({
  estimate: z.number().positive('Estimate cost must be positive'),
  advance: z.number().nonnegative('Advance payment must be positive or zero')
}).refine((data) => data.advance <= data.estimate, {
  message: 'Advance cannot exceed estimate',
  path: ['advance']
});

const step4Schema = z.object({
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date').or(z.literal('')).optional().nullable(),
  staffId: z.string().uuid('Invalid staff selection').or(z.literal('')).optional().nullable(),
  notes: z.string().or(z.literal('')).optional().nullable()
});

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

  const [step, setStep] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState('');
  
  // Photo states
  const [frontPhoto, setFrontPhoto] = useState<File | null>(null);
  const [backPhoto, setBackPhoto] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  // 1. Fetch staff members (owners only)
  const { data: staffData } = useQuery<{ staff: Staff[] }>({
    queryKey: ['staff-list'],
    queryFn: () => apiClient.get('/auth/staff'),
    enabled: authRole === 'owner'
  });

  // 2. Fetch autocomplete customers based on phone search
  const { data: customersSearchData } = useQuery<{ customers: Customer[] }>({
    queryKey: ['customers-search', phoneSearch],
    queryFn: () => apiClient.get(`/customers?search=${phoneSearch}`),
    enabled: phoneSearch.length >= 2
  });

  // Pre-load customer if ID is passed in the route
  useEffect(() => {
    if (routeCustomerId) {
      const fetchPreSelectedCustomer = async () => {
        try {
          const res = await apiClient.get<{ customer: Customer }>(`/customers/${routeCustomerId}`);
          setSelectedCustomer(res.customer);
          setStep(2); // Skip Step 1
        } catch {
          toast.error('Failed to load pre-selected customer profile.');
        }
      };
      fetchPreSelectedCustomer();
    }
  }, [routeCustomerId]);

  // Forms setup for each step
  const form1 = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      customerId: '',
      newCustomerName: '',
      newCustomerPhone: '',
      newCustomerAddress: ''
    }
  });

  const form2 = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      brand: '',
      model: '',
      imei: '',
      problem: '',
      quality: 'good',
      physicalDamage: ''
    }
  });

  const form3 = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      estimate: 0,
      advance: 0
    }
  });

  const form4 = useForm<z.infer<typeof step4Schema>>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      deliveryDate: '',
      staffId: '',
      notes: ''
    }
  });

  // Photo handlers
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const url = URL.createObjectURL(file);
      if (side === 'front') {
        setFrontPhoto(file);
        setFrontPreview(url);
      } else {
        setBackPhoto(file);
        setBackPreview(url);
      }
    }
  };

  const removePhoto = (side: 'front' | 'back') => {
    if (side === 'front') {
      setFrontPhoto(null);
      setFrontPreview(null);
    } else {
      setBackPhoto(null);
      setBackPreview(null);
    }
  };

  // Step Navigations
  const handleNextStep1 = async (values: z.infer<typeof step1Schema>) => {
    if (isNewCustomer) {
      if (!values.newCustomerName || !values.newCustomerPhone) {
        toast.error('Please enter name and phone for new customer');
        return;
      }

      // Inline register the customer
      try {
        const res = await apiClient.post<{ customer: Customer }>('/customers', {
          name: values.newCustomerName,
          phone: values.newCustomerPhone,
          address: values.newCustomerAddress
        });
        setSelectedCustomer(res.customer);
        setIsNewCustomer(false);
        setStep(2);
      } catch (err: any) {
        toast.error(err.message || 'Failed to register customer');
      }
    } else {
      if (!selectedCustomer) {
        toast.error('Please select a customer first');
        return;
      }
      setStep(2);
    }
  };

  const handleNextStep2 = () => setStep(3);
  const handleNextStep3 = () => setStep(4);

  // Submitting final payload
  const createRepairMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.post<{ repair: { id: string; job_number: string } }>('/repairs', formData),
    onSuccess: (data) => {
      toast.success(`Repair job registered successfully! Job ID: ${data.repair.job_number}`);
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      navigate(`/repairs/${data.repair.id}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create repair ticket');
    }
  });

  const handleFinalSubmit = (values: z.infer<typeof step4Schema>) => {
    if (!selectedCustomer) return;
    
    const f2Values = form2.getValues();
    const f3Values = form3.getValues();

    const formData = new FormData();
    formData.append('customerId', selectedCustomer.id);
    formData.append('brand', f2Values.brand);
    formData.append('model', f2Values.model);
    if (f2Values.imei) formData.append('imei', f2Values.imei);
    formData.append('problem', f2Values.problem);
    formData.append('quality', f2Values.quality);
    if (f2Values.physicalDamage) formData.append('physicalDamage', f2Values.physicalDamage);
    
    formData.append('estimate', String(f3Values.estimate));
    formData.append('advance', String(f3Values.advance));
    
    if (values.deliveryDate) formData.append('deliveryDate', values.deliveryDate);
    
    // Default staffId to current owner/staff if not selected/allowed
    const finalStaffId = authRole === 'owner' ? values.staffId : authUser?.id;
    if (finalStaffId) formData.append('staffId', finalStaffId);
    
    if (values.notes) formData.append('notes', values.notes);
    if (frontPhoto) formData.append('frontPhoto', frontPhoto);
    if (backPhoto) formData.append('backPhoto', backPhoto);

    createRepairMutation.mutate(formData);
  };

  // Dynamic balance calculations
  const balance = Math.max(0, form3.watch('estimate') - form3.watch('advance'));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Smartphone className="h-6 w-6 text-primary" /> Create Repair Ticket
        </h2>
        <p className="text-muted-foreground text-sm">
          Wizard terminal to register device hardware issues and assign staff.
        </p>
      </div>

      {/* Stepper Progress bar */}
      <div className="flex items-center justify-between bg-card/45 backdrop-blur-md rounded-xl border border-border p-4">
        {[
          { num: 1, label: 'Client', icon: Users },
          { num: 2, label: 'Device details', icon: Smartphone },
          { num: 3, label: 'Financials', icon: DollarSign },
          { num: 4, label: 'Assignment', icon: UserSquare2 }
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2 flex-1 justify-center last:flex-none">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-sm transition-all duration-300 ${
              step >= s.num 
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' 
                : 'bg-secondary text-muted-foreground'
            }`}>
              {step > s.num ? <CheckCircle className="h-4.5 w-4.5" /> : s.num}
            </div>
            <span className={`hidden md:inline text-xs font-semibold ${step >= s.num ? 'text-white' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
            {s.num < 4 && <div className={`hidden md:block h-0.5 flex-1 mx-4 max-w-[60px] ${step > s.num ? 'bg-primary' : 'bg-secondary'}`} />}
          </div>
        ))}
      </div>

      {/* STEP 1: CUSTOMER SELECTION */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-white">Section 1: Customer Coordinate File</CardTitle>
            <CardDescription>Search for an existing shop client or register a new one inline.</CardDescription>
          </CardHeader>
          <form onSubmit={form1.handleSubmit(handleNextStep1)}>
            <CardContent className="space-y-5">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!isNewCustomer ? 'default' : 'outline'}
                  onClick={() => setIsNewCustomer(false)}
                  className="flex-1"
                >
                  Search Existing Database
                </Button>
                <Button
                  type="button"
                  variant={isNewCustomer ? 'default' : 'outline'}
                  onClick={() => setIsNewCustomer(true)}
                  className="flex-1"
                >
                  Create New Inline
                </Button>
              </div>

              {!isNewCustomer ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Type phone or name to search database..."
                      value={phoneSearch}
                      onChange={(e) => setPhoneSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Search Results Autocomplete */}
                  {phoneSearch.length >= 2 && customersSearchData?.customers && (
                    <div className="border border-border/80 rounded-xl overflow-hidden divide-y divide-border/60 bg-secondary/20">
                      {customersSearchData.customers.map((cust) => (
                        <div
                          key={cust.id}
                          onClick={() => {
                            setSelectedCustomer(cust);
                            setPhoneSearch('');
                          }}
                          className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                            selectedCustomer?.id === cust.id 
                              ? 'bg-primary/20 border-l-2 border-primary' 
                              : 'hover:bg-secondary/40'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">{cust.name}</div>
                            <div className="text-xs text-muted-foreground">{cust.phone}</div>
                          </div>
                          <span className="text-[10px] uppercase font-bold text-primary">Select</span>
                        </div>
                      ))}
                      {customersSearchData.customers.length === 0 && (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          No customer matches found.
                        </div>
                      )}
                    </div>
                  )}

                  {selectedCustomer && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Selected Client</span>
                        <h4 className="font-bold text-white text-base mt-0.5">{selectedCustomer.name}</h4>
                        <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setSelectedCustomer(null)}
                        className="rounded-lg p-1 hover:bg-secondary text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-semibold">Client Name</label>
                    <Input
                      placeholder="e.g. Jane Doe"
                      {...form1.register('newCustomerName')}
                      className={form1.formState.errors.newCustomerName ? 'border-destructive/80' : ''}
                    />
                    {form1.formState.errors.newCustomerName && (
                      <p className="text-[11px] font-medium text-destructive mt-0.5">
                        {form1.formState.errors.newCustomerName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-semibold">Contact Phone</label>
                    <Input
                      placeholder="e.g. +1999222333"
                      {...form1.register('newCustomerPhone')}
                      className={form1.formState.errors.newCustomerPhone ? 'border-destructive/80' : ''}
                    />
                    {form1.formState.errors.newCustomerPhone && (
                      <p className="text-[11px] font-medium text-destructive mt-0.5">
                        {form1.formState.errors.newCustomerPhone.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground font-semibold">Address</label>
                    <Input
                      placeholder="Cupertino, California"
                      {...form1.register('newCustomerAddress')}
                    />
                  </div>
                </div>
              )}
            </CardContent>

            <div className="p-6 pt-0 border-t border-border/40 pt-4 flex justify-end">
              <Button type="submit" className="gap-2">
                <span>Continue to Device details</span>
                <ArrowRight className="h-4.5 w-4.5" />
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 2: DEVICE DETAILS */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-white">Section 2: Hardware Characteristics</CardTitle>
            <CardDescription>Register device metrics and physical damages.</CardDescription>
          </CardHeader>
          <form onSubmit={form2.handleSubmit(handleNextStep2)}>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Brand</label>
                <Input placeholder="e.g. Apple, Samsung" {...form2.register('brand')} />
                {form2.formState.errors.brand && (
                  <p className="text-[11px] text-destructive">{form2.formState.errors.brand.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Model</label>
                <Input placeholder="e.g. iPhone 15 Pro, Galaxy S24" {...form2.register('model')} />
                {form2.formState.errors.model && (
                  <p className="text-[11px] text-destructive">{form2.formState.errors.model.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">IMEI / Serial (Optional)</label>
                <Input placeholder="15-digit serial tag" {...form2.register('imei')} />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Physical Quality Condition</label>
                <div className="flex items-center gap-4 mt-2">
                  {['good', 'fair', 'poor', 'damaged'].map((q) => (
                    <label key={q} className="flex items-center gap-1.5 text-xs text-white capitalize cursor-pointer">
                      <input
                        type="radio"
                        value={q}
                        {...form2.register('quality')}
                        className="text-primary focus:ring-primary h-4 w-4 bg-secondary"
                      />
                      <span>{q}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground font-semibold">Problem Description</label>
                <textarea
                  placeholder="Describe hardware issues in details..."
                  {...form2.register('problem')}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-white focus:border-primary focus-visible:outline-none"
                />
                {form2.formState.errors.problem && (
                  <p className="text-[11px] text-destructive">{form2.formState.errors.problem.message}</p>
                )}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground font-semibold">Existing Bezel/Physical Damage</label>
                <textarea
                  placeholder="Shattered screen back, bezels scratched..."
                  {...form2.register('physicalDamage')}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-white focus:border-primary focus-visible:outline-none"
                />
              </div>

              {/* Photos upload preview */}
              <div className="space-y-2 sm:col-span-2 mt-2">
                <label className="text-xs text-muted-foreground font-semibold">Device Hardware Photos</label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Front Photo */}
                  <div className="border border-border/80 border-dashed rounded-xl p-4 text-center bg-secondary/5 relative">
                    {frontPreview ? (
                      <div className="relative h-36 w-full rounded-lg overflow-hidden border border-border bg-card">
                        <img src={frontPreview} alt="Front View" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto('front')}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full text-white hover:bg-black"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-semibold text-white block mb-1">Front Face Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoChange(e, 'front')}
                          className="text-xs text-muted-foreground cursor-pointer w-full"
                        />
                      </div>
                    )}
                  </div>

                  {/* Back Photo */}
                  <div className="border border-border/80 border-dashed rounded-xl p-4 text-center bg-secondary/5 relative">
                    {backPreview ? (
                      <div className="relative h-36 w-full rounded-lg overflow-hidden border border-border bg-card">
                        <img src={backPreview} alt="Back View" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto('back')}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full text-white hover:bg-black"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-semibold text-white block mb-1">Back Cover Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoChange(e, 'back')}
                          className="text-xs text-muted-foreground cursor-pointer w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>

            <div className="p-6 pt-0 border-t border-border/40 pt-4 flex justify-between mt-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4.5 w-4.5 mr-1" /> Previous
              </Button>
              <Button type="submit" className="gap-2">
                <span>Continue to Financials</span>
                <ArrowRight className="h-4.5 w-4.5" />
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 3: FINANCIAL DETAILS */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-white">Section 3: Financial Calculations</CardTitle>
            <CardDescription>Specify repair estimate parameters and collect advances.</CardDescription>
          </CardHeader>
          <form onSubmit={form3.handleSubmit(handleNextStep3)}>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Estimate Fee Amount ($)</label>
                <Input
                  type="number"
                  placeholder="250.00"
                  {...form3.register('estimate', { valueAsNumber: true })}
                />
                {form3.formState.errors.estimate && (
                  <p className="text-[11px] text-destructive">{form3.formState.errors.estimate.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Advance Deposited ($)</label>
                <Input
                  type="number"
                  placeholder="50.00"
                  {...form3.register('advance', { valueAsNumber: true })}
                />
                {form3.formState.errors.advance && (
                  <p className="text-[11px] text-destructive">{form3.formState.errors.advance.message}</p>
                )}
              </div>

              <div className="sm:col-span-2 p-4 bg-secondary/35 border border-border/60 rounded-xl flex items-center justify-between mt-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Balance Outstanding</h4>
                  <p className="text-2xl font-extrabold text-white mt-1">${balance.toFixed(2)}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">Balance = Estimate - Advance</span>
              </div>
            </CardContent>

            <div className="p-6 pt-0 border-t border-border/40 pt-4 flex justify-between mt-4">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4.5 w-4.5 mr-1" /> Previous
              </Button>
              <Button type="submit" className="gap-2">
                <span>Continue to Assignment</span>
                <ArrowRight className="h-4.5 w-4.5" />
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 4: ASSIGNMENT DETAILS */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-white">Section 4: Staff Assignment & Delivery</CardTitle>
            <CardDescription>Assign technicians and schedule target pick-up slots.</CardDescription>
          </CardHeader>
          <form onSubmit={form4.handleSubmit(handleFinalSubmit)}>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold block">Target Delivery Date</label>
                <Input
                  type="date"
                  {...form4.register('deliveryDate')}
                />
                {form4.formState.errors.deliveryDate && (
                  <p className="text-[11px] text-destructive">{form4.formState.errors.deliveryDate.message}</p>
                )}
              </div>

              {authRole === 'owner' ? (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-semibold block">Assign Technician</label>
                  <select
                    {...form4.register('staffId')}
                    className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground focus:border-primary focus-visible:outline-none"
                  >
                    <option value="">Unassigned (Default)</option>
                    {staffData?.staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.staff_id || 'owner'})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1 flex flex-col justify-end">
                  <div className="p-3 bg-secondary/25 border border-border/80 rounded-xl">
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Assigned Staff</span>
                    <span className="text-xs font-semibold text-white">{authUser?.name} (You)</span>
                  </div>
                </div>
              )}

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground font-semibold">Notes / Special Instructions</label>
                <textarea
                  placeholder="Instructions for screens or battery replacements..."
                  {...form4.register('notes')}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-white focus:border-primary focus-visible:outline-none"
                />
              </div>
            </CardContent>

            <div className="p-6 pt-0 border-t border-border/40 pt-4 flex justify-between mt-4">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4.5 w-4.5 mr-1" /> Previous
              </Button>
              <Button type="submit" disabled={createRepairMutation.isPending} className="gap-1.5">
                {createRepairMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" /> Submit Repair Order
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
