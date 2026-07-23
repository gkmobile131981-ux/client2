import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import logo from '../logo.png';
import cardFrontTemplate from '../card-front-template.png';
import cardBackTemplate from '../card-back-template.png';
import thalaivarSignature from '../thalaivar-signature.png';
import secretarySignature from '../secretary-signature.png';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  Upload,
  Download,
  Loader2,
  Droplet,
  Fingerprint,
  Mail
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';
import { compressFileImage } from '../utils/imageCompressor';

// Helper to remove white background from signature images for clean html2canvas rendering
function makeWhiteTransparent(imgUrl: string, threshold = 210): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imgUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0; // set alpha to 0 (transparent)
        }
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imgUrl);
  });
}

// ─── Card design constants (all in px, matching 86×54mm ratio) ─────────────
const CW = 325;    // card width
const CH = 204;    // card height
const LW = 110;    // orange left column width
const LH = 65;     // logo strip height (top)
const FH = 27;     // footer strip height (bottom)
const OG = '#F5A623';   // orange
const BL = '#2E3FA3';   // blue

export default function OwnerIdCard() {
  const { user, reloadProfile, role, shop } = useAuth();

  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [shopName, setShopName] = useState(shop?.name || '');
  const [emailAddress, setEmailAddress] = useState(user?.email || '');
  const [homeAddress, setHomeAddress] = useState(user?.home_address || '');
  const [bloodGroup, setBloodGroup] = useState(user?.blood_group || '');
  const [dob, setDob] = useState(user?.dob || '');
  const [personalPhone, setPersonalPhone] = useState(user?.personal_phone || '');
  const [aadharNumber, setAadharNumber] = useState(user?.aadhar_number || '');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photo_url || null);
  const [photoScale, setPhotoScale] = useState(1.0);
  const [photoX, setPhotoX] = useState(0);
  const [photoY, setPhotoY] = useState(0);
  const [serialNumber, setSerialNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [thalaivarSigUrl, setThalaivarSigUrl] = useState<string>(thalaivarSignature);
  const [secretarySigUrl, setSecretarySigUrl] = useState<string>(secretarySignature);
  const cardRef = useRef<HTMLDivElement>(null);

  // Pre-process signature images on mount to remove white background for clean HTML5 Canvas export
  useEffect(() => {
    makeWhiteTransparent(thalaivarSignature, 200).then(setThalaivarSigUrl);
    makeWhiteTransparent(secretarySignature, 200).then(setSecretarySigUrl);
  }, []);

  // Sync state values when user profile / shop changes (async loading)
  useEffect(() => {
    if (user) {
      setOwnerName(user.name || '');
      setEmailAddress(user.email || '');
      setHomeAddress(user.home_address || '');
      setBloodGroup(user.blood_group || '');
      setDob(user.dob || '');
      setPersonalPhone(user.personal_phone || '');
      setAadharNumber(user.aadhar_number || '');
      if (!selectedPhoto) {
        setPhotoPreview(user.photo_url || null);
      }
    }
  }, [user, selectedPhoto]);

  useEffect(() => {
    if (shop) {
      setShopName(shop.name || '');
    }
  }, [shop]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { toast.error('Photo size must be less than 2MB'); return; }
      const compressed = await compressFileImage(file, 800, 0.80);
      setSelectedPhoto(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim()) {
      toast.error('Owner name is required.');
      return;
    }
    if (!emailAddress.trim()) {
      toast.error('Email address is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.put('/auth/update-profile', {
        name: ownerName.trim(),
        email: emailAddress.trim()
      });

      if (role === 'owner' && shop && shopName.trim() !== shop.name) {
        await apiClient.put('/auth/shop', {
          name: shopName.trim(),
          address: shop.address || '',
          phone: shop.phone || ''
        });
      }

      const formData = new FormData();
      formData.append('homeAddress', homeAddress);
      formData.append('bloodGroup', bloodGroup);
      formData.append('dob', dob);
      formData.append('personalPhone', personalPhone);
      formData.append('aadharNumber', aadharNumber);
      if (selectedPhoto) {
        formData.append('photo', selectedPhoto);
      }
      
      await apiClient.put('/auth/profile/id-card', formData);
      
      toast.success('Profile and ID Card details updated successfully!');
      setSelectedPhoto(null);
      await reloadProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    const el = cardRef.current;
    if (!el) return;
    setIsDownloading(true);
    try {
      // Short delay to ensure image assets render cleanly
      await new Promise(r => setTimeout(r, 100));

      const canvas = await html2canvas(el, {
        scale: 3,           // 3× scale for crisp high-res output
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });

      const name = (ownerName || 'id-card').replace(/\s+/g, '_').toLowerCase();
      const fileName = `${name}_id_card.png`;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Failed to generate card image');
          setIsDownloading(false);
          return;
        }

        const file = new File([blob], fileName, { type: 'image/png' });
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        // 1. Mobile Web Share API (native iOS Safari & Android Chrome)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Owner ID Card',
              text: 'Panruti Association Owner ID Card'
            });
            toast.success('ID Card shared / saved successfully!');
            setIsDownloading(false);
            return;
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') {
              setIsDownloading(false);
              return;
            }
            console.warn('Share API fallback:', shareErr);
          }
        }

        // 2. iOS Safari Direct Download / View Fallback
        const blobUrl = URL.createObjectURL(blob);
        if (isIOS) {
          const newWin = window.open(blobUrl, '_blank');
          if (!newWin) {
            window.location.href = blobUrl;
          }
          toast.success('Image opened! Press & hold the image to Save to Photos.');
        } else {
          // 3. Desktop & Android standard anchor download
          const link = document.createElement('a');
          link.download = fileName;
          link.href = blobUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
          toast.success('ID Card downloaded successfully!');
        }
        setIsDownloading(false);
      }, 'image/png', 1.0);

    } catch (err: any) {
      console.error('Download error:', err);
      toast.error('Download failed. Please try again.');
      setIsDownloading(false);
    }
  };

  const formatDob = (s: string) => {
    if (!s) return '';
    try {
      const d = new Date(s);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    } catch { return s; }
  };

  function formatAadhar(value?: string): string {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-cards-wrapper, #printable-cards-wrapper * { visibility: visible !important; }
          #printable-cards-wrapper {
            position: fixed !important; inset: 0;
            display: flex !important; flex-direction: row !important;
            gap: 24px !important; justify-content: center !important;
            align-items: center !important; background: white !important;
          }
          .id-card-front, .id-card-back {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Fingerprint className="h-6 w-6 text-primary" /> Owner ID Card Generator
          </h2>
          <p className="text-muted-foreground text-sm">Official association ID card — 86 × 54 mm format.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
          className="gap-2 border-border/80 text-foreground bg-secondary/15 hover:bg-secondary/40 self-start sm:self-auto"
        >
          {isDownloading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Download className="h-4 w-4" />}
          {isDownloading ? 'Downloading…' : 'Download ID Card'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">

        {/* ── PREVIEW COLUMN ── */}
        <div className="lg:col-span-7">
          <Card className="bg-card/90 border-border/80">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Live Card Preview (86 × 54 mm)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center gap-8">
              <div id="printable-cards-wrapper" ref={cardRef} className="flex flex-col gap-8 items-center w-full">

                {/* ═══════════════════════════════════════
                    FRONT CARD — exactly 325 × 204 px
                ═══════════════════════════════════════ */}
                <div className="id-card-front" style={{
                  position: 'relative', width: CW, height: CH,
                  borderRadius: 14,
                  backgroundImage: `url(${cardFrontTemplate})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.55)', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: 81, left: 11,
                    width: 88, height: 108,
                    background: 'transparent',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 4,
                  }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="Owner" style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover',
                          transform: `scale(${photoScale}) translate(${photoX}px, ${photoY}px)`,
                          transition: 'transform 0.1s ease-out'
                        }} />
                      : <User style={{ width: 28, height: 28, color: '#bbb' }} />
                    }
                  </div>

                  {/* ── Serial Number (straight aligned with அடையாள அட்டை at top-right) ── */}
                  <div style={{
                    position: 'absolute', top: 57, right: 14,
                    zIndex: 4,
                    display: 'flex', alignItems: 'center',
                  }}>
                    <span style={{
                      fontSize: 11, color: '#FFFFFF', fontWeight: 800,
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '1px 7px', borderRadius: 4,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      fontFamily: 'sans-serif'
                    }}>{serialNumber || 'SL.NO'}</span>
                  </div>

                  {/* ── Dynamic name next to "பெயர் :" ── */}
                  <div style={{
                    position: 'absolute', top: 79, left: 148,
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>{ownerName || ''}</span>
                  </div>

                  {/* ── Dynamic shop next to "கடை :" ── */}
                  <div style={{
                    position: 'absolute', top: 104, left: 148,
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 11, color: 'white', fontWeight: 500 }}>{shopName || ''}</span>
                  </div>

                  {/* ── Dynamic Email ── */}
                  <div style={{
                    position: 'absolute', top: 128, left: 98,
                    width: 44, textAlign: 'right', whiteSpace: 'nowrap',
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 11, color: 'white', fontWeight: 500 }}>Email :</span>
                  </div>
                  <div style={{
                    position: 'absolute', top: 128, left: 148,
                    width: 165,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 11, color: 'white', fontWeight: 500 }}>{emailAddress || ''}</span>
                  </div>

                  {/* ── Thalaivar Signature (Transparent PNG) ── */}
                  <div style={{
                    position: 'absolute',
                    top: 151,
                    left: 105,
                    width: 60,
                    zIndex: 4,
                  }}>
                    <img
                      src={thalaivarSigUrl}
                      alt="Thalaivar Signature"
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                      }}
                    />
                  </div>

                  {/* ── Secretary Signature (Transparent PNG) ── */}
                  <div style={{
                    position: 'absolute',
                    top: 153,
                    right: 15,
                    width: 68,
                    zIndex: 4,
                  }}>
                    <img
                      src={secretarySigUrl}
                      alt="Secretary Signature"
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                      }}
                    />
                  </div>
                </div>

                {/* ═══════════════════════════════════════
                    BACK CARD — exactly 325 × 204 px
                ═══════════════════════════════════════ */}
                <div className="id-card-back" style={{
                  position: 'relative', width: CW, height: CH,
                  borderRadius: 14,
                  backgroundImage: `url(${cardBackTemplate})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.55)', flexShrink: 0,
                }}>
                  {/* ── Address value below template's "வீட்டு முகவரி :" ── */}
                  <div style={{ position: 'absolute', top: 44, left: 50, width: 230, maxHeight: 62, overflow: 'hidden', zIndex: 4 }}>
                    <div style={{ fontSize: 9.5, color: '#1E469C', fontWeight: 500, lineHeight: 1.35, wordBreak: 'normal', overflowWrap: 'break-word', whiteSpace: 'normal' }}>
                      {homeAddress || ''}
                    </div>
                  </div>

                  {/* ── White cover to hide the original "ஆதார் :" text and colon ── */}
                  <div style={{ position: 'absolute', top: 109, left: 45, width: 85, height: 16, background: 'white', zIndex: 3 }} />

                  {/* ── Aadhaar Label (Aligned left with other labels, font size reduced to fit before colon) ── */}
                  <div style={{ position: 'absolute', top: 110, left: 50, zIndex: 4 }}>
                    <span style={{ fontSize: 9.5, color: '#1E469C', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      ஆதார் கார்டு
                    </span>
                  </div>

                  {/* ── Aadhaar Colon (Aligned with other colons) ── */}
                  <div style={{ position: 'absolute', top: 110, left: 124, zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 700 }}>:</span>
                  </div>

                  {/* ── Aadhaar Value (Aligned with other values) ── */}
                  <div style={{ position: 'absolute', top: 110, left: 135, width: 157, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 500 }}>
                      {formatAadhar(aadharNumber)}
                    </span>
                  </div>

                  {/* ── Blood Group value: next to template's "இரத்த வகை :" ── */}
                  <div style={{ position: 'absolute', top: 130, left: 135, zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 500 }}>{bloodGroup || ''}</span>
                  </div>

                  {/* ── DOB value: next to template's "பிறந்த தேதி :" ── */}
                  <div style={{ position: 'absolute', top: 151, left: 135, zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 500 }}>{formatDob(dob)}</span>
                  </div>

                </div>

              </div>{/* end #printable-cards-wrapper */}

              <p className="text-center text-xs text-muted-foreground max-w-xs">
                Click <strong>"Print ID Card"</strong> to print or save as PDF.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── FORM COLUMN ── */}
        <div className="lg:col-span-5">
          <Card className="bg-card/90 border-border/80">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold">Customize Card Profile</CardTitle>
              <CardDescription className="text-xs">
                Fill in details manually — updates the card preview live.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSave} className="space-y-4">

                {/* Manual details */}
                <div className="space-y-3 border-b border-border/40 pb-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Serial Number</label>
                    <Input placeholder="e.g. 47/2025" value={serialNumber}
                      onChange={e => setSerialNumber(e.target.value)}
                      className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Owner Name</label>
                    <Input placeholder="Enter Owner Name..." value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                      className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Shop Name</label>
                    <Input placeholder="Enter Shop Name..." value={shopName}
                      onChange={e => setShopName(e.target.value)}
                      className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                    <Input type="email" placeholder="Enter Email Address..." value={emailAddress}
                      onChange={e => setEmailAddress(e.target.value)}
                      className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                </div>

                {/* Photo Upload */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Owner Photo (Passport Size)
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-16 rounded-lg bg-secondary/15 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
                      {photoPreview
                        ? (
                          <div className="w-full h-full overflow-hidden relative">
                            <img
                              src={photoPreview}
                              alt="Thumb"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transform: `scale(${photoScale}) translate(${photoX}px, ${photoY}px)`,
                                transition: 'transform 0.1s ease-out'
                              }}
                            />
                          </div>
                        )
                        : <User className="h-6 w-6 text-slate-500" />}
                    </div>
                    <div className="flex-1">
                      <Input type="file" accept="image/*" onChange={handlePhotoChange}
                        className="bg-secondary/35 border-border/80 text-xs cursor-pointer file:text-xs" />
                      <p className="text-[10px] text-muted-foreground/60 mt-1">JPEG, PNG or WEBP. Max 2MB.</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Personal Phone
                    </label>
                    <Input placeholder="+91 9876543210" value={personalPhone}
                      onChange={e => setPersonalPhone(e.target.value)}
                      className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Fingerprint className="h-3.5 w-3.5" /> Aadhar Number
                    </label>
                    <Input placeholder="1234 5678 9012" value={aadharNumber}
                      onChange={e => setAadharNumber(e.target.value)}
                      className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Date of Birth
                    </label>
                    <Input type="date" value={dob} onChange={e => setDob(e.target.value)}
                      className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Droplet className="h-3.5 w-3.5" /> Blood Group
                    </label>
                    <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-border/80 bg-secondary/35 px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-white">
                      <option className="bg-neutral-900 text-white" value="">Select Blood Group</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g =>
                        <option key={g} className="bg-neutral-900 text-white" value={g}>{g}</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Home Address (Back of card)
                  </label>
                  <textarea rows={3} placeholder="Enter your residential address..."
                    value={homeAddress} onChange={e => setHomeAddress(e.target.value)}
                    className="flex w-full rounded-md border border-border/80 bg-secondary/35 px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-white resize-none" />
                </div>
                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full text-xs font-bold uppercase tracking-wider mt-2 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    'Save Changes & Update Profile'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
