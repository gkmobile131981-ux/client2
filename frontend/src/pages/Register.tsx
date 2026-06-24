import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import { supabase } from '../lib/supabase';
import logo from '../logo.png';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { 
  Mail, 
  Lock, 
  User, 
  Building, 
  MapPin, 
  Loader2, 
  ChevronDown, 
  LayoutGrid,
  Receipt,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Smartphone
} from 'lucide-react';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  shopType: z.string().min(1, 'Please select a shop type'),
  shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
  gstNumber: z.string().optional(),
  name: z.string().min(2, 'Owner name must be at least 2 characters'),
  communityUsername: z.string().min(2, 'Username must be at least 2 characters'),
  countryCode: z.string().default('+91'),
  phoneNumberOnly: z.string().min(5, 'Phone number must be at least 5 characters'),
  shopAddress: z.string().min(5, 'Address must be at least 5 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  currencyCode: z.string().default('INR'),
  currencySymbol: z.string().default('₹')
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const shopTypes = [
  'Mobile Repair',
  'Laptop Repair',
  'Electronics Store',
  'Automobile Repair',
  'Watch Repair',
  'Appliance Service',
  'Other Services'
];

const countries = [
  { flag: '🇮🇳', code: 'IN', prefix: '+91' },
  { flag: '🇺🇸', code: 'US', prefix: '+1' },
  { flag: '🇬🇧', code: 'GB', prefix: '+44' },
  { flag: '🇦🇪', code: 'AE', prefix: '+971' },
  { flag: '🇸🇦', code: 'SA', prefix: '+966' },
  { flag: '🇨🇦', code: 'CA', prefix: '+1' },
  { flag: '🇦🇺', code: 'AU', prefix: '+61' }
];

export default function Register() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      shopType: '',
      shopName: '',
      gstNumber: '',
      name: '',
      communityUsername: '',
      countryCode: '+91',
      phoneNumberOnly: '',
      shopAddress: '',
      email: '',
      password: '',
      currencyCode: 'INR',
      currencySymbol: '₹'
    }
  });

  const selectedCountryCode = watch('countryCode');
  const selectedCountry = countries.find(c => c.prefix === selectedCountryCode) || countries[0];

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        toast.error('Logo file size must be smaller than 1MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('email', values.email);
      formData.append('password', values.password);
      formData.append('shopName', values.shopName);
      formData.append('shopAddress', values.shopAddress);
      
      const fullPhone = `${values.countryCode} ${values.phoneNumberOnly}`;
      formData.append('shopPhone', fullPhone);
      formData.append('shopType', values.shopType);
      formData.append('gstNumber', values.gstNumber || '');
      formData.append('communityUsername', values.communityUsername);
      formData.append('currencyCode', values.currencyCode);
      formData.append('currencySymbol', values.currencySymbol);

      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const data = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: any;
        shop: any;
      }>('/auth/register-owner', formData);

      localStorage.setItem('gk_access_token', data.accessToken);
      localStorage.setItem('gk_refresh_token', data.refreshToken);

      await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken
      });

      toast.success('Shop registered and logged in!');
      setTimeout(() => {
        navigate('/');
      }, 500);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-y-auto py-12">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-2xl bg-card/45 backdrop-blur-xl border-border/80 shadow-2xl">
        <CardHeader className="space-y-3.5 text-center flex flex-col items-center">
          <div className="mx-auto h-12 w-full max-w-[240px] overflow-hidden bg-white rounded-lg p-1.5 flex items-center justify-center">
            <img src={logo} alt="Association Logo" className="h-full w-full object-contain" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Register Owner & Shop</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Initialize a new Association terminal node. Start managing jobs instantly.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            
            {/* Section 1: Shop Details */}
            <div className="space-y-4 sm:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1">
                Shop Properties
              </h3>
            </div>

            {/* Shop Type Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" /> Select Shop Type
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus-visible:outline-none"
                {...register('shopType')}
              >
                <option value="" className="bg-card text-muted-foreground">Select Shop Type</option>
                {shopTypes.map((type) => (
                  <option key={type} value={type} className="bg-card text-foreground">{type}</option>
                ))}
              </select>
              {errors.shopType && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.shopType.message}</p>
              )}
            </div>

            {/* Shop Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" /> Shop Name
              </label>
              <Input
                placeholder="Shop Name"
                {...register('shopName')}
                className={errors.shopName ? 'border-destructive/80' : ''}
              />
              {errors.shopName && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.shopName.message}</p>
              )}
            </div>

            {/* Shop GST Number Optional */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Shop GST Number (Optional)
              </label>
              <Input
                placeholder="Shop GST Number (Optional)"
                {...register('gstNumber')}
              />
            </div>

            {/* Phone Number Input Group */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" /> Phone Number
              </label>
              <div className={`flex h-10 w-full rounded-md border ${errors.phoneNumberOnly ? 'border-destructive/80' : 'border-input'} bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background`}>
                <div className="relative flex items-center gap-1.5 cursor-pointer pr-2 select-none shrink-0" onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}>
                  <span className="text-base">{selectedCountry.flag}</span>
                  <span className="font-semibold text-foreground">{selectedCountry.prefix}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  {countryDropdownOpen && (
                    <div className="absolute top-10 left-0 w-48 bg-card border border-border rounded-md shadow-xl z-20 max-h-60 overflow-y-auto p-1">
                      {countries.map((c) => (
                        <div
                          key={c.code}
                          onClick={(e) => {
                            e.stopPropagation();
                            setValue('countryCode', c.prefix);
                            setCountryDropdownOpen(false);
                          }}
                          className="px-3 py-2 hover:bg-accent rounded-md cursor-pointer flex items-center gap-2 text-xs text-foreground font-semibold"
                        >
                          <span>{c.flag}</span>
                          <span>{c.code} ({c.prefix})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="h-full w-[1px] bg-border mx-2 shrink-0" />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  {...register('phoneNumberOnly')}
                />
              </div>
              {errors.phoneNumberOnly && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.phoneNumberOnly.message}</p>
              )}
            </div>

            {/* Owner Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Owner Name
              </label>
              <Input
                placeholder="Owner Name"
                {...register('name')}
                className={errors.name ? 'border-destructive/80' : ''}
              />
              {errors.name && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.name.message}</p>
              )}
            </div>

            {/* User Name For Community Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> User Name For Community
              </label>
              <Input
                placeholder="User Name For Community"
                {...register('communityUsername')}
                className={errors.communityUsername ? 'border-destructive/80' : ''}
              />
              {errors.communityUsername && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.communityUsername.message}</p>
              )}
            </div>

            {/* Full Address Textarea */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Full Address
              </label>
              <textarea
                placeholder="Full Address"
                rows={2}
                className={`flex min-h-[60px] w-full rounded-md border ${errors.shopAddress ? 'border-destructive/80' : 'border-input'} bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none`}
                {...register('shopAddress')}
              />
              {errors.shopAddress && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.shopAddress.message}</p>
              )}
            </div>

            {/* Section 2: Account Details */}
            <div className="space-y-4 sm:col-span-2 mt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1">
                Account Details
              </h3>
            </div>

            {/* Email ID Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email ID
              </label>
              <Input
                type="email"
                placeholder="john@gkrepair.com"
                {...register('email')}
                className={errors.email ? 'border-destructive/80' : ''}
              />
              {errors.email && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.email.message}</p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Password (At least 8 Chars)
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (At least 8 Chars)"
                  {...register('password')}
                  className={`pr-10 ${errors.password ? 'border-destructive/80' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.password.message}</p>
              )}
            </div>

            {/* Currency Symbol Custom Container */}
            <fieldset className="border border-border rounded-md px-3 pb-3 pt-1.5 relative bg-card/25 sm:col-span-2">
              <legend className="text-xs text-muted-foreground px-1.5 ml-2 font-bold bg-[#0c0a09]">
                Currency Symbol
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative flex items-center border-b border-border py-1">
                  <span className="text-sm font-bold text-muted-foreground mr-2">₹</span>
                  <input
                    type="text"
                    placeholder="Code (e.g. INR)"
                    className="w-full bg-transparent border-none outline-none text-sm text-foreground font-semibold placeholder:text-muted-foreground focus:outline-none"
                    {...register('currencyCode')}
                  />
                </div>
                <div className="relative flex items-center border-b border-border py-1">
                  <span className="text-sm font-bold text-muted-foreground mr-2">₹</span>
                  <input
                    type="text"
                    placeholder="Symbol (e.g. ₹)"
                    className="w-full bg-transparent border-none outline-none text-sm text-foreground font-semibold placeholder:text-muted-foreground focus:outline-none"
                    {...register('currencySymbol')}
                  />
                </div>
              </div>
            </fieldset>

            {/* Shop Logo Selector Card */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border border-border rounded-md p-3.5 flex items-center justify-between bg-card/10 border-dashed cursor-pointer hover:bg-card/25 transition-all hover:border-muted-foreground sm:col-span-2"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center overflow-hidden border border-border shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-foreground">Shop Logo</span>
                  <span className="text-[10px] text-muted-foreground">Select jpg or png image</span>
                </div>
              </div>
              
              <div className="text-primary text-xl font-bold pr-2 select-none">
                +
              </div>

              <input 
                type="file"
                ref={fileInputRef}
                accept="image/png, image/jpeg, image/jpg"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>

          </CardContent>

          <CardFooter className="flex flex-col gap-4 border-t border-border/40 pt-6">
            <Button type="submit" disabled={isSubmitting} className="w-full h-11">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering Shop...
                </>
              ) : (
                'Register & Sign In'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Already have a shop registered?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Log In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
