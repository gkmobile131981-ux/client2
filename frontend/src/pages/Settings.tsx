import React, { useState, useEffect, useRef } from 'react';
import RateCards from './RateCards';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Save, 
  Smartphone, 
  Building, 
  ShieldAlert, 
  Users, 
  UserPlus, 
  KeyRound, 
  Lock, 
  Loader2, 
  ToggleLeft, 
  ToggleRight, 
  Trash2, 
  Shield, 
  UserCog, 
  Mail, 
  Calendar, 
  Search, 
  RefreshCw, 
  Info,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Star,
  Bell,
  FileText,
  Phone,
  ChevronRight,
  ShieldCheck,
  MessageSquare,
  ClipboardList
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '../components/ui/Table';
import { Dialog } from '../components/ui/Dialog';
import { SkeletonList, Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

// Validation Schemas
const addStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().optional(),
  password: z.string().optional()
});

const accountProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmNewPassword: z.string().min(6, 'Confirm password is required')
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords do not match",
  path: ["confirmNewPassword"]
});

type AddStaffFormValues = z.infer<typeof addStaffSchema>;
type AccountProfileFormValues = z.infer<typeof accountProfileSchema>;
type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

interface StaffMember {
  id: string;
  name: string;
  email?: string;
  role: 'owner' | 'staff';
  staff_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface SettingsPageProps {
  defaultTab?: string;
}

export default function SettingsPage({ defaultTab }: SettingsPageProps = {}) {
  const { user, role, shop, reloadProfile } = useAuth();
  const isOwner = role === 'owner';
  const superAdminEmails = [
    'gkmobile131981@gmail.com',
    'admin@gkrepair.com',
    'test@gkrepair.com'
  ];
  const isSuperAdmin = !!(user && ((user.role as string) === 'superadmin' || (user.email && superAdminEmails.includes(user.email.toLowerCase().trim()))));
  const navigate = useNavigate();
  
  // Shop Profile state
  const [shopName, setShopName] = useState(shop?.name || '');
  const [shopAddress, setShopAddress] = useState(shop?.address || '');
  const [shopPhone, setShopPhone] = useState(shop?.phone || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(shop?.logo_url || null);
  const [savingShop, setSavingShop] = useState(false);
  
  // Staff Directory state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const [recruiting, setRecruiting] = useState(false);
  
  // Account Form Hook States
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Modal Open/Close States
  const [isEditShopOpen, setIsEditShopOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isStaffMgmtOpen, setIsStaffMgmtOpen] = useState(defaultTab === 'staff');
  const [isRateCardsOpen, setIsRateCardsOpen] = useState(defaultTab === 'create-price');
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(defaultTab === 'whatsapp');

  // WhatsApp logs state
  const [whatsAppLogs, setWhatsAppLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchWhatsAppLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await apiClient.get<{ logs: any[] }>('/repairs/whatsapp/logs');
      setWhatsAppLogs(data.logs || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load WhatsApp logs.');
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isWhatsAppOpen) {
      fetchWhatsAppLogs();
    }
  }, [isWhatsAppOpen]);

  // Generic Mock Info Modal State
  const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
  const [genericModalTitle, setGenericModalTitle] = useState('');
  const [genericModalDescription, setGenericModalDescription] = useState('');
  const [genericModalContent, setGenericModalContent] = useState('');

  const logoInputRef = useRef<HTMLInputElement>(null);

  // Forms
  const {
    register: registerStaff,
    handleSubmit: handleSubmitStaff,
    reset: resetStaff,
    formState: { errors: staffErrors }
  } = useForm<AddStaffFormValues>({
    resolver: zodResolver(addStaffSchema)
  });

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset: resetProfile,
    formState: { errors: profileErrors }
  } = useForm<AccountProfileFormValues>({
    resolver: zodResolver(accountProfileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || ''
    }
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors }
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema)
  });

  // Sync shop values when auth loads
  useEffect(() => {
    if (shop) {
      setShopName(shop.name);
      setShopAddress(shop.address || '');
      setShopPhone(shop.phone || '');
      setLogoPreview(shop.logo_url);
    }
  }, [shop]);

  // Sync user profile values when auth loads
  useEffect(() => {
    if (user) {
      resetProfile({
        name: user.name,
        email: user.email
      });
    }
  }, [user, resetProfile]);

  // Load Staff directory
  const fetchStaff = async () => {
    if (!isOwner) return;
    setLoadingStaff(true);
    try {
      const data = await apiClient.get<{ staff: StaffMember[] }>('/auth/staff');
      setStaffList(data.staff);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load staff list.');
    } finally {
      setLoadingStaff(false);
    }
  };

  // Fetch staff list when staff modal opens
  useEffect(() => {
    if (isStaffMgmtOpen) {
      fetchStaff();
    }
  }, [isStaffMgmtOpen]);

  // File logo pickers
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        toast.error('File too large. Shop logo must be smaller than 1MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = async () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (!shop?.logo_url) return;

    try {
      setSavingShop(true);
      const formData = new FormData();
      formData.append('name', shopName);
      formData.append('address', shopAddress);
      formData.append('phone', shopPhone);
      formData.append('removeLogo', 'true');
      
      await apiClient.put('/auth/shop', formData);
      toast.success('Logo removed successfully.');
      await reloadProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove shop logo');
    } finally {
      setSavingShop(false);
    }
  };

  // Save Shop details
  const onSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      toast.error('Shop name is required.');
      return;
    }
    setSavingShop(true);
    try {
      const formData = new FormData();
      formData.append('name', shopName);
      formData.append('address', shopAddress);
      formData.append('phone', shopPhone);
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      await apiClient.put('/auth/shop', formData);
      toast.success('Shop details saved successfully!');
      setLogoFile(null);
      await reloadProfile();
      setIsEditShopOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update shop details');
    } finally {
      setSavingShop(false);
    }
  };

  // Recruit Staff onSubmit
  const onRecruitStaff = async (values: AddStaffFormValues) => {
    setRecruiting(true);
    try {
      const payload = {
        name: values.name.trim(),
        email: `staff_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}@gkmobile.com`,
        password: `Staff@${Math.random().toString(36).slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`
      };
      await apiClient.post('/auth/create-staff', payload);
      toast.success('Staff assistant recruited successfully!');
      setRecruitOpen(false);
      resetStaff();
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to recruit staff member');
    } finally {
      setRecruiting(false);
    }
  };

  // Toggle Staff status
  const handleToggleStaff = async (staffId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    try {
      const data = await apiClient.put<{ staff: StaffMember }>(`/auth/staff/${staffId}`);
      toast.success(`Staff member successfully ${action}d!`);
      setStaffList((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, is_active: data.staff.is_active } : s))
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || `Failed to toggle staff status.`);
    }
  };

  // Send staff reset password recovery link
  const handleResetStaffPassword = async (staffId: string) => {
    const loadingToast = toast.loading('Sending password recovery email...');
    try {
      await apiClient.post('/auth/reset-staff-password', { staffId });
      toast.success('Recovery link sent to assistant email.', { id: loadingToast });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send recovery email.', { id: loadingToast });
    }
  };

  // Update Account Profile
  const onSaveProfile = async (values: AccountProfileFormValues) => {
    setSavingProfile(true);
    try {
      await apiClient.put('/auth/update-profile', values);
      toast.success('Profile details updated successfully.');
      await reloadProfile();
      setIsEditProfileOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update profile details.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
  const onChangePassword = async (values: ChangePasswordFormValues) => {
    setSavingPassword(true);
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });
      toast.success('Password changed successfully!');
      resetPassword();
      setIsChangePasswordOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleMenuClick = (menuId: string) => {
    switch (menuId) {
      case 'offers':
        setGenericModalTitle("ALL OFFERS & NOTIFICATIONS");
        setGenericModalDescription("Active campaigns, announcements and terminal alerts.");
        setGenericModalContent("Offers & System Alerts:\n1. Parts channel logistics discounts: 15% off on batch screen shipments.\n2. Community technical webinars starting next Friday.\n3. Dynamic billing reports are now live for all registered shops.");
        setIsGenericModalOpen(true);
        break;
      case 'community':
        setGenericModalTitle("Community Connection Portal");
        setGenericModalDescription("Engage with micro-electronics engineers worldwide.");
        setGenericModalContent(`User Community Username: ${user?.community_username || user?.name || 'N/A'}\nShop Type: ${shop?.shop_type || 'Mobile Solution'}\n\nFeatures:\n- Schematics board diagnostics forum.\n- Solder reballing repair guides.\n- Part supplier reviews.`);
        setIsGenericModalOpen(true);
        break;
      case 'purchases':
        setGenericModalTitle("Purchasing History Database");
        setGenericModalDescription("Manage supply chain transactions and hardware acquisitions.");
        setGenericModalContent("Purchase logs are archived per calendar year. Connect parts vendors to automatically sync invoices to your local terminal store node.\n\nActive Vendor Syncs: 0\nPending Invoices: 0");
        setIsGenericModalOpen(true);
        break;
      case 'ratecards':
        if (isSuperAdmin) {
          setIsRateCardsOpen(true);
        } else {
          toast.error("Access Denied: Service Rate Cards can only be updated by the platform Admin.");
        }
        break;
      case 'deleted':
        setGenericModalTitle("Trash & Order Retention Archive");
        setGenericModalDescription("Logs of job orders flagged as deleted.");
        setGenericModalContent("Orders remain in the trash database partition for 30 days before clean-up. Non-owners are restricted from purging deleted records.");
        setIsGenericModalOpen(true);
        break;
      case 'email':
        setIsEditProfileOpen(true);
        break;
      case 'password':
        setIsChangePasswordOpen(true);
        break;
      case 'terms':
        setGenericModalTitle("GK Repair Solution Terms & Conditions");
        setGenericModalDescription("License terms of software platform service.");
        setGenericModalContent("This system is licensed on a single-node owner basis. All database records (customers, repairs, devices) are stored in your isolated database schema under your Supabase tenant. Terms apply per terminal.");
        setIsGenericModalOpen(true);
        break;
      case 'privacy':
        setGenericModalTitle("Data Privacy Policy");
        setGenericModalDescription("Policies regarding data handling.");
        setGenericModalContent("Your data is end-to-end isolated under secure RLS policies. Your staff members only have permission to view tickets explicitly assigned to their technician ID.");
        setIsGenericModalOpen(true);
        break;
      case 'about':
        setGenericModalTitle("About Terminal Node");
        setGenericModalDescription("GK Repair Software Version Details");
        setGenericModalContent(`App Version: 1.0.0 (Stable release)\nDatabase Scheme: Supabase RLS Protected\nUser Name: ${user?.name}\nShop Name: ${shop?.name}`);
        setIsGenericModalOpen(true);
        break;
      case 'contact':
        setGenericModalTitle("Support & Admin Contacts");
        setGenericModalDescription("Reach technical support desk.");
        setGenericModalContent("If you experience database syncing issues, auth timeouts or terminal outages, please email support@gkrepair.com or contact terminal network administrators at +1 (800) 555-0199.");
        setIsGenericModalOpen(true);
        break;
      case 'staff':
        if (isOwner) {
          setIsStaffMgmtOpen(true);
        } else {
          toast.error("Access Denied: Owner profile privilege required to recruit or manage staff.");
        }
        break;
      case 'whatsapp':
        if (isOwner) {
          setIsWhatsAppOpen(true);
        } else {
          toast.error("Access Denied: Owner profile privilege required to access WhatsApp logs.");
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12 select-none text-white">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Management Settings
        </h2>
        <p className="text-muted-foreground text-sm">Configure GK Repair details, staff logins, invoice terms, and policies.</p>
      </div>

      {/* Profile Banner Card */}
      <Card className="relative bg-card/90 border border-border/85 p-6 flex items-center justify-center">
        {isOwner && (
          <button
            onClick={() => setIsEditShopOpen(true)}
            className="absolute top-4 right-4 inline-flex items-center justify-center rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/45 px-3 py-1.5 text-xs font-semibold text-primary transition-all active:scale-[0.98]"
          >
            Edit Details
          </button>
        )}
        
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative h-20 w-20 rounded-full border-2 border-primary overflow-hidden bg-secondary/35 group flex items-center justify-center shrink-0 shadow-lg">
            {logoPreview ? (
              <img src={logoPreview} alt="Shop Logo" className="h-full w-full object-cover" />
            ) : (
              <Building className="h-10 w-10 text-muted-foreground/60" />
            )}
          </div>

          <div className="text-center sm:text-left space-y-1">
            <h3 className="text-lg font-extrabold text-white tracking-tight leading-tight">
              {user?.name || 'Loading Name...'}
            </h3>
            <p className="text-sm font-semibold text-muted-foreground">{shopName || 'GK Repair Shop'}</p>
            <p className="text-xs text-muted-foreground/80">{shopPhone || 'No Phone Registered'}</p>
          </div>
        </div>

      </Card>

      {/* Settings Options List Menu */}
      <div className="bg-card/90 border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/60 shadow-lg">
        {[
          { id: 'community', title: 'Community', desc: 'Connect with other Technicians for help or support', icon: Users, color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' },
          { id: 'deleted', title: 'Deleted Orders', desc: 'Track and recover deleted order history', icon: Trash2, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
          { id: 'whatsapp', title: 'WhatsApp Notifications', desc: 'Monitor automated updates status and system log audits', icon: MessageSquare, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', ownerOnly: true },
          { id: 'email', title: 'Update email', desc: 'Update Display Name and Account Email ID', icon: Mail, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
          { id: 'password', title: 'Update password', desc: 'Verify current credentials and change password', icon: Lock, color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20' },
          { id: 'terms', title: 'Update Terms & Conditions', desc: 'Review solution usage and software licensing terms', icon: FileText, color: 'text-zinc-500', bg: 'bg-zinc-500/10 border-zinc-500/20' },
          { id: 'privacy', title: 'Privacy Policy', desc: 'App terms of collection and data privacy policies', icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { id: 'about', title: 'About', desc: 'Software terminal version details and developer info', icon: Info, color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
          { id: 'contact', title: 'Contacts Us', desc: 'Reach our terminal network administration support desk', icon: Phone, color: 'text-pink-500', bg: 'bg-pink-500/10 border-pink-500/20' },
          { id: 'staff', title: 'Add Staff Members', desc: 'Recruit terminal assistants, set status, and manage logins', icon: UserPlus, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20', ownerOnly: true },
          { id: 'ratecards', title: 'Create Repair Price', desc: 'Configure standard repair labor costs and invoicing terms', icon: ClipboardList, color: 'text-primary', bg: 'bg-primary/10 border-primary/20', superAdminOnly: true }
        ].filter(item => {
          if (item.superAdminOnly) return isSuperAdmin;
          if (item.ownerOnly) return isOwner;
          return true;
        }).map((item) => (
          <div
            key={item.id}
            onClick={() => handleMenuClick(item.id)}
            className="p-4 flex items-center justify-between hover:bg-secondary/25 cursor-pointer transition-all active:scale-[0.99] gap-4"
          >
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${item.bg}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-foreground">{item.title}</span>
                <span className="text-xs text-muted-foreground/80 leading-snug">{item.desc}</span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------- */}
      {/* DIALOG MODALS SECTION */}
      {/* ---------------------------------------------------- */}

      {/* Modal 1: Edit Shop Details */}
      <Dialog
        isOpen={isEditShopOpen}
        onClose={() => setIsEditShopOpen(false)}
        title="Shop Credentials"
        description="Update brand name, telephone contacts, address, and receipts logo."
      >
        <form onSubmit={onSaveShop} className="space-y-5">
          {/* Logo Area */}
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-border/40">
            <div className="relative h-24 w-24 rounded-xl border border-border bg-secondary/20 flex items-center justify-center overflow-hidden shrink-0 group shadow-inner">
              {logoPreview ? (
                <img src={logoPreview} alt="Shop Logo Preview" className="h-full w-full object-contain" />
              ) : (
                <Building className="h-10 w-10 text-muted-foreground/60" />
              )}
            </div>
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <h4 className="text-sm font-bold text-foreground">Receipt Logo</h4>
              <p className="text-xs text-muted-foreground">Formats: JPEG, PNG, WEBP. Max: 1MB.</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <label className="cursor-pointer inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all">
                  Browse Image
                  <input type="file" ref={logoInputRef} accept="image/*" onChange={handleLogoChange} className="hidden" disabled={!isOwner} />
                </label>
                {logoPreview && isOwner && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Store Brand Name</label>
              <Input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                disabled={!isOwner}
                placeholder="Shop Name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-semibold">Store Phone Contact</label>
              <Input
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                disabled={!isOwner}
                placeholder="+123 456 7890"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground font-semibold">Shop Physical Address</label>
              <Input
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                disabled={!isOwner}
                placeholder="Street Address, City, Country"
              />
            </div>
          </div>

          {isOwner && (
            <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
              <Button type="button" variant="outline" onClick={() => setIsEditShopOpen(false)} disabled={savingShop}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingShop} className="gap-2">
                {savingShop ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </Dialog>

      {/* Modal 2: Edit Account Profile */}
      <Dialog
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        title="Profile Details"
        description="Update your display name and primary account email ID."
      >
        <form onSubmit={handleSubmitProfile(onSaveProfile)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Display Name</label>
            <Input {...registerProfile('name')} placeholder="Full Name" />
            {profileErrors.name && (
              <p className="text-[11px] font-medium text-destructive">{profileErrors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Email Address</label>
            <Input type="email" {...registerProfile('email')} placeholder="email@address.com" />
            {profileErrors.email && (
              <p className="text-[11px] font-medium text-destructive">{profileErrors.email.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsEditProfileOpen(false)} disabled={savingProfile}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingProfile} className="gap-2">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Update Profile
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal 3: Change Password */}
      <Dialog
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        title="Change Password"
        description="Change password settings to keep terminal credentials secure."
      >
        <form onSubmit={handleSubmitPassword(onChangePassword)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrentPass ? 'text' : 'password'}
                {...registerPassword('currentPassword')}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors.currentPassword && (
              <p className="text-[11px] font-medium text-destructive">{passwordErrors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">New Password</label>
            <div className="relative">
              <Input
                type={showNewPass ? 'text' : 'password'}
                {...registerPassword('newPassword')}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors.newPassword && (
              <p className="text-[11px] font-medium text-destructive">{passwordErrors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-semibold">Confirm New Password</label>
            <Input
              type="password"
              {...registerPassword('confirmNewPassword')}
              placeholder="••••••••"
            />
            {passwordErrors.confirmNewPassword && (
              <p className="text-[11px] font-medium text-destructive">{passwordErrors.confirmNewPassword.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setIsChangePasswordOpen(false)} disabled={savingPassword}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingPassword} className="gap-2">
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Update Password
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal 4: Staff Directory Management */}
      <Dialog
        isOpen={isStaffMgmtOpen}
        onClose={() => {
          setIsStaffMgmtOpen(false);
          if (defaultTab === 'staff') {
            navigate('/settings');
          }
        }}
        title="Store Staff Directory"
        description="Recruit assistants, manage logins, and toggle credentials."
        className="max-w-3xl w-full"
      >
        <div className="space-y-5 max-w-3xl overflow-y-auto max-h-[70vh] pr-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Staff List ({staffList.length})
            </span>
            <Button size="sm" onClick={() => setRecruitOpen(true)} className="gap-1.5 h-8">
              <UserPlus className="h-3.5 w-3.5" /> Recruit Staff
            </Button>
          </div>

          {loadingStaff ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-semibold">Loading list...</span>
            </div>
          ) : staffList.length > 0 ? (
            <div className="border border-border rounded-xl overflow-hidden bg-card/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Badge ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono text-xs text-primary font-bold">
                        {emp.staff_id || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground text-xs">{emp.name}</div>
                      </TableCell>
                      <TableCell className="capitalize text-xs text-muted-foreground">
                        {emp.role}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          emp.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleResetStaffPassword(emp.id)}
                            title="Send Reset Password recovery"
                            className="p-1.5 border border-border hover:bg-secondary/40 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStaff(emp.id, emp.is_active)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                              emp.is_active
                                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {emp.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed border-border rounded-xl">
              <ShieldAlert className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground font-semibold">No active staff assistants registered.</p>
            </div>
          )}
        </div>
      </Dialog>

      {/* Recruit Inline Dialog Overlay */}
      <Dialog
        isOpen={recruitOpen}
        onClose={() => setRecruitOpen(false)}
        title="Recruit Staff Member"
        description="Add a new terminal assistant by entering their full name."
      >
        <form onSubmit={handleSubmitStaff(onRecruitStaff)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground block">Full Name</label>
            <Input placeholder="Employee Name" {...registerStaff('name')} />
            {staffErrors.name && (
              <p className="text-[11px] font-medium text-destructive">{staffErrors.name.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => setRecruitOpen(false)} disabled={recruiting}>
              Cancel
            </Button>
            <Button type="submit" disabled={recruiting}>
              {recruiting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Recruit Member
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal 5: Service Rate Cards & Terms */}
      <Dialog
        isOpen={isRateCardsOpen}
        onClose={() => {
          setIsRateCardsOpen(false);
          if (defaultTab === 'create-price') {
            navigate('/settings');
          }
        }}
        title="Service Rate Cards & Invoice Config"
        description="Configure standard repair labor costs and invoicing terms."
        className="max-w-3xl w-full"
      >
        <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Define labor rates per model and service action. These rate cards are queried by the terminal order system to auto-fill ticket estimates.
          </p>
          <RateCards />
        </div>
      </Dialog>

      {/* Modal: WhatsApp Integration Logs */}
      <Dialog
        isOpen={isWhatsAppOpen}
        onClose={() => {
          setIsWhatsAppOpen(false);
          if (defaultTab === 'whatsapp') {
            navigate('/settings');
          }
        }}
        title="WhatsApp Notification Hub"
        description="Review automated notification templates, sync configurations, and transmission audit logs."
        className="max-w-3xl w-full"
      >
        <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-1 select-none text-foreground">
          {/* Config card */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 bg-secondary/15 border border-border/60 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Sync Engine Setup</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Automated status updates are dispatched on ticket creation, technician state transitions, and delivery closures. To switch providers, configure your <code className="font-mono text-primary bg-secondary/40 px-1 py-0.5 rounded text-[10px]">backend/.env</code>:
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-[9px] text-foreground/90 bg-secondary/20 p-2.5 rounded-lg border border-border/40">
                <div>
                  <span className="text-muted-foreground block text-[8px] uppercase font-bold mb-0.5">Twilio SMS Gateway</span>
                  WHATSAPP_PROVIDER=twilio<br />
                  TWILIO_ACCOUNT_SID=...<br />
                  TWILIO_AUTH_TOKEN=...
                </div>
                <div>
                  <span className="text-muted-foreground block text-[8px] uppercase font-bold mb-0.5">Meta Cloud API (Official)</span>
                  WHATSAPP_PROVIDER=meta<br />
                  WHATSAPP_META_ACCESS_TOKEN=...<br />
                  WHATSAPP_META_PHONE_NUMBER_ID=...
                </div>
              </div>
            </div>
            
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active Engine
                </h4>
                <p className="text-[11px] text-emerald-300/80 leading-relaxed mt-2">
                  Sandbox / Mock mode is active by default. It captures updates in our audit panel below without incurring carrier fees.
                </p>
              </div>
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-2">
                Running in Sandbox
              </div>
            </div>
          </div>

          {/* Audit Logs Area */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Notification Feed ({whatsAppLogs.length})
              </span>
              <Button size="sm" variant="outline" onClick={fetchWhatsAppLogs} className="gap-1.5 h-8 border-border/80 hover:bg-secondary/40">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                <span>Refresh Log</span>
              </Button>
            </div>

            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground font-semibold">Loading log feed...</span>
              </div>
            ) : whatsAppLogs.length > 0 ? (
              <div className="border border-border rounded-xl overflow-hidden bg-card/10 max-h-[40vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Number</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status Stage</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message Log</TableHead>
                      <TableHead className="text-right">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {whatsAppLogs.map((log, idx) => (
                      <TableRow key={log.id + idx} className="hover:bg-secondary/15">
                        <TableCell className="font-mono text-xs text-primary font-bold">
                          {log.jobNumber}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground text-xs">{log.recipientName}</div>
                          <div className="text-[10px] text-muted-foreground">{log.recipientPhone}</div>
                        </TableCell>
                        <TableCell className="capitalize text-xs">
                          <span className="font-bold text-foreground uppercase bg-secondary/80 border border-border/60 rounded px-1.5 py-0.5">
                            {log.stage}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            log.status === 'sent' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : log.status === 'failed' 
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {log.status === 'sent' ? 'Sent' : log.status === 'failed' ? 'Failed' : 'Sandbox'}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-[11px] text-muted-foreground/90 font-medium" title={log.message}>
                          {log.message.split('\n')[2] || log.message}
                        </TableCell>
                        <TableCell className="text-right text-[10px] text-muted-foreground font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          <div className="text-[8px] opacity-75">{new Date(log.timestamp).toLocaleDateString()}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 border border-dashed border-border rounded-xl">
                <Bell className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2 animate-pulse" />
                <p className="text-xs text-muted-foreground font-semibold">No sync updates dispatched in this session.</p>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Modal 6: Generic Info Modal */}
      <Dialog
        isOpen={isGenericModalOpen}
        onClose={() => setIsGenericModalOpen(false)}
        title={genericModalTitle}
        description={genericModalDescription}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
            {genericModalContent}
          </p>
          <div className="flex justify-end pt-4 border-t border-border/40">
            <Button onClick={() => setIsGenericModalOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
