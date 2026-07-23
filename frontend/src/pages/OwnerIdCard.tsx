import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import cardFrontTemplate from '../card-front-template.png';
import cardBackTemplate from '../card-back-template.png';
import thalaivarSignature from '../thalaivar-signature.png';
import secretarySignature from '../secretary-signature.png';
import {
  User, Phone, MapPin, Calendar, Upload, Download, Loader2, Droplet, Fingerprint,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';
import { compressFileImage } from '../utils/imageCompressor';

const CW = 325;
const CH = 204;
const EXPORT_SCALE = 4;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// stripWhite: auto-detects white paper area, crops outer border frames/backgrounds,
// and remaps signature ink pixels to crisp black strokes on transparent canvas
function stripWhite(imgSrc: string, threshold = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgSrc;
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;

      // 1. Pass 1: find bounding box of white paper (brightness > threshold)
      let minX = c.width, maxX = 0, minY = c.height, maxY = 0;
      let hasWhite = false;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          const br = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (br > threshold) {
            hasWhite = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Inset bounds by 6px inside white area to discard any border frame lines
      const insetMinX = hasWhite ? minX + 6 : 0;
      const insetMaxX = hasWhite ? maxX - 6 : c.width;
      const insetMinY = hasWhite ? minY + 6 : 0;
      const insetMaxY = hasWhite ? maxY - 6 : c.height;

      // 2. Pass 2: convert only inner ink pixels to transparent black strokes
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          const br = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (!hasWhite || x < insetMinX || x > insetMaxX || y < insetMinY || y > insetMaxY || br > threshold) {
            d[i + 3] = 0; // fully transparent
          } else {
            const darkness = 1 - br / threshold;
            d[i] = 0; d[i + 1] = 0; d[i + 2] = 0;
            d[i + 3] = Math.round(darkness * 255);
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imgSrc);
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

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

  // Preloaded HTMLImageElements for INSTANT download (0 network latency)
  const frontTplRef = useRef<HTMLImageElement | null>(null);
  const backTplRef = useRef<HTMLImageElement | null>(null);
  const thalSigRef = useRef<HTMLImageElement | null>(null);
  const secSigRef = useRef<HTMLImageElement | null>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);

  // Preload template & signature images on mount
  useEffect(() => {
    loadImage(cardFrontTemplate).then(img => { frontTplRef.current = img; });
    loadImage(cardBackTemplate).then(img => { backTplRef.current = img; });

    stripWhite(thalaivarSignature, 200).then(url => {
      setThalaivarSigUrl(url);
      loadImage(url).then(img => { thalSigRef.current = img; });
    });
    stripWhite(secretarySignature, 200).then(url => {
      setSecretarySigUrl(url);
      loadImage(url).then(img => { secSigRef.current = img; });
    });
  }, []);

  // Preload photo whenever preview changes
  useEffect(() => {
    if (photoPreview) {
      loadImage(photoPreview).then(img => { photoRef.current = img; }).catch(() => { photoRef.current = null; });
    } else {
      photoRef.current = null;
    }
  }, [photoPreview]);

  useEffect(() => {
    if (user) {
      setOwnerName(user.name || '');
      setEmailAddress(user.email || '');
      setHomeAddress(user.home_address || '');
      setBloodGroup(user.blood_group || '');
      setDob(user.dob || '');
      setPersonalPhone(user.personal_phone || '');
      setAadharNumber(user.aadhar_number || '');
      if (!selectedPhoto) setPhotoPreview(user.photo_url || null);
    }
  }, [user, selectedPhoto]);

  useEffect(() => {
    if (shop) setShopName(shop.name || '');
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
    if (!ownerName.trim()) { toast.error('Owner name is required.'); return; }
    if (!emailAddress.trim()) { toast.error('Email address is required.'); return; }
    setIsSubmitting(true);
    try {
      await apiClient.put('/auth/update-profile', { name: ownerName.trim(), email: emailAddress.trim() });
      if (role === 'owner' && shop && shopName.trim() !== shop.name)
        await apiClient.put('/auth/shop', { name: shopName.trim(), address: shop.address || '', phone: shop.phone || '' });
      const formData = new FormData();
      formData.append('homeAddress', homeAddress);
      formData.append('bloodGroup', bloodGroup);
      formData.append('dob', dob);
      formData.append('personalPhone', personalPhone);
      formData.append('aadharNumber', aadharNumber);
      if (selectedPhoto) formData.append('photo', selectedPhoto);
      await apiClient.put('/auth/profile/id-card', formData);
      toast.success('Profile and ID Card details updated successfully!');
      setSelectedPhoto(null);
      await reloadProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save changes.');
    } finally { setIsSubmitting(false); }
  };

  const formatDob = (s: string) => {
    if (!s) return '';
    try { const d = new Date(s); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; }
    catch { return s; }
  };
  const formatAadhar = (v?: string) => !v ? '' : v.replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');

  // ── INSTANT Canvas2D Download ─────────────────────────────────────────────
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const S = EXPORT_SCALE;
      const W = CW * S, H = CH * S;

      // Use preloaded images or fallback load
      const frontTpl = frontTplRef.current || await loadImage(cardFrontTemplate);
      const backTpl = backTplRef.current || await loadImage(cardBackTemplate);
      const thalSig = thalSigRef.current || await loadImage(thalaivarSigUrl);
      const secSig = secSigRef.current || await loadImage(secretarySigUrl);
      const ownerPhoto = photoRef.current;

      // ── FRONT CARD ────────────────────────────────────────────────────────
      const frontCanvas = document.createElement('canvas');
      frontCanvas.width = W; frontCanvas.height = H;
      const fc = frontCanvas.getContext('2d')!;
      fc.drawImage(frontTpl, 0, 0, W, H);

      // Photo
      if (ownerPhoto) {
        const px = 11 * S, py = 81 * S, pw = 88 * S, ph = 108 * S;
        fc.save(); fc.beginPath(); fc.rect(px, py, pw, ph); fc.clip();
        const ratio = Math.max(pw / ownerPhoto.width, ph / ownerPhoto.height) * photoScale;
        const dw = ownerPhoto.width * ratio, dh = ownerPhoto.height * ratio;
        fc.drawImage(ownerPhoto, px + (pw - dw) / 2 + photoX * S, py + (ph - dh) / 2 + photoY * S, dw, dh);
        fc.restore();
      }

      // SL.NO — center Y = 60.5 (straight with அடையாள அட்டை pill)
      {
        const slText = serialNumber || '';
        if (slText) {
          const fontSize = 13 * S;
          fc.font = `bold ${fontSize}px Arial, sans-serif`;
          fc.fillStyle = '#FFFFFF';
          fc.textBaseline = 'middle';
          const tx = W - fc.measureText(slText).width - 16 * S;
          fc.fillText(slText, tx, 60.5 * S);
        }
      }

      // Front Text Rows (middle textBaseline for 100% exact vertical alignment with pre-printed template labels)
      fc.textBaseline = 'middle';
      const ft = (text: string, x: number, centerY: number, maxW: number, fs = 12) => {
        fc.font = `500 ${fs * S}px Arial, sans-serif`;
        fc.fillStyle = '#FFFFFF';
        let t = text;
        while (t.length > 1 && fc.measureText(t).width > maxW * S) t = t.slice(0, -1);
        if (t !== text) t += '\u2026';
        fc.fillText(t, x * S, centerY * S);
      };

      // 1. Owner Name (aligned with pre-printed பெயர் : at Y = 93.8)
      ft(ownerName, 148, 93.8, 168, 12);
      // 2. Shop Name (aligned with pre-printed கடை : at Y = 120.8)
      ft(shopName, 148, 120.8, 168, 11);
      // 3. Email Label & Value (at Y = 144.0)
      ft('Email :', 98, 144.0, 44, 11);
      ft(emailAddress, 148, 144.0, 165, 11);

      // Signatures
      const drawSig = (img: HTMLImageElement, dx: number, dy: number, dw: number) => {
        const dh = (img.height / img.width) * dw;
        fc.globalCompositeOperation = 'multiply';
        fc.drawImage(img, dx, dy, dw, dh);
        fc.globalCompositeOperation = 'source-over';
      };
      drawSig(thalSig, 105 * S, 160 * S, 60 * S);
      drawSig(secSig, W - 15 * S - 68 * S, 160 * S, 68 * S);

      // ── BACK CARD ─────────────────────────────────────────────────────────
      const backCanvas = document.createElement('canvas');
      backCanvas.width = W; backCanvas.height = H;
      const bc = backCanvas.getContext('2d')!;
      bc.drawImage(backTpl, 0, 0, W, H);

      // Address (multi-line)
      bc.font = `500 ${11 * S}px Arial, sans-serif`;
      bc.fillStyle = '#1E469C';
      bc.textBaseline = 'top';
      wrapText(bc, homeAddress || '', 230 * S).slice(0, 5).forEach((line, i) => bc.fillText(line, 50 * S, (44 + i * 13) * S));

      // Back Text Rows (middle textBaseline matching exact pre-printed label Y-centers)
      bc.textBaseline = 'middle';
      const bt = (text: string, x: number, centerY: number, bold = false, size = 11) => {
        bc.font = `${bold ? 'bold' : '500'} ${size * S}px Arial, sans-serif`;
        bc.fillStyle = '#1E469C';
        bc.fillText(text, x * S, centerY * S);
      };

      // Row 1: Aadhaar Label + Colon + Value (Y = 111.0)
      bt('ஆதார் கார்டு', 50, 111.0, true, 9.5);
      bt(':', 124, 111.0, true, 11);
      bt(formatAadhar(aadharNumber) || '---- ---- ----', 135, 111.0, false, 11);

      // Row 2: Blood Group (Y = 131.0 next to pre-printed இரத்த வகை :)
      bt(bloodGroup || '', 135, 131.0, false, 11);

      // Row 3: DOB (Y = 152.0 next to pre-printed பிறந்த தேதி :)
      bt(formatDob(dob), 135, 152.0, false, 11);

      // Row 4: Phone (Y = 172.0 next to pre-printed செல் நெம்பர் :)
      bt(personalPhone || '', 135, 172.0, false, 11);

      // ── COMBINE ───────────────────────────────────────────────────────────
      const GAP = 24 * S;
      const combined = document.createElement('canvas');
      combined.width = W; combined.height = H * 2 + GAP;
      const cc = combined.getContext('2d')!;
      cc.fillStyle = '#111111';
      cc.fillRect(0, 0, combined.width, combined.height);
      cc.drawImage(frontCanvas, 0, 0);
      cc.drawImage(backCanvas, 0, H + GAP);

      const slug = (ownerName || 'id-card').replace(/\s+/g, '_').toLowerCase();
      const fileName = `${slug}_id_card.png`;

      combined.toBlob(async (blob) => {
        if (!blob) { toast.error('Failed to generate card image'); setIsDownloading(false); return; }
        const file = new File([blob], fileName, { type: 'image/png' });
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'Owner ID Card', text: 'Panruti Association ID Card' });
            toast.success('ID Card shared / saved successfully!'); setIsDownloading(false); return;
          } catch (err: any) { if (err.name === 'AbortError') { setIsDownloading(false); return; } }
        }

        const blobUrl = URL.createObjectURL(blob);
        if (isIOS) {
          const w = window.open(blobUrl, '_blank'); if (!w) window.location.href = blobUrl;
          toast.success('Image opened! Press & hold to Save to Photos.');
        } else {
          const a = document.createElement('a'); a.download = fileName; a.href = blobUrl;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
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

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-cards-wrapper, #printable-cards-wrapper * { visibility: visible !important; }
          #printable-cards-wrapper { position: fixed !important; inset: 0; display: flex !important; flex-direction: row !important; gap: 24px !important; justify-content: center !important; align-items: center !important; background: white !important; }
          .id-card-front, .id-card-back { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
        }
      `}</style>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Fingerprint className="h-6 w-6 text-primary" /> Owner ID Card Generator
          </h2>
          <p className="text-muted-foreground text-sm">Official association ID card — 86 × 54 mm format.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}
          className="gap-2 border-border/80 text-foreground bg-secondary/15 hover:bg-secondary/40 self-start sm:self-auto">
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isDownloading ? 'Downloading…' : 'Download ID Card'}
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Card className="bg-card/90 border-border/80">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Live Card Preview (86 × 54 MM)</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center gap-8">
              <div id="printable-cards-wrapper" className="flex flex-col gap-8 items-center w-full">
                <div className="id-card-front" style={{ position: 'relative', width: CW, height: CH, borderRadius: 14, backgroundImage: `url(${cardFrontTemplate})`, backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.55)', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 81, left: 11, width: 88, height: 108, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4 }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="Owner" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${photoScale}) translate(${photoX}px,${photoY}px)`, transition: 'transform 0.1s ease-out' }} />
                      : <User style={{ width: 28, height: 28, color: '#bbb' }} />}
                  </div>
                  {serialNumber && (
                    <div style={{ position: 'absolute', top: 54.5, right: 14, height: 12, display: 'flex', alignItems: 'center', zIndex: 4 }}>
                      <span style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 800, letterSpacing: 0.5, fontFamily: 'Arial, sans-serif', textShadow: '0 1px 4px rgba(0,0,0,0.6)', lineHeight: 1 }}>{serialNumber}</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 87.8, left: 148, height: 12, display: 'flex', alignItems: 'center', zIndex: 4 }}>
                    <span style={{ fontSize: 12, color: 'white', fontWeight: 500, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>{ownerName}</span>
                  </div>
                  <div style={{ position: 'absolute', top: 114.8, left: 148, height: 12, display: 'flex', alignItems: 'center', zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: 'white', fontWeight: 500, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>{shopName}</span>
                  </div>
                  <div style={{ position: 'absolute', top: 138.0, left: 98, width: 44, textAlign: 'right', whiteSpace: 'nowrap', height: 12, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: 'white', fontWeight: 500, lineHeight: 1 }}>Email :</span>
                  </div>
                  <div style={{ position: 'absolute', top: 138.0, left: 148, width: 165, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', height: 12, display: 'flex', alignItems: 'center', zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: 'white', fontWeight: 500, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>{emailAddress}</span>
                  </div>
                  {/* Thalaivar Signature */}
                  <div style={{ position: 'absolute', top: 160, left: 105, width: 60, zIndex: 4 }}>
                    <img src={thalaivarSigUrl} alt="Thalaivar Sig" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  </div>
                  {/* Secretary Signature */}
                  <div style={{ position: 'absolute', top: 160, right: 15, width: 68, zIndex: 4 }}>
                    <img src={secretarySigUrl} alt="Secretary Sig" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  </div>
                </div>
                <div className="id-card-back" style={{ position: 'relative', width: CW, height: CH, borderRadius: 14, backgroundImage: `url(${cardBackTemplate})`, backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.55)', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 44, left: 50, width: 230, maxHeight: 65, overflow: 'hidden', zIndex: 4 }}>
                    <div style={{ fontSize: 9.5, color: '#1E469C', fontWeight: 500, lineHeight: 1.35, wordBreak: 'normal', overflowWrap: 'break-word', whiteSpace: 'normal', fontFamily: 'Arial, sans-serif' }}>{homeAddress}</div>
                  </div>
                  {/* Row 1: Aadhaar Card Label + Colon + Value (Y = 111.0) */}
                  <div style={{ position: 'absolute', top: 105.0, left: 50, height: 12, display: 'flex', alignItems: 'center', zIndex: 4 }}>
                    <span style={{ fontSize: 9.5, color: '#1E469C', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>ஆதார் கார்டு</span>
                  </div>
                  <div style={{ position: 'absolute', top: 105.0, left: 124, height: 12, display: 'flex', alignItems: 'center', zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 700, lineHeight: 1 }}>:</span>
                  </div>
                  <div style={{ position: 'absolute', top: 105.0, left: 135, width: 157, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', height: 12, display: 'flex', alignItems: 'center', zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 500, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>{formatAadhar(aadharNumber) || '---- ---- ----'}</span>
                  </div>
                  {/* Row 2: Blood Group Value (Y = 131.0 next to pre-printed இரத்த வகை :) */}
                  <div style={{ position: 'absolute', top: 125.0, left: 135, height: 12, display: 'flex', alignItems: 'center', zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 500, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>{bloodGroup}</span>
                  </div>
                  {/* Row 3: DOB Value (Y = 152.0 next to pre-printed பிறந்த தேதி :) */}
                  <div style={{ position: 'absolute', top: 146.0, left: 135, height: 12, display: 'flex', alignItems: 'center', zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 500, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>{formatDob(dob)}</span>
                  </div>
                  {/* Row 4: Phone Value (Y = 172.0 next to pre-printed செல் நெம்பர் :) */}
                  <div style={{ position: 'absolute', top: 166.0, left: 135, height: 12, display: 'flex', alignItems: 'center', zIndex: 4 }}>
                    <span style={{ fontSize: 11, color: '#1E469C', fontWeight: 500, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>{personalPhone}</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground max-w-xs">Click <strong>"Download ID Card"</strong> to save a high-resolution PNG.</p>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-5">
          <Card className="bg-card/90 border-border/80">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold">Customize Card Profile</CardTitle>
              <CardDescription className="text-xs">Fill in details manually — updates the card preview live.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-3 border-b border-border/40 pb-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Serial Number</label>
                    <Input placeholder="e.g. 47/2025" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Owner Name</label>
                    <Input placeholder="Enter Owner Name..." value={ownerName} onChange={e => setOwnerName(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Shop Name</label>
                    <Input placeholder="Enter Shop Name..." value={shopName} onChange={e => setShopName(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                    <Input type="email" placeholder="Enter Email Address..." value={emailAddress} onChange={e => setEmailAddress(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Owner Photo (Passport Size)</label>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-16 rounded-lg bg-secondary/15 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
                      {photoPreview ? <div className="w-full h-full overflow-hidden relative"><img src={photoPreview} alt="Thumb" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${photoScale}) translate(${photoX}px,${photoY}px)`, transition: 'transform 0.1s ease-out' }} /></div> : <User className="h-6 w-6 text-slate-500" />}
                    </div>
                    <div className="flex-1">
                      <Input type="file" accept="image/*" onChange={handlePhotoChange} className="bg-secondary/35 border-border/80 text-xs cursor-pointer file:text-xs" />
                      <p className="text-[10px] text-muted-foreground/60 mt-1">JPEG, PNG or WEBP. Max 2MB.</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Personal Phone</label>
                    <Input placeholder="+91 9876543210" value={personalPhone} onChange={e => setPersonalPhone(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" /> Aadhar Number</label>
                    <Input placeholder="1234 5678 9012" value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date of Birth</label>
                    <Input type="date" value={dob} onChange={e => setDob(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Droplet className="h-3.5 w-3.5" /> Blood Group</label>
                    <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} className="flex h-9 w-full rounded-md border border-border/80 bg-secondary/35 px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-white">
                      <option className="bg-neutral-900 text-white" value="">Select Blood Group</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} className="bg-neutral-900 text-white" value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Home Address (Back of card)</label>
                  <textarea rows={3} placeholder="Enter your residential address..." value={homeAddress} onChange={e => setHomeAddress(e.target.value)} className="flex w-full rounded-md border border-border/80 bg-secondary/35 px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-white resize-none" />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full text-xs font-bold uppercase tracking-wider mt-2 flex items-center justify-center gap-2">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving Changes...</> : 'Save Changes & Update Profile'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
