import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSearchParams, Link } from 'react-router-dom';
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
  EyeOff
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { Dialog } from '../components/ui/Dialog';
import { SkeletonList, Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

// Validation Schemas
const addStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
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

interface AuditLog {
  id: string;
  repair_id: string;
  changed_by: string;
  old_status: string;
  new_status: string;
  note: string;
  created_at: string;
  old_value: string | null;
  new_value: string | null;
  repair: {
    id: string;
    job_number: string;
    device: {
      id: string;
      brand: string;
      model: string;
    };
  };
  changer: {
    id: string;
    name: string;
    role: string;
  } | null;
}

interface SettingsPageProps {
  defaultTab?: string;
}

export default function SettingsPage({ defaultTab = 'shop' }: SettingsPageProps) {
  const { user, role, shop, reloadProfile } = useAuth();
  const isOwner = role === 'owner';
  
  // Tab Management
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (defaultTab === 'staff' && isOwner) return 'staff';
    return 'shop';
  });

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

  // System Audit state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [filterStaff, setFilterStaff] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

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

  // Load Audit logs
  const fetchLogs = async (page: number, append = false) => {
    if (!isOwner) return;
    setLoadingLogs(true);
    try {
      let url = `/audit?page=${page}&limit=10`;
      if (filterStaff) url += `&staffId=${filterStaff}`;
      if (filterFrom) url += `&from=${filterFrom}`;
      if (filterTo) url += `&to=${filterTo}`;

      const data = await apiClient.get<{ logs: AuditLog[]; hasMore: boolean }>(url);
      if (append) {
        setLogs((prev) => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs);
      }
      setHasMoreLogs(data.hasMore);
      setLogsPage(page);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to retrieve audit log feed.');
    } finally {
      setLoadingLogs(false);
    }
  };

  // Trigger loads based on active tab
  useEffect(() => {
    if (activeTab === 'staff') {
      fetchStaff();
    } else if (activeTab === 'audit') {
      setLogs([]);
      fetchLogs(1, false);
      fetchStaff(); // Load staff list for filter dropdown
    }
  }, [activeTab, filterStaff, filterFrom, filterTo]);

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
      await apiClient.post('/auth/create-staff', values);
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
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Status badging helpers
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'repairing':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'ready':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'delivered':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-secondary text-muted-foreground border-border/40';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Management Settings
        </h2>
        <p className="text-muted-foreground text-sm">Configure GK Repair details, staff permissions, and review audit records.</p>
      </div>

      {/* Dynamic Tab Controllers */}
      <div className="border-b border-border flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('shop')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'shop'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building className="h-4 w-4" /> Shop Profile
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'staff'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" /> Staff Management
          </button>
        )}

        <button
          onClick={() => setActiveTab('account')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'account'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserCog className="h-4 w-4" /> Account Profile
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="h-4 w-4" /> System Audit Logs
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {/* Tab 1: Shop Profile */}
        {activeTab === 'shop' && (
          <Card>
            <form onSubmit={onSaveShop}>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground">Shop Credentials</CardTitle>
                <CardDescription>Update name, contacts, and receipts invoice branding logo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Area */}
                <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-border/40">
                  <div className="relative h-24 w-24 rounded-xl border border-border bg-secondary/20 flex items-center justify-center overflow-hidden group shadow-inner">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Shop Logo Preview" className="h-full w-full object-contain" />
                    ) : (
                      <Building className="h-10 w-10 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <h4 className="text-sm font-bold text-foreground">Receipt Logo</h4>
                    <p className="text-xs text-muted-foreground">Supported file formats: JPEG, PNG, WEBP. Max size: 1MB.</p>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <label className="cursor-pointer inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all">
                        Browse Image
                        <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" disabled={!isOwner} />
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
              </CardContent>
              {isOwner && (
                <CardFooter className="justify-end border-t border-border/40 pt-4">
                  <Button type="submit" disabled={savingShop} className="gap-2">
                    {savingShop ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </Button>
                </CardFooter>
              )}
            </form>
          </Card>
        )}

        {/* Tab 2: Staff Management */}
        {activeTab === 'staff' && isOwner && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Store Staff Directory</h3>
                <p className="text-sm text-muted-foreground">Recruit assistants, manage logins, and reset accounts.</p>
              </div>
              <Button onClick={() => setRecruitOpen(true)} className="gap-2 self-start sm:self-auto">
                <UserPlus className="h-4.5 w-4.5" /> Recruit Staff
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {loadingStaff ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Loading Directory...
                    </span>
                  </div>
                ) : staffList.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Badge ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Terminal Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffList.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            {emp.staff_id || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-foreground">{emp.name}</div>
                            <div className="text-[11px] text-muted-foreground">Joined: {new Date(emp.created_at).toLocaleDateString()}</div>
                          </TableCell>
                          <TableCell className="capitalize text-xs font-semibold text-muted-foreground">
                            {emp.role}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              emp.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${emp.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                              {emp.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleResetStaffPassword(emp.id)}
                                title="Send Recovery Reset Link"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-border/80 hover:bg-secondary/80 rounded-lg text-xs text-muted-foreground hover:text-white transition-colors"
                              >
                                <KeyRound className="h-3.5 w-3.5" /> Reset Pass
                              </button>
                              <button
                                onClick={() => handleToggleStaff(emp.id, emp.is_active)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                  emp.is_active
                                    ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                    : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                              >
                                {emp.is_active ? (
                                  <>
                                    <ToggleRight className="h-4 w-4" /> Deactivate
                                  </>
                                ) : (
                                  <>
                                    <ToggleLeft className="h-4 w-4" /> Activate
                                  </>
                                )}
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-16">
                    <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-foreground">No staff members found</h3>
                    <p className="text-xs text-muted-foreground mt-1">Recruit staff members using the button above.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recruit Dialog */}
            <Dialog
              isOpen={recruitOpen}
              onClose={() => setRecruitOpen(false)}
              title="Recruit Staff Member"
              description="Register login credentials for a new terminal assistant."
            >
              <form onSubmit={handleSubmitStaff(onRecruitStaff)} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    Full Name
                  </label>
                  <Input placeholder="Employee Name" {...registerStaff('name')} />
                  {staffErrors.name && (
                    <p className="text-[11px] font-medium text-destructive">{staffErrors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    Email Address
                  </label>
                  <Input type="email" placeholder="staff@gkrepair.com" {...registerStaff('email')} />
                  {staffErrors.email && (
                    <p className="text-[11px] font-medium text-destructive">{staffErrors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    Temporary Password
                  </label>
                  <Input type="password" placeholder="••••••••" {...registerStaff('password')} />
                  {staffErrors.password && (
                    <p className="text-[11px] font-medium text-destructive">{staffErrors.password.message}</p>
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
          </div>
        )}

        {/* Tab 3: Account Profile Settings */}
        {activeTab === 'account' && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Identity Form */}
            <Card>
              <form onSubmit={handleSubmitProfile(onSaveProfile)}>
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-foreground">Profile Details</CardTitle>
                  <CardDescription>Manage your username display and primary account contact email.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      Display Name
                    </label>
                    <Input {...registerProfile('name')} placeholder="Full Name" />
                    {profileErrors.name && (
                      <p className="text-[11px] font-medium text-destructive">{profileErrors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      Email Address
                    </label>
                    <Input type="email" {...registerProfile('email')} placeholder="email@address.com" />
                    {profileErrors.email && (
                      <p className="text-[11px] font-medium text-destructive">{profileErrors.email.message}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="justify-end border-t border-border/40 pt-4">
                  <Button type="submit" disabled={savingProfile} className="gap-2">
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Update Profile
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* Password Form */}
            <Card>
              <form onSubmit={handleSubmitPassword(onChangePassword)}>
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-foreground">Change Password</CardTitle>
                  <CardDescription>Verify your current password and secure your terminal access.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      Current Password
                    </label>
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
                    <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      New Password
                    </label>
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
                    <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      Confirm New Password
                    </label>
                    <Input
                      type="password"
                      {...registerPassword('confirmNewPassword')}
                      placeholder="••••••••"
                    />
                    {passwordErrors.confirmNewPassword && (
                      <p className="text-[11px] font-medium text-destructive">{passwordErrors.confirmNewPassword.message}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="justify-end border-t border-border/40 pt-4">
                  <Button type="submit" disabled={savingPassword} className="gap-2">
                    {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Update Password
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {/* Tab 4: System Audit Logs */}
        {activeTab === 'audit' && isOwner && (
          <div className="space-y-6">
            {/* Analytical Filters */}
            <Card className="bg-card/45 backdrop-blur-md">
              <CardContent className="pt-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Filter by Staff
                  </label>
                  <select
                    value={filterStaff}
                    onChange={(e) => setFilterStaff(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border bg-secondary/35 text-sm text-foreground px-3 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Shop Users</option>
                    {staffList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.staff_id || 'Owner'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Log Range From
                  </label>
                  <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Log Range To
                  </label>
                  <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Vertical timeline feed */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground">Operational Audit Trail</CardTitle>
                    <CardDescription>Track state history modifications, closure details, and user actions.</CardDescription>
                  </div>
                  <button
                    onClick={() => fetchLogs(1, false)}
                    className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-secondary/40 hover:text-white transition-all"
                    title="Refresh logs"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="relative pl-6 sm:pl-8 space-y-8">
                {/* Timeline vertical line */}
                <div className="absolute left-9 sm:left-11 top-6 bottom-6 w-0.5 bg-border/80" />

                {loadingLogs && logs.length === 0 ? (
                  <div className="py-6">
                    <SkeletonList count={4} className="h-16 w-full" />
                  </div>
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <div key={log.id} className="relative flex flex-col sm:flex-row gap-4 items-start group">
                      {/* Timeline dot */}
                      <div className="absolute -left-5 sm:-left-7 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 border-primary z-10 group-hover:scale-110 transition-transform">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                      </div>

                      <div className="flex-1 space-y-1.5 bg-secondary/15 border border-border/40 hover:border-primary/20 p-4 rounded-xl transition-all duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-border/25 pb-2">
                          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                          <Link
                            to={`/repairs/${log.repair_id}`}
                            className="font-mono text-xs font-extrabold text-primary hover:underline"
                          >
                            Job: {log.repair?.job_number || 'N/A'}
                          </Link>
                        </div>

                        <div className="text-sm font-semibold text-foreground flex items-center flex-wrap gap-1">
                          <span>{log.changer?.name || 'System Auto'}</span>
                          <span className="text-xs text-muted-foreground font-normal">({log.changer?.role || 'Trigger'})</span>
                          <span className="text-muted-foreground font-normal">updated status to</span>
                          <span className={`px-2 py-0.5 rounded border text-xs font-bold ${getStatusBadgeClass(log.new_status)}`}>
                            {log.new_status}
                          </span>
                        </div>

                        {/* Value logs details */}
                        {(log.old_value || log.new_value) && (
                          <div className="grid grid-cols-2 gap-2 bg-secondary/20 p-2 rounded-lg text-xs font-mono border border-border/30">
                            <div>
                              <span className="text-muted-foreground font-bold block text-[10px] uppercase">Old Status</span>
                              <span className="text-red-400 font-semibold">{log.old_value || 'None'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground font-bold block text-[10px] uppercase">New Status</span>
                              <span className="text-emerald-400 font-semibold">{log.new_value || 'None'}</span>
                            </div>
                          </div>
                        )}

                        {log.note && (
                          <p className="text-xs text-muted-foreground bg-card/65 p-2 rounded border border-border/20 italic">
                            &ldquo;{log.note}&rdquo;
                          </p>
                        )}
                        {log.repair?.device && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Info className="h-3.5 w-3.5" /> Device: {log.repair.device.brand} {log.repair.device.model}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 pl-0 sm:pl-4">
                    <Info className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">No events found in this date range.</p>
                  </div>
                )}

                {/* Load More scroll appends */}
                {hasMoreLogs && logs.length > 0 && (
                  <div className="flex justify-center pt-4 pl-0 sm:pl-4">
                    <Button
                      variant="outline"
                      onClick={() => fetchLogs(logsPage + 1, true)}
                      disabled={loadingLogs}
                      className="gap-2"
                    >
                      {loadingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Load More History
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
