import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  MapPin, 
  Loader2, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Dialog } from '../components/ui/Dialog';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

const customerFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(5, 'Phone number must be at least 5 characters'),
  address: z.string().optional()
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  photo_url: string | null;
  repairsCount: number;
  lastRepairDate: string | null;
}

interface CustomersResponse {
  customers: CustomerListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function CustomerList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page to 1 on new search
    }, 500);

    return () => clearTimeout(handler);
  }, [search]);

  // Query customers using TanStack Query
  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ['customers', debouncedSearch, page],
    queryFn: () => apiClient.get(`/customers?search=${debouncedSearch}&page=${page}&limit=8`)
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      address: ''
    }
  });

  // Mutation to create customer
  const createCustomerMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.post('/customers', formData),
    onSuccess: () => {
      toast.success('Customer registered successfully!');
      setDialogOpen(false);
      reset();
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to register customer');
    }
  });

  const onSubmit = (values: CustomerFormValues) => {
    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('phone', values.phone);
    if (values.address) formData.append('address', values.address);
    if (file) formData.append('photo', file);

    createCustomerMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Customer Directory
          </h2>
          <p className="text-muted-foreground text-sm">
            Maintain client profiles, repair frequencies, and location details.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4.5 w-4.5" />
          <span>Add Customer</span>
        </Button>
      </div>

      {/* Search Header */}
      <Card>
        <CardContent className="p-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by client name or phone contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/35 border-border/80 w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers List Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Loading Customer Base...
          </span>
        </div>
      ) : data?.customers && data.customers.length > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {data.customers.map((cust) => (
              <Card
                key={cust.id}
                onClick={() => navigate(`/customers/${cust.id}`)}
                className="cursor-pointer hover:border-primary/45 transition-colors group"
              >
                <CardContent className="p-6 flex items-start gap-4">
                  {/* Photo Profile */}
                  <div className="h-14 w-14 rounded-full overflow-hidden bg-secondary/60 flex-shrink-0 flex items-center justify-center border border-border group-hover:border-primary/20">
                    {cust.photo_url ? (
                      <img src={cust.photo_url} alt={cust.name} className="h-full w-full object-cover" />
                    ) : (
                      <Users className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h3 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                      {cust.name}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {cust.phone}
                      </span>
                      {cust.address && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <MapPin className="h-3 w-3" /> {cust.address}
                        </span>
                      )}
                    </div>

                    {cust.lastRepairDate && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 mt-1">
                        <Calendar className="h-3 w-3 text-primary/75" />
                        <span>Last ticket: {new Date(cust.lastRepairDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Frequency Indicator */}
                  <div className="bg-secondary/40 border border-border/50 rounded-xl px-3 py-1.5 text-center min-w-[60px]">
                    <span className="block text-base font-bold text-foreground leading-none">
                      {cust.repairsCount}
                    </span>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5 block">
                      Orders
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination controls */}
          {data.pagination.pages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Page {page} of {data.pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
                disabled={page === data.pagination.pages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 border border-border border-dashed rounded-xl bg-secondary/5">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No customers found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Try correcting your search or register a new customer above.
          </p>
        </div>
      )}

      {/* Add Customer Dialog */}
      <Dialog
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          reset();
          setFile(null);
        }}
        title="Register New Customer"
        description="Fill out coordinates below to map a new shop customer."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
            <Input
              placeholder="Customer Name"
              {...register('name')}
              className={errors.name ? 'border-destructive/80' : ''}
            />
            {errors.name && (
              <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
            <Input
              placeholder="e.g. +1987654321"
              {...register('phone')}
              className={errors.phone ? 'border-destructive/80' : ''}
            />
            {errors.phone && (
              <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Address (Optional)</label>
            <Input
              placeholder="123 Tech St, Cupertino"
              {...register('address')}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground block">Customer Avatar Photo</label>
            <div className="flex items-center gap-3 mt-1.5">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary/80 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border/40 pt-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                reset();
                setFile(null);
              }}
              disabled={createCustomerMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCustomerMutation.isPending} className="gap-1.5">
              {createCustomerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Registering...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" /> Register Customer
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
