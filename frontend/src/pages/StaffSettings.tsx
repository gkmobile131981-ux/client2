import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  UserSquare2, 
  Plus, 
  UserPlus, 
  ShieldAlert, 
  Loader2, 
  ToggleLeft, 
  ToggleRight, 
  Mail,
  User,
  Lock
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { Dialog } from '../components/ui/Dialog';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

// Zod validation for Add Staff form
const addStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

type AddStaffFormValues = z.infer<typeof addStaffSchema>;

interface StaffMember {
  id: string;
  name: string;
  email?: string; // we get this or join it
  role: 'owner' | 'staff';
  staff_id: string | null;
  is_active: boolean;
  created_at: string;
}

export default function StaffSettings() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submittingStaff, setSubmittingStaff] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<AddStaffFormValues>({
    resolver: zodResolver(addStaffSchema),
    defaultValues: {
      name: '',
      email: '',
      password: ''
    }
  });

  // Fetch all staff members from backend
  const fetchStaff = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ staff: StaffMember[] }>('/auth/staff');
      setStaff(data.staff);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load staff list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Submit recruitment request
  const onSubmit = async (values: AddStaffFormValues) => {
    setSubmittingStaff(true);
    try {
      await apiClient.post('/auth/create-staff', {
        name: values.name,
        email: values.email,
        password: values.password
      });
      toast.success('Staff member registered successfully!');
      setDialogOpen(false);
      reset();
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to add staff member.');
    } finally {
      setSubmittingStaff(false);
    }
  };

  // Toggle active/inactive state
  const handleToggleStatus = async (staffId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    try {
      const data = await apiClient.put<{ staff: StaffMember }>(`/auth/staff/${staffId}`);
      toast.success(`Staff member successfully ${action}d!`);
      // Update local state instantly
      setStaff((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, is_active: data.staff.is_active } : s))
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || `Failed to ${action} staff member.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <UserSquare2 className="h-6 w-6 text-primary" /> Staff Management
          </h2>
          <p className="text-muted-foreground text-sm">
            Recruit staff members, view credentials, and toggle terminal access.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 self-start sm:self-auto">
          <UserPlus className="h-4.5 w-4.5" />
          <span>Add Staff Member</span>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Loading Staff Directory...
              </span>
            </div>
          ) : staff.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      {emp.staff_id || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-white">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">Joined: {new Date(emp.created_at).toLocaleDateString()}</div>
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
                      <button
                        onClick={() => handleToggleStatus(emp.id, emp.is_active)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          emp.is_active
                            ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        title={emp.is_active ? 'Deactivate Staff' : 'Activate Staff'}
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16">
              <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white">No Staff Registered</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Recruit your first assistant by clicking the Add Staff button above.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recruitment Modal Dialog */}
      <Dialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Recruit Staff Member"
        description="Add a new assistant terminal access. Staff gets auto-assigned GKxxx Badge IDs."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Full Name
            </label>
            <Input
              placeholder="Assistant Name"
              {...register('name')}
              className={errors.name ? 'border-destructive/80' : ''}
            />
            {errors.name && (
              <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email Address
            </label>
            <Input
              type="email"
              placeholder="assistant@gkrepair.com"
              {...register('email')}
              className={errors.email ? 'border-destructive/80' : ''}
            />
            {errors.email && (
              <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Temp Password
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              {...register('password')}
              className={errors.password ? 'border-destructive/80' : ''}
            />
            {errors.password && (
              <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.password.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-border/40 pt-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                reset();
              }}
              disabled={submittingStaff}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submittingStaff} className="gap-1.5">
              {submittingStaff ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Recruiting...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Recruit Staff
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
