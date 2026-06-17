import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Wrench, 
  Calendar, 
  User, 
  Phone, 
  Clock, 
  Loader2, 
  ChevronRight,
  Maximize2,
  CheckSquare,
  History,
  FileText,
  Download
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';
import ReceiptPreviewModal from '../components/repairs/ReceiptPreviewModal';

interface RepairHistoryLog {
  id: string;
  old_status: string;
  new_status: string;
  note: string | null;
  created_at: string;
  changed_by_user?: {
    id: string;
    name: string;
    role: string;
  };
}

interface RepairDetailData {
  id: string;
  job_number: string;
  estimate: number;
  advance: number;
  balance: number;
  status: 'pending' | 'repairing' | 'ready' | 'delivered' | 'cancelled';
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
  delivered_at?: string | null;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  receiver_photo_url?: string | null;
  signature_url?: string | null;
  staff_id?: string | null;
  device?: {
    id: string;
    brand: string;
    model: string;
    imei: string | null;
    problem: string;
    quality: string | null;
    physical_damage: string | null;
    front_photo_url: string | null;
    back_photo_url: string | null;
  };
  customer?: {
    id: string;
    name: string;
    phone: string;
    address: string | null;
  };
  assigned_staff?: {
    id: string;
    name: string;
    staff_id: string | null;
  };
  history?: RepairHistoryLog[];
}

