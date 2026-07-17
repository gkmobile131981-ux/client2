import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SignatureCanvas from 'react-signature-canvas';

const ReactSignatureCanvas = (SignatureCanvas as any).default || SignatureCanvas;
import { 
  Loader2, 
  ChevronRight, 
  Wrench, 
  Camera, 
  CheckCircle, 
  Download, 
  Printer, 
  Phone,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

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
  device?: {
    id: string;
    brand: string;
    model: string;
    imei: string | null;
    problem: string;
  };
  customer?: {
    id: string;
    name: string;
    phone: string;
    address: string | null;
  };
}

export default function DeliverRepair() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form states
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receivedBy, setReceivedBy] = useState<'customer' | 'staff'>('customer');
  const [notes, setNotes] = useState('');

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const defaultDate = `${yyyy}-${mm}-${dd}`;
  
  const hh = String(today.getHours()).padStart(2, '0');
  const min = String(today.getMinutes()).padStart(2, '0');
  const defaultTime = `${hh}:${min}`;

  const [deliveryDate, setDeliveryDate] = useState(defaultDate);
  const [deliveryTime, setDeliveryTime] = useState(defaultTime);

  // Camera and Photo states
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  
  // Signature States
  const sigPadRef = useRef<SignatureCanvas>(null);
  
  // Success states
  const [isSuccess, setIsSuccess] = useState(false);

  // References for camera capture
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch Repair order details
  const { data, isLoading } = useQuery<{ repair: RepairDetailData }>({
    queryKey: ['repair-detail', id],
    queryFn: () => apiClient.get(`/repairs/${id}`),
    enabled: !!id
  });

  // Complete Delivery Mutation
  const deliverMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post(`/repairs/${id}/deliver`, payload),
    onSuccess: () => {
      toast.success('Handoff completed successfully!');
      setIsSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['repair-detail', id] });
    },
    onError: (err: any) => {
      let msg = err.message || 'Failed to complete delivery';
      if (err.details && Array.isArray(err.details)) {
        const detailMsgs = err.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ');
        msg = `Validation failed: ${detailMsgs}`;
      }
      toast.error(msg);
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Loading Handoff Wizard...
        </span>
      </div>
    );
  }

  const repair = data?.repair;

  if (!repair) {
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

  // Pre-fill receiver details on selection change
  const handleReceivedByChange = (type: 'customer' | 'staff') => {
    setReceivedBy(type);
    if (type === 'customer' && repair.customer) {
      setReceiverName(repair.customer.name);
      setReceiverPhone(repair.customer.phone);
    } else {
      setReceiverName('');
      setReceiverPhone('');
    }
  };

  // Pre-fill receiver details on selection change or when repair loads
  useEffect(() => {
    if (repair?.customer && receivedBy === 'customer') {
      setReceiverName(repair.customer.name);
      setReceiverPhone(repair.customer.phone);
    }
  }, [repair, receivedBy]);
  const startCamera = async () => {
    setCapturedPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      toast.error('Unable to access webcam. Please upload a photo instead.');
    }
  };

  // Capture frame from camera
  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  // Stop camera tracks
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // File fallback upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear signature pad
  const clearSignature = () => {
    sigPadRef.current?.clear();
  };

  // Submit delivery closure
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (repair.status !== 'ready') {
      toast.error('Only repairs marked as "Ready" can be delivered.');
      return;
    }

    if (!receiverName.trim()) {
      toast.error('Receiver name is required');
      return;
    }

    if (!receiverPhone.trim()) {
      toast.error('Receiver phone is required');
      return;
    }

    // Convert signature pad vectors to Base64 Image if not empty
    const signatureDataUrl = (sigPadRef.current && !sigPadRef.current.isEmpty())
      ? sigPadRef.current.getTrimmedCanvas().toDataURL('image/png')
      : null;

    deliverMutation.mutate({
      receiverName,
      receiverPhone,
      receivedBy,
      notes,
      receiverPhotoUrl: capturedPhoto, // Base64 data url
      signatureDataUrl,
      deliveryDate,
      deliveryTime
    });
  };

  // Preview PDF file securely with token headers
  const previewReceipt = async () => {
    try {
      const token = localStorage.getItem('gk_access_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/repairs/${id}/receipt`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (!response.ok) throw new Error('Receipt load failed');
      const blob = await response.blob();
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
      toast.success('Receipt preview opened');
    } catch (err: any) {
      toast.error(err.message || 'Could not preview receipt');
    }
  };

  // Download PDF file securely with token headers
  const downloadReceipt = async () => {
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
      link.setAttribute('download', `${repair.job_number}-receipt.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF Downloaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Could not download receipt');
    }
  };

  // Open PDF in a new tab for printing
  const printReceipt = async () => {
    try {
      const token = localStorage.getItem('gk_access_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/repairs/${id}/receipt`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (!response.ok) throw new Error('Receipt load failed');
      const blob = await response.blob();
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Could not load printing tab');
    }
  };

  // Success Screen
  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="border-emerald-500/20 bg-slate-900/90">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-6">
            <CheckCircle className="h-16 w-16 text-emerald-500 animate-bounce" />
            
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-white">Delivery Hand-off Complete</h2>
              <p className="text-muted-foreground text-sm">
                Job number <span className="font-mono text-primary font-bold">{repair.job_number}</span> has been closed and status updated to delivered.
              </p>
            </div>

            <div className="border border-border/60 bg-secondary/25 w-full rounded-2xl p-4 text-left space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Recipient Name:</span>
                <span className="text-white font-bold">{receiverName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phone Number:</span>
                <span className="text-white font-semibold">{receiverPhone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Outflow Balance:</span>
                <span className="text-emerald-400 font-extrabold">₹ {Number(repair.balance).toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full pt-4">
              <Button onClick={downloadReceipt} className="gap-2 bg-slate-800 hover:bg-slate-700 text-white">
                <Download className="h-4.5 w-4.5" />
                <span>Download Receipt</span>
              </Button>
              <Button onClick={printReceipt} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                <Printer className="h-4.5 w-4.5" />
                <span>Print Receipt</span>
              </Button>
            </div>

            <div className="w-full border-t border-border pt-4">
              <Button asChild variant="outline" className="w-full">
                <Link to={`/repairs/${repair.id}`}>Go to Ticket Details</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Warning if status is not ready
  if (repair.status !== 'ready') {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="border-red-500/20 bg-slate-900/40">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
            <AlertCircle className="h-14 w-14 text-red-500" />
            <h2 className="text-lg font-bold text-white">Invalid Repair State</h2>
            <p className="text-muted-foreground text-sm">
              Repair ticket <span className="font-mono font-bold text-white">{repair.job_number}</span> is currently in <span className="uppercase text-amber-500 font-bold">{repair.status}</span> status. Only repairs marked as "Ready" are eligible for delivery closure.
            </p>
            <Button asChild className="mt-2">
              <Link to={`/repairs/${repair.id}`}>Back to Repair Details</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation breadcrumb */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/repairs/${repair.id}`)}
          className="h-9 w-9 p-0 rounded-xl hover:bg-secondary/40 border border-border/40 flex-shrink-0"
        >
          <ArrowLeft className="h-4.5 w-4.5 text-white" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <Link to="/repairs" className="hover:text-foreground">Repairs</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to={`/repairs/${repair.id}`} className="hover:text-foreground">{repair.job_number}</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-primary">Deliver</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <span>Deliver Device Hand-off</span>
          </h2>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Delivery Forms */}
        <form onSubmit={handleSubmit} className="md:col-span-2 space-y-6">
          <Card className="bg-slate-900/40 border-border/80">
            <CardHeader>
              <CardTitle className="text-base text-white">Recipient Particulars</CardTitle>
              <CardDescription>Verify the details of the individual picking up the device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Radio Selector */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleReceivedByChange('customer')}
                  className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                    receivedBy === 'customer' 
                      ? 'border-primary bg-primary/10 text-white' 
                      : 'border-border/60 bg-secondary/20 text-muted-foreground hover:bg-secondary/35'
                  }`}
                >
                  Customer Pick-up
                </button>
                <button
                  type="button"
                  onClick={() => handleReceivedByChange('staff')}
                  className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                    receivedBy === 'staff' 
                      ? 'border-primary bg-primary/10 text-white' 
                      : 'border-border/60 bg-secondary/20 text-muted-foreground hover:bg-secondary/35'
                  }`}
                >
                  Assigned Staff Handoff
                </button>
              </div>

              {/* Name & Phone */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Receiver's Name</label>
                  <input
                    type="text"
                    required
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Enter full name"
                    className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-white focus:border-primary focus-visible:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Receiver's Phone</label>
                  <input
                    type="tel"
                    required
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-white focus:border-primary focus-visible:outline-none"
                  />
                </div>
              </div>

              {/* Delivery Date & Time */}
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Delivery Date</label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-white focus:border-primary focus-visible:outline-none font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Delivery Time</label>
                  <input
                    type="time"
                    required
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-white focus:border-primary focus-visible:outline-none font-semibold"
                  />
                </div>
              </div>

              {/* Delivery notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Handoff Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record payment methods, accessories returned, or client comments..."
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-white focus:border-primary focus-visible:outline-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Verification Photo capture */}
          <Card className="bg-slate-900/40 border-border/80">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Camera className="h-4.5 w-4.5 text-primary" /> Recipient Handoff Photo
              </CardTitle>
              <CardDescription>Photographic verification of the recipient (Optional).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Media viewer frame */}
              <div className="relative h-60 w-full rounded-xl bg-slate-950/80 border border-dashed border-border overflow-hidden flex items-center justify-center">
                {cameraActive ? (
                  <video 
                    ref={videoRef} 
                    className="h-full w-full object-cover" 
                    playsInline 
                    muted 
                  />
                ) : capturedPhoto ? (
                  <img 
                    src={capturedPhoto} 
                    alt="Recipient Preview" 
                    className="h-full w-full object-cover" 
                  />
                ) : (
                  <div className="text-center space-y-2 p-4 text-muted-foreground">
                    <Camera className="h-10 w-10 mx-auto opacity-40" />
                    <p className="text-xs">No verification photo loaded</p>
                  </div>
                )}
              </div>

              {/* Camera Actions */}
              <div className="flex flex-wrap gap-3">
                {cameraActive ? (
                  <>
                    <Button type="button" onClick={capturePhoto} className="bg-emerald-600 hover:bg-emerald-500">
                      Capture Photo
                    </Button>
                    <Button type="button" variant="outline" onClick={stopCamera}>
                      Cancel Camera
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" onClick={startCamera} className="gap-2 bg-slate-800 hover:bg-slate-700 text-white">
                      <Camera className="h-4 w-4" />
                      <span>{capturedPhoto ? 'Retake Photo' : 'Start Camera Capture'}</span>
                    </Button>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="photo-upload" 
                        onChange={handleFileUpload} 
                        className="hidden" 
                      />
                      <Button type="button" variant="outline" asChild>
                        <label htmlFor="photo-upload" className="cursor-pointer">
                          Upload File
                        </label>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Signature canvas panel */}
          <Card className="bg-slate-900/40 border-border/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base text-white">Recipient Signature (Optional)</CardTitle>
                <CardDescription>Have the recipient sign their name inside the panel below (Optional).</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={clearSignature} className="h-8">
                Clear Panel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="relative border border-input rounded-xl bg-white overflow-hidden h-44">
                <span className="absolute top-2 left-2 text-[10px] uppercase font-bold text-slate-400 select-none bg-slate-100/60 px-1.5 py-0.5 rounded">
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
            </CardContent>
          </Card>

          {/* Action triggers */}
          <div className="flex justify-end gap-3 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/repairs/${repair.id}`)}
              disabled={deliverMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={deliverMutation.isPending}
            >
              {deliverMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Closing Handoff...</span>
                </>
              ) : (
                <>
                  <span>Complete Handoff</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Device & Financial quick summary card */}
        <div className="space-y-6">
          <Card className="bg-slate-900/40 border-border/80">
            <CardHeader>
              <CardTitle className="text-base text-white">Ticket Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Customer Name</span>
                <span className="font-bold text-white block">
                  {repair.customer?.name || 'N/A'}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {repair.customer?.phone || 'N/A'}
                </span>
              </div>

              <div className="border-t border-border/50 pt-3 space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Hardware Device</span>
                <span className="font-bold text-white block">
                  {repair.device?.brand} {repair.device?.model}
                </span>
                <span className="text-xs text-muted-foreground block font-mono">
                  IMEI: {repair.device?.imei || 'N/A'}
                </span>
              </div>

              <div className="border-t border-border/50 pt-3 space-y-2.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Handoff Ledger</span>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Total Estimate:</span>
                  <span className="text-white font-semibold">₹ {Number(repair.estimate).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Advance Paid:</span>
                  <span className="text-emerald-400 font-semibold">- ₹ {Number(repair.advance).toFixed(2)}</span>
                </div>
                <div className="h-px bg-border/50 my-1" />
                <div className="flex justify-between items-center bg-secondary/20 p-2.5 border border-border/40 rounded-xl">
                  <span className="font-bold text-white text-xs">Amount to Collect:</span>
                  <span className="font-extrabold text-amber-400 text-sm">₹ {Number(repair.balance).toFixed(2)}</span>
                </div>
                <div className="grid gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={previewReceipt} className="w-full">
                    Preview Bill
                  </Button>
                  <Button type="button" variant="outline" onClick={downloadReceipt} className="w-full">
                    Download Bill
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
