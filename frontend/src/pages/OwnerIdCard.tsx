import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import logo from '../logo.png';
import cardFrontTemplate from '../card-front-template.png';
import cardBackTemplate from '../card-back-template.png';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  Upload,
  Printer,
  Loader2,
  Droplet,
  Fingerprint,
  Mail
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

// ─── Card design constants (all in px, matching 86×54mm ratio) ─────────────
const CW = 325;    // card width
const CH = 204;    // card height
const LW = 110;    // orange left column width
const LH = 65;     // logo strip height (top)
const FH = 27;     // footer strip height (bottom)
// Body height (middle section) = CH - LH - FH = 112px
const OG = '#F5A623';   // orange
const BL = '#2E3FA3';   // blue

export default function OwnerIdCard() {
  const { user, shop, reloadProfile } = useAuth();

  const [homeAddress, setHomeAddress] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [dob, setDob] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setHomeAddress(user.home_address || '');
      setBloodGroup(user.blood_group || '');
      setDob(user.dob || '');
      setPersonalPhone(user.personal_phone || '');
      setAadharNumber(user.aadhar_number || '');
      setPhotoPreview(user.photo_url || null);
    }
  }, [user]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { toast.error('Photo size must be less than 2MB'); return; }
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('homeAddress', homeAddress.trim());
      fd.append('bloodGroup', bloodGroup.trim());
      fd.append('dob', dob);
      fd.append('personalPhone', personalPhone.trim());
      fd.append('aadharNumber', aadharNumber.trim());
      if (selectedPhoto) fd.append('photo', selectedPhoto);
      await apiClient.put('/auth/profile/id-card', fd);
      toast.success('ID Card details updated!');
      await reloadProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDob = (s: string) => {
    if (!s) return '';
    try {
      const d = new Date(s);
      return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    } catch { return s; }
  };

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
        <Button variant="outline" size="sm" onClick={() => window.print()}
          className="gap-2 border-border/80 text-foreground bg-secondary/15 hover:bg-secondary/40 self-start sm:self-auto">
          <Printer className="h-4 w-4" /> Print ID Card
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">

        {/* ── PREVIEW COLUMN ── */}
        <div className="lg:col-span-7">
          <Card className="bg-card/45 backdrop-blur-xl border-border/80">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Live Card Preview (86 × 54 mm)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center gap-8">
              <div id="printable-cards-wrapper" className="flex flex-col gap-8 items-center w-full">

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

                  {/* ── Photo box: placed exactly inside the pre-rendered white frame ── */}
                  <div style={{
                    position: 'absolute', top: 81, left: 11,
                    width: 88, height: 108,
                    background: 'transparent',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 4,
                  }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="Owner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <User style={{ width: 28, height: 28, color: '#bbb' }} />
                    }
                  </div>

                  {/* ── Dynamic name next to "பெயர் :" ── */}
                  <div style={{
                    position: 'absolute', top: 96, left: 148,
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 12, color: 'white', fontWeight: 800 }}>{user?.name || ''}</span>
                  </div>

                  {/* ── Dynamic shop next to "கடை :" ── */}
                  <div style={{
                    position: 'absolute', top: 126, left: 142,
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 11, color: 'white', fontWeight: 700 }}>{shop?.name || ''}</span>
                  </div>

                  {/* ── Dynamic Email ── */}
                  <div style={{
                    position: 'absolute', top: 148, left: 109,
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Email: </span>
                    <span style={{
                      fontSize: 8.5, color: 'white', fontWeight: 500,
                      display: 'inline-block', maxWidth: 200,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      verticalAlign: 'bottom',
                    }}>{user?.email || ''}</span>
                  </div>

                  {/* ── Dynamic Aadhar ── */}
                  <div style={{
                    position: 'absolute', top: 164, left: 109,
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Aadhar: </span>
                    <span style={{ fontSize: 8.5, color: 'white', fontFamily: 'monospace', fontWeight: 600 }}>
                      {aadharNumber || ''}
                    </span>
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
                  {/* ── Dynamic address: placed under the pre-rendered "வீட்டு முகவரி :" ── */}
                  <div style={{
                    position: 'absolute',
                    top: 44, left: 50, width: 230,
                    maxHeight: 60, overflow: 'hidden',
                    zIndex: 4,
                  }}>
                    <div style={{
                      fontSize: 10, color: '#1E469C', fontWeight: 600,
                      lineHeight: 1.4,
                    }}>
                      {homeAddress || ''}
                    </div>
                  </div>

                  {/* ── Dynamic Blood Group: next to "இரத்த வகை :" ── */}
                  <div style={{
                    position: 'absolute', top: 123, left: 125,
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 700 }}>{bloodGroup || ''}</span>
                  </div>

                  {/* ── Dynamic Date of Birth: next to "பிறந்த தேதி :" ── */}
                  <div style={{
                    position: 'absolute', top: 145, left: 125,
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 700 }}>{formatDob(dob)}</span>
                  </div>

                  {/* ── Dynamic Cell Number: next to "செல் நெம்பர் :" ── */}
                  <div style={{
                    position: 'absolute', top: 167, left: 125,
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 700 }}>{personalPhone || ''}</span>
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
          <Card className="bg-card/45 backdrop-blur-xl border-border/80">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold">Customize Card Profile</CardTitle>
              <CardDescription className="text-xs">
                Fill in your details — updates the card preview live.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSave} className="space-y-4">

                {/* Photo Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Owner Photo (Passport Size)
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-16 rounded-lg bg-secondary/15 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
                      {photoPreview
                        ? <img src={photoPreview} alt="Thumb" className="w-full h-full object-cover" />
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
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g =>
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

                <div className="rounded-md bg-blue-950/40 border border-blue-800/40 px-3 py-2 text-xs text-blue-200 flex items-start gap-2">
                  <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
                  <span>Your email <strong>{user?.email}</strong> is automatically shown on the ID card front.</span>
                </div>

                <Button type="submit" className="w-full text-xs font-bold uppercase tracking-wider mt-2"
                  disabled={isSubmitting}>
                  {isSubmitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                    : 'Save & Generate Card'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