export default function RepairDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role: authRole } = useAuth();

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);

  // 1. Fetch detailed repair log
  const { data, isLoading } = useQuery<{ repair: RepairDetailData }>({
    queryKey: ['repair-detail', id],
    queryFn: () => apiClient.get(`/repairs/${id}`),
    enabled: !!id
  });

  const handleDownloadReceipt = async () => {
    if (!data?.repair) return;
    try {
      const token = localStorage.getItem('gk_access_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/repairs/${id}/receipt?download=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (!response.ok) throw new Error('Receipt generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${data.repair.job_number}-receipt.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Receipt download started');
    } catch (err: any) {
      toast.error(err.message || 'Could not download receipt');
    }
  };

  // 2. Fetch staff members for reassignment dropdown (owner only)
  const { data: staffData } = useQuery<{ staff: { id: string; name: string }[] }>({
    queryKey: ['staff-list'],
    queryFn: () => apiClient.get('/auth/staff'),
    enabled: authRole === 'owner'
  });

  // 3. Mutation to update status only
  const updateStatusMutation = useMutation({
    mutationFn: (payload: { status: string; notes?: string }) => 
      apiClient.put(`/repairs/${id}/status`, payload),
    onSuccess: () => {
      toast.success('Status updated successfully!');
      setStatusDialogOpen(false);
      setStatusNote('');
      queryClient.invalidateQueries({ queryKey: ['repair-detail', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update status');
    }
  });

  // 4. Mutation for staff reassignment (owner only)
  const reassignMutation = useMutation({
    mutationFn: (staffId: string) => 
      apiClient.put(`/repairs/${id}`, { staffId }),
    onSuccess: () => {
      toast.success('Technician assigned successfully!');
      setReassigning(false);
      queryClient.invalidateQueries({ queryKey: ['repair-detail', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign technician');
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Loading Repair Order...
        </span>
      </div>
    );
  }

  if (!data?.repair) {
    return (
      <div className="text-center py-20">
        <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-white">Repair Order not found</h3>
        <Button onClick={() => navigate('/repairs')} className="mt-4">
          Back to Pipeline
        </Button>
      </div>
    );
  }

  const { repair } = data;

  const triggerStatusUpdate = (statusVal: string) => {
    setSelectedStatus(statusVal);
    setStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = () => {
    updateStatusMutation.mutate({
      status: selectedStatus,
      notes: statusNote
    });
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    repairing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    delivered: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <Link to="/repairs" className="hover:text-foreground">Repairs</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>Ticket details</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5 mt-1">
            <span className="font-mono text-primary">{repair.job_number}</span>
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            Opened on {new Date(repair.created_at).toLocaleString()}
          </p>
        </div>

        {/* Deliver & Receipt Actions */}
        <div className="flex flex-wrap gap-2">
          {authRole === 'owner' && (
            <Button
              onClick={() => setReceiptPreviewOpen(true)}
              variant="outline"
              className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
            >
              <FileText className="h-4 w-4" />
              <span>Preview Receipt</span>
            </Button>
          )}

          {repair.status === 'ready' && (
            <Button
              onClick={() => navigate(`/repairs/${repair.id}/deliver`)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500"
            >
              <CheckSquare className="h-4.5 w-4.5" />
              <span>Deliver Device</span>
            </Button>
          )}

          {repair.status === 'delivered' && (
            <Button
              onClick={handleDownloadReceipt}
              className="gap-2 bg-primary hover:bg-primary/95 text-white"
            >
              <Download className="h-4 w-4" />
              <span>Re-download Receipt</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* LEFT COLUMN: Customer and Device details */}
        <div className="md:col-span-2 space-y-6">
          {/* Customer coordinates */}
          {repair.customer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-white">Customer Profile</CardTitle>
                <CardDescription>Primary coordinates for device ownership.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-white text-base">
                    <Link to={`/customers/${repair.customer.id}`} className="hover:text-primary transition-colors">
                      {repair.customer.name}
                    </Link>
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {repair.customer.phone}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/customers/${repair.customer.id}`}>View Profile</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Device details */}
          {repair.device && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-white">Device Diagnostics</CardTitle>
                <CardDescription>Hardware attributes and identified issues.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Device Brand / Model</span>
                    <span className="font-bold text-white mt-0.5 block">
                      {repair.device.brand} {repair.device.model}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">IMEI Number</span>
                    <span className="font-semibold text-white mt-0.5 block">
                      {repair.device.imei || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block text-capitalize">Physical Grade</span>
                    <span className="font-semibold text-white mt-0.5 block capitalize">
                      {repair.device.quality || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-4 space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-primary block">Reported Problem</span>
                    <p className="text-sm text-white mt-1 bg-secondary/20 border border-border/40 rounded-xl p-3">
                      {repair.device.problem}
                    </p>
                  </div>

                  {repair.device.physical_damage && (
                    <div>
                      <span className="text-xs font-semibold text-amber-400 block">Existing Bezel/Physical Damage</span>
                      <p className="text-sm text-white mt-1 bg-secondary/20 border border-border/40 rounded-xl p-3">
                        {repair.device.physical_damage}
                      </p>
                    </div>
                  )}
                </div>

                {/* Lightbox previews */}
                {(repair.device.front_photo_url || repair.device.back_photo_url) && (
                  <div className="border-t border-border/60 pt-4">
                    <span className="text-xs text-muted-foreground block mb-2">Hardware Photos (Click to expand)</span>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {repair.device.front_photo_url && (
                        <div 
                          onClick={() => setLightboxUrl(repair.device!.front_photo_url)}
                          className="relative h-44 border border-border rounded-xl overflow-hidden cursor-pointer group"
                        >
                          <img src={repair.device.front_photo_url} alt="Front view" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      )}
                      {repair.device.back_photo_url && (
                        <div 
                          onClick={() => setLightboxUrl(repair.device!.back_photo_url)}
                          className="relative h-44 border border-border rounded-xl overflow-hidden cursor-pointer group"
                        >
                          <img src={repair.device.back_photo_url} alt="Back view" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Delivery Details Card (Delivered State) */}
          {repair.status === 'delivered' && (
            <Card className="border-emerald-500/20 bg-slate-900/20">
              <CardHeader>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <CheckSquare className="h-4.5 w-4.5 text-emerald-500" />
                  <span>Delivery & Handoff Details</span>
                </CardTitle>
                <CardDescription>Handoff execution metadata and recipient credentials.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Recipient Name</span>
                    <span className="font-bold text-white mt-0.5 block">
                      {repair.receiver_name || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Phone Contact</span>
                    <span className="font-semibold text-white mt-0.5 block">
                      {repair.receiver_phone || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Delivered On</span>
                    <span className="font-semibold text-emerald-400 mt-0.5 block">
                      {repair.delivered_at ? new Date(repair.delivered_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 border-t border-border/60 pt-4">
                  {repair.receiver_photo_url && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-2 font-semibold">Verification Photo</span>
                      <div 
                        onClick={() => setLightboxUrl(repair.receiver_photo_url || null)}
                        className="relative h-36 w-full max-w-xs border border-border rounded-xl overflow-hidden cursor-pointer group"
                      >
                        <img 
                          src={repair.receiver_photo_url} 
                          alt="Recipient" 
                          className="h-full w-full object-cover transition-transform group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                  )}

                  {repair.signature_url && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-2 font-semibold">Receiver's Signature</span>
                      <div className="h-36 w-full max-w-xs border border-border rounded-xl bg-white p-2 flex items-center justify-center">
                        <img 
                          src={repair.signature_url} 
                          alt="Signature" 
                          className="max-h-full max-w-full object-contain" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline / Activity Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <History className="h-4.5 w-4.5 text-primary" /> Repair Order Timeline
              </CardTitle>
              <CardDescription>Chronological log of diagnostic and status changes.</CardDescription>
            </CardHeader>
            <CardContent>
              {repair.history && repair.history.length > 0 ? (
                <div className="relative border-l border-border pl-6 space-y-6">
                  {repair.history.map((log) => (
                    <div key={log.id} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-primary ring-4 ring-background" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold uppercase text-white bg-secondary/60 px-2 py-0.5 rounded border border-border/80">
                            {log.new_status}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        {log.note && (
                          <p className="text-sm text-white mt-1 pl-1 italic">
                            &ldquo;{log.note}&rdquo;
                          </p>
                        )}
                        {log.changed_by_user && (
                          <span className="text-[10px] text-muted-foreground block pl-1">
                            Logged by: {log.changed_by_user.name} ({log.changed_by_user.role})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No timeline data recorded.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Financials & Status controller */}
        <div className="space-y-6">
          {/* Status controller */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base text-white">Status Controller</CardTitle>
              <CardDescription>Track state of the device repair.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground font-semibold">Current State</span>
                <span className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold uppercase border ${statusColors[repair.status] || ''}`}>
                  <Clock className="h-4 w-4" />
                  {repair.status}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold">Change Status</label>
                <select
                  value={repair.status}
                  onChange={(e) => triggerStatusUpdate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground focus:border-primary focus-visible:outline-none cursor-pointer"
                >
                  <option value="pending">Pending</option>
                  <option value="repairing">Repairing</option>
                  <option value="ready">Ready (For Pick-up)</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Financial summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-white">Financial Summary</CardTitle>
              <CardDescription>Financial calculations and cash collected.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Estimate Cost:</span>
                <span className="font-bold text-white">${Number(repair.estimate).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Advance Deposited:</span>
                <span className="font-bold text-emerald-400">${Number(repair.advance).toFixed(2)}</span>
              </div>
              <div className="h-px bg-border/60 my-2" />
              <div className="flex justify-between items-center bg-secondary/35 rounded-xl p-3 border border-border/50">
                <span className="font-semibold text-white">Balance Due:</span>
                <span className={`text-base font-extrabold ${repair.balance > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  ${Number(repair.balance).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-white">Technician Assignment</CardTitle>
              <CardDescription>Tech staff checking this repair.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {authRole === 'owner' ? (
                <div className="space-y-2">
                  <select
                    value={repair.staff_id || ''}
                    disabled={reassigning}
                    onChange={(e) => {
                      setReassigning(true);
                      reassignMutation.mutate(e.target.value);
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground focus:border-primary focus-visible:outline-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {staffData?.staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {reassignMutation.isPending && (
                    <span className="text-xs text-muted-foreground animate-pulse">Assigning staff...</span>
                  )}
                </div>
              ) : (
                <div className="p-3.5 bg-secondary/35 border border-border/60 rounded-xl flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold">Technician</span>
                    <span className="text-sm font-semibold text-white">
                      {repair.assigned_staff ? repair.assigned_staff.name : 'Unassigned'}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col text-xs text-muted-foreground gap-1 border-t border-border/50 pt-3">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> 
                  Target Date: {repair.delivery_date ? new Date(repair.delivery_date).toLocaleDateString() : 'Unscheduled'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lightbox Overlay modal */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Expanded hardware view" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          <button 
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all"
          >
            Close
          </button>
        </div>
      )}

      {/* Status update validation dialogue */}
      <Dialog
        isOpen={statusDialogOpen}
        onClose={() => {
          setStatusDialogOpen(false);
          setStatusNote('');
        }}
        title="Confirm Status Transition"
        description={`Are you sure you want to transition this repair to ${selectedStatus}?`}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Add status change note</label>
            <textarea
              placeholder="e.g. Screen replaced successfully, waiting for pickup..."
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-white focus:border-primary focus-visible:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-border/40 pt-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStatusDialogOpen(false);
                setStatusNote('');
              }}
              disabled={updateStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmStatusChange}
              disabled={updateStatusMutation.isPending}
              className="gap-1.5"
            >
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                'Confirm Transition'
              )}
            </Button>
          </div>
        </div>
      </Dialog>

      <ReceiptPreviewModal
        id={repair.id}
        jobNumber={repair.job_number}
        isOpen={receiptPreviewOpen}
        onClose={() => setReceiptPreviewOpen(false)}
      />
    </div>
  );
}
