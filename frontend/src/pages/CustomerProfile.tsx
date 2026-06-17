import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  User, 
  Phone, 
  MapPin, 
  Wrench, 
  Loader2, 
  Save, 
  Edit3,
  Calendar,
  DollarSign,
  Plus
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

const customerUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(5, 'Phone number must be at least 5 characters'),
  address: z.string().optional()
});

type CustomerUpdateValues = z.infer<typeof customerUpdateSchema>;

interface CustomerDetails {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  photo_url: string | null;
  created_at: string;
}

interface CustomerRepair {
  id: string;
  job_number: string;
  device_id: string;
  estimate: number;
  advance: number;
  balance: number;
  status: 'pending' | 'repairing' | 'ready' | 'delivered' | 'cancelled';
  created_at: string;
}

interface CustomerDevice {
  id: string;
  brand: string;
  model: string;
}

interface ProfileResponse {
  customer: CustomerDetails;
  devices: CustomerDevice[];
  repairs: CustomerRepair[];
}

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // 1. Fetch detailed customer metadata & repair metrics
  const { data, isLoading } = useQuery<ProfileResponse>({
    queryKey: ['customer-profile', id],
    queryFn: () => apiClient.get(`/customers/${id}`),
    enabled: !!id
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerUpdateValues>({
    resolver: zodResolver(customerUpdateSchema),
    values: data ? {
      name: data.customer.name,
      phone: data.customer.phone,
      address: data.customer.address || ''
    } : undefined
  });

  // 2. Mutation to update profile details
  const updateMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.put(`/customers/${id}`, formData),
    onSuccess: () => {
      toast.success('Customer profile updated!');
      setIsEditing(false);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['customer-profile', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update profile');
    }
  });

  const handleSaveProfile = (values: CustomerUpdateValues) => {
    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('phone', values.phone);
    if (values.address) formData.append('address', values.address);
    if (file) formData.append('photo', file);

    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Loading Client profile...
        </span>
      </div>
    );
  }

  if (!data?.customer) {
    return (
      <div className="text-center py-20">
        <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-white">Client not found</h3>
        <Button onClick={() => navigate('/customers')} className="mt-4">
          Back to Directory
        </Button>
      </div>
    );
  }

  const { customer, devices, repairs } = data;

  return (
    <div className="space-y-6">
      {/* Profile Header Block */}
      <Card>
        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-full overflow-hidden bg-secondary/80 flex items-center justify-center border border-border">
              {customer.photo_url ? (
                <img src={customer.photo_url} alt={customer.name} className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            
            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold text-white leading-none tracking-tight">
                {customer.name}
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" /> {customer.phone}
                </span>
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {customer.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={isEditing ? 'default' : 'outline'}
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false);
                  reset();
                } else {
                  setIsEditing(true);
                }
              }}
              className="gap-2"
            >
              <Edit3 className="h-4 w-4" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </Button>
            <Button
              onClick={() => navigate(`/customers/${customer.id}/new-repair`)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Repair Ticket</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Editor Panel */}
      {isEditing && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base text-white">Modify Profile Coordinates</CardTitle>
            <CardDescription>Edit names, contacts, or change avatar files.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(handleSaveProfile)}>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Full Name</label>
                <Input
                  {...register('name')}
                  className={errors.name ? 'border-destructive/80' : ''}
                />
                {errors.name && (
                  <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Phone Number</label>
                <Input
                  {...register('phone')}
                  className={errors.phone ? 'border-destructive/80' : ''}
                />
                {errors.phone && (
                  <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground font-semibold">Address</label>
                <Input {...register('address')} />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground block">Change Profile Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="text-xs text-muted-foreground mt-1.5 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary/80 cursor-pointer"
                />
              </div>
            </CardContent>
            <div className="p-6 pt-0 flex justify-end gap-2 border-t border-border/40 mt-4">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="gap-1.5"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save Profile Details
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Repairs History List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Wrench className="h-4.5 w-4.5 text-primary" /> Repair Ticket Logs
          </CardTitle>
          <CardDescription>All repair orders registered for this customer.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {repairs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Device Model</TableHead>
                  <TableHead>Date Filed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Estimate Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repairs.map((r) => {
                  const dev = devices.find((d) => d.id === r.device_id);
                  return (
                    <TableRow
                      key={r.id}
                      onClick={() => navigate(`/repairs/${r.id}`)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {r.job_number}
                      </TableCell>
                      <TableCell className="font-semibold text-white">
                        {dev ? `${dev.brand} ${dev.model}` : 'Unknown Device'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          r.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                          r.status === 'repairing' ? 'bg-blue-500/10 text-blue-500' :
                          r.status === 'ready' ? 'bg-emerald-500/10 text-emerald-500' :
                          r.status === 'delivered' ? 'bg-slate-500/10 text-slate-400' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-white">
                        ₹{Number(r.estimate).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16">
              <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white">No repair tickets recorded</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Register a new repair order using the button above.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
