import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import logo from '../logo.png';
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
                  borderRadius: 14, border: `5px solid ${OG}`,
                  background: 'white', overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.55)', flexShrink: 0,
                }}>

                  {/* ── Layer 0: full-height orange left column ── */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0,
                    width: LW, background: OG, zIndex: 0,
                  }} />

                  {/* ── Layer 1a: white right section at top (logo area) ── */}
                  <div style={{
                    position: 'absolute', top: 0, left: LW, right: 0,
                    height: LH, background: 'white', zIndex: 1,
                  }} />

                  {/* ── Layer 1b: blue right section in body ── */}
                  <div style={{
                    position: 'absolute', top: LH, left: LW, right: 0,
                    bottom: FH, background: BL, zIndex: 1,
                  }} />

                  {/* ── Layer 1c: white footer ── */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: FH, background: 'white',
                    borderTop: `1px solid rgba(245,166,35,0.5)`, zIndex: 2,
                  }} />

                  {/* ── Logo image: RIGHT portion only (Tamil text area) ── */}
                  <div style={{
                    position: 'absolute', top: 2, left: LW + 2, right: 2,
                    height: LH - 4, overflow: 'hidden', zIndex: 3,
                  }}>
                    <img src={logo} alt="Logo" style={{
                      height: '100%', width: 'auto',
                      objectFit: 'contain', objectPosition: 'left center',
                    }} />
                  </div>

                  {/* ── "47/2018" label in orange column ── */}
                  <div style={{
                    position: 'absolute', top: LH + 3, left: 6,
                    fontSize: 8, fontWeight: 800, color: '#1a1a1a',
                    zIndex: 4, letterSpacing: 0.4,
                  }}>47/2018</div>

                  {/* ── Photo box: in orange column, below "47/2018" ──
                       top = LH + 15 = 80
                       height = 91  →  bottom = 171
                       footer starts at CH - FH = 177  →  6px gap ✓
                  */}
                  <div style={{
                    position: 'absolute', top: LH + 15, left: 8,
                    width: LW - 18, height: CH - LH - FH - 21, // 91px
                    background: 'white', border: '2px solid #888',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 4,
                  }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="Owner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <User style={{ width: 28, height: 28, color: '#bbb' }} />
                    }
                  </div>

                  {/* ── "அடையாள அட்டை" badge ── */}
                  <div style={{
                    position: 'absolute', top: LH + 5, left: LW + 10,
                    background: OG, borderRadius: 20,
                    padding: '3px 13px',
                    fontSize: 9, fontWeight: 800, color: '#111',
                    whiteSpace: 'nowrap', zIndex: 4,
                  }}>அடையாள அட்டை</div>

                  {/* ── Right content block (Name, Shop, Email, Aadhar)
                       Starts at: top = LH + 27 = 92
                       Ends at:   CH - FH - 5 = 172
                       Available height = 172 - 92 = 80px for 4 rows
                  ── */}
                  <div style={{
                    position: 'absolute',
                    top: LH + 27,       // 92px from top
                    left: LW + 8,       // 118px from left
                    right: 6,
                    display: 'flex', flexDirection: 'column', gap: 0,
                    zIndex: 4,
                  }}>
                    {/* Row: Name */}
                    <div style={{ marginBottom: 5 }}>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>பெயர் : </span>
                      <span style={{ fontSize: 12, color: 'white', fontWeight: 800 }}>{user?.name || ''}</span>
                    </div>
                    {/* Row: Shop */}
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>கடை  : </span>
                      <span style={{ fontSize: 11, color: 'white', fontWeight: 700 }}>{shop?.name || ''}</span>
                    </div>
                    {/* Row: Email */}
                    <div style={{ marginBottom: 5 }}>
                      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>Email   : </span>
                      <span style={{
                        fontSize: 8.5, color: 'rgba(255,255,255,0.92)', fontWeight: 400,
                        display: 'inline-block', maxWidth: 130,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        verticalAlign: 'bottom',
                      }}>{user?.email || ''}</span>
                    </div>
                    {/* Row: Aadhar */}
                    <div>
                      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>Aadhar : </span>
                      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.92)', fontFamily: 'monospace', fontWeight: 500 }}>
                        {aadharNumber || ''}
                      </span>
                    </div>
                  </div>

                  {/* ── Footer: President / Secretary ── */}
                  <div style={{
                    position: 'absolute', bottom: 4, left: 12, right: 12,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    zIndex: 4,
                  }}>
                    <span style={{ fontSize: 10, color: BL, fontWeight: 800 }}>தலைவர்</span>
                    <span style={{ fontSize: 10, color: BL, fontWeight: 800 }}>செயலாளர்</span>
                  </div>
                </div>

                {/* ═══════════════════════════════════════
                    BACK CARD — exactly 325 × 204 px
                ═══════════════════════════════════════ */}
                <div className="id-card-back" style={{
                  position: 'relative', width: CW, height: CH,
                  borderRadius: 14, border: `5px solid ${OG}`,
                  background: 'white', overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.55)', flexShrink: 0,
                }}>
                  {/* Orange diagonal — top-left */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    width: 85, height: 85,
                    background: OG,
                    clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                    zIndex: 0,
                  }} />

                  {/* Orange diagonal — bottom-right */}
                  <div style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 115, height: 85,
                    background: OG,
                    clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                    zIndex: 0,
                  }} />

                  {/* Content area: padded away from the triangles */}
                  <div style={{
                    position: 'absolute',
                    top: 16, bottom: 16, left: 20, right: 20,
                    zIndex: 1,
                    display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}>
                    {/* Home address section */}
                    <div>
                      <div style={{ fontSize: 13, color: BL, fontWeight: 800, marginBottom: 6 }}>
                        வீட்டு முகவரி :
                      </div>
                      <div style={{
                        fontSize: 10, color: '#333',
                        lineHeight: 1.55, paddingLeft: 2,
                        maxHeight: 56, overflow: 'hidden',
                      }}>
                        {homeAddress || ''}
                      </div>
                    </div>

                    {/* Bottom three fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 12, color: BL, fontWeight: 800 }}>
                        இரத்த வகை :{' '}
                        <span style={{ color: '#222', fontWeight: 500 }}>{bloodGroup || ''}</span>
                      </div>
                      <div style={{ fontSize: 12, color: BL, fontWeight: 800 }}>
                        பிறந்த தேதி :{' '}
                        <span style={{ color: '#222', fontWeight: 500 }}>{formatDob(dob)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: BL, fontWeight: 800 }}>
                        செல் நெம்பர் :{' '}
                        <span style={{ color: '#222', fontWeight: 500 }}>{personalPhone || ''}</span>
                      </div>
                    </div>
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
