import React, { useState, useEffect } from 'react';
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

// stripWhite: removes near-white pixels AND remaps remaining ink pixels to black
// so signatures render as crisp black strokes on any background
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
      const d = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const r = d.data[i], g = d.data[i+1], b = d.data[i+2];
        const brightness = (r + g + b) / 3;
        if (brightness > threshold) {
          // near-white → fully transparent
          d.data[i+3] = 0;
        } else {
          // ink pixel → remap to solid black, preserve darkness as opacity
          const darkness = 1 - brightness / threshold;
          d.data[i]   = 0;   // R
          d.data[i+1] = 0;   // G
          d.data[i+2] = 0;   // B
          d.data[i+3] = Math.round(darkness * 255); // alpha = how dark it is
        }
      }
      ctx.putImageData(d, 0, 0);
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
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

export default function OwnerIdCard() {
  const { user, reloadProfile, role, shop } = useAuth();
  const [ownerName, setOwnerName]         = useState(user?.name || '');
  const [shopName, setShopName]           = useState(shop?.name || '');
  const [emailAddress, setEmailAddress]   = useState(user?.email || '');
  const [homeAddress, setHomeAddress]     = useState(user?.home_address || '');
  const [bloodGroup, setBloodGroup]       = useState(user?.blood_group || '');
  const [dob, setDob]                     = useState(user?.dob || '');
  const [personalPhone, setPersonalPhone] = useState(user?.personal_phone || '');
  const [aadharNumber, setAadharNumber]   = useState(user?.aadhar_number || '');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview]   = useState<string | null>(user?.photo_url || null);
  const [photoScale, setPhotoScale]       = useState(1.0);
  const [photoX, setPhotoX]               = useState(0);
  const [photoY, setPhotoY]               = useState(0);
  const [serialNumber, setSerialNumber]   = useState('');
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [thalaivarSigUrl, setThalaivarSigUrl] = useState<string>(thalaivarSignature);
  const [secretarySigUrl, setSecretarySigUrl] = useState<string>(secretarySignature);

  useEffect(() => {
    stripWhite(thalaivarSignature, 200).then(setThalaivarSigUrl);
    stripWhite(secretarySignature, 200).then(setSecretarySigUrl);
  }, []);

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

  useEffect(() => { if (shop) setShopName(shop.name || ''); }, [shop]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2*1024*1024) { toast.error('Photo size must be less than 2MB'); return; }
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
        await apiClient.put('/auth/shop', { name: shopName.trim(), address: shop.address||'', phone: shop.phone||'' });
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
    try { const d = new Date(s); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; }
    catch { return s; }
  };
  const formatAadhar = (v?: string) => !v ? '' : v.replace(/\D/g,'').slice(0,12).replace(/(\d{4})(?=\d)/g,'$1 ');

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const S = EXPORT_SCALE;
      const W = CW*S, H = CH*S;
      const [frontTpl, backTpl, thalSig, secSig] = await Promise.all([
        loadImage(cardFrontTemplate), loadImage(cardBackTemplate),
        loadImage(thalaivarSigUrl), loadImage(secretarySigUrl),
      ]);
      let ownerPhoto: HTMLImageElement | null = null;
      if (photoPreview) { try { ownerPhoto = await loadImage(photoPreview); } catch {} }

      // FRONT CARD
      const frontCanvas = document.createElement('canvas');
      frontCanvas.width = W; frontCanvas.height = H;
      const fc = frontCanvas.getContext('2d')!;
      fc.drawImage(frontTpl, 0, 0, W, H);
      if (ownerPhoto) {
        const px=11*S, py=81*S, pw=88*S, ph=108*S;
        fc.save(); fc.beginPath(); fc.rect(px,py,pw,ph); fc.clip();
        const ratio = Math.max(pw/ownerPhoto.width, ph/ownerPhoto.height)*photoScale;
        const dw=ownerPhoto.width*ratio, dh=ownerPhoto.height*ratio;
        fc.drawImage(ownerPhoto, px+(pw-dw)/2+photoX*S, py+(ph-dh)/2+photoY*S, dw, dh);
        fc.restore();
      }
      // SL.NO — plain text, no background box
      {
        const slText = serialNumber || '';
        if (slText) {
          const fontSize = 12 * S;
          fc.font = `bold ${fontSize}px Arial, sans-serif`;
          fc.fillStyle = '#FFFFFF';
          fc.textBaseline = 'middle';
          const tx = W - fc.measureText(slText).width - 15 * S;
          fc.fillText(slText, tx, 65 * S);
        }
      }
      // Text rows
      fc.textBaseline='top';
      const ft = (text: string, x: number, y: number, maxW: number, fs=13) => {
        fc.font=`500 ${fs*S}px Arial, sans-serif`; fc.fillStyle='#FFFFFF';
        let t=text;
        while(t.length>1 && fc.measureText(t).width>maxW*S) t=t.slice(0,-1);
        if(t!==text) t+='\u2026';
        fc.fillText(t, x*S, y*S);
      };
      ft(ownerName, 148, 79, 168);
      ft(shopName, 148, 104, 168, 12);
      fc.font=`500 ${11*S}px Arial, sans-serif`; fc.fillStyle='#FFFFFF';
      fc.fillText('Email :', 98*S, 128*S);
      ft(emailAddress, 148, 128, 165, 11);
      // Signatures — drawn with multiply blend so black ink shows cleanly on any bg
      fc.globalCompositeOperation = 'multiply';
      { const sw=60*S, sh=(thalSig.height/thalSig.width)*60*S; fc.drawImage(thalSig,105*S,151*S,sw,sh); }
      { const sw=68*S, sh=(secSig.height/secSig.width)*68*S; fc.drawImage(secSig,W-15*S-sw,153*S,sw,sh); }
      fc.globalCompositeOperation = 'source-over';

      // BACK CARD
      const backCanvas = document.createElement('canvas');
      backCanvas.width = W; backCanvas.height = H;
      const bc = backCanvas.getContext('2d')!;
      bc.drawImage(backTpl, 0, 0, W, H);
      // Address
      bc.font=`500 ${11*S}px Arial, sans-serif`; bc.fillStyle='#1E469C'; bc.textBaseline='top';
      wrapText(bc, homeAddress||'', 230*S).slice(0,5).forEach((line,i) => bc.fillText(line,50*S,(44+i*13)*S));
      // White cover over template ஆதார் :
      bc.fillStyle='#FFFFFF'; bc.fillRect(45*S,109*S,87*S,16*S);
      // Aadhaar
      bc.font=`bold ${11*S}px Arial, sans-serif`; bc.fillStyle='#1E469C'; bc.textBaseline='top';
      bc.fillText('ஆதார் கார்டு',50*S,110*S); bc.fillText(':',124*S,110*S);
      bc.font=`500 ${11*S}px Arial, sans-serif`; bc.fillText(formatAadhar(aadharNumber),135*S,110*S);
      bc.fillText(bloodGroup||'',135*S,130*S);
      bc.fillText(formatDob(dob),135*S,151*S);
      bc.fillText(personalPhone||'',135*S,172*S);

      // Combine
      const GAP=24*S;
      const combined=document.createElement('canvas');
      combined.width=W; combined.height=H*2+GAP;
      const cc=combined.getContext('2d')!;
      cc.fillStyle='#111111'; cc.fillRect(0,0,combined.width,combined.height);
      cc.drawImage(frontCanvas,0,0); cc.drawImage(backCanvas,0,H+GAP);

      const slug=(ownerName||'id-card').replace(/\s+/g,'_').toLowerCase();
      const fileName=`${slug}_id_card.png`;
      combined.toBlob(async (blob) => {
        if (!blob) { toast.error('Failed to generate card image'); setIsDownloading(false); return; }
        const file=new File([blob],fileName,{type:'image/png'});
        const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
        if (navigator.canShare && navigator.canShare({files:[file]})) {
          try {
            await navigator.share({files:[file],title:'Owner ID Card',text:'Panruti Association ID Card'});
            toast.success('ID Card shared / saved successfully!'); setIsDownloading(false); return;
          } catch(err:any) { if(err.name==='AbortError'){setIsDownloading(false);return;} }
        }
        const blobUrl=URL.createObjectURL(blob);
        if (isIOS) {
          const w=window.open(blobUrl,'_blank'); if(!w) window.location.href=blobUrl;
          toast.success('Image opened! Press & hold to Save to Photos.');
        } else {
          const a=document.createElement('a'); a.download=fileName; a.href=blobUrl;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(()=>URL.revokeObjectURL(blobUrl),15000);
          toast.success('ID Card downloaded successfully!');
        }
        setIsDownloading(false);
      },'image/png',1.0);
    } catch(err:any) {
      console.error('Download error:',err);
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
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Live Card Preview (86 × 54 mm)</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center gap-8">
              <div id="printable-cards-wrapper" className="flex flex-col gap-8 items-center w-full">
                <div className="id-card-front" style={{ position:'relative', width:CW, height:CH, borderRadius:14, backgroundImage:`url(${cardFrontTemplate})`, backgroundSize:'cover', backgroundPosition:'center', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.55)', flexShrink:0 }}>
                  <div style={{ position:'absolute', top:81, left:11, width:88, height:108, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', zIndex:4 }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="Owner" style={{ width:'100%', height:'100%', objectFit:'cover', transform:`scale(${photoScale}) translate(${photoX}px,${photoY}px)`, transition:'transform 0.1s ease-out' }} />
                      : <User style={{ width:28, height:28, color:'#bbb' }} />}
                  </div>
                  {serialNumber && (
                    <div style={{ position:'absolute', top:60, right:14, zIndex:4 }}>
                      <span style={{ fontSize:12, color:'#FFFFFF', fontWeight:800, letterSpacing:0.5, fontFamily:'Arial, sans-serif', textShadow:'0 1px 3px rgba(0,0,0,0.5)' }}>{serialNumber}</span>
                    </div>
                  )}
                  <div style={{ position:'absolute', top:79, left:148, zIndex:4 }}>
                    <span style={{ fontSize:12, color:'white', fontWeight:500, fontFamily:'Arial, sans-serif' }}>{ownerName}</span>
                  </div>
                  <div style={{ position:'absolute', top:104, left:148, zIndex:4 }}>
                    <span style={{ fontSize:11, color:'white', fontWeight:500, fontFamily:'Arial, sans-serif' }}>{shopName}</span>
                  </div>
                  <div style={{ position:'absolute', top:128, left:98, width:44, textAlign:'right', whiteSpace:'nowrap', zIndex:4 }}>
                    <span style={{ fontSize:11, color:'white', fontWeight:500 }}>Email :</span>
                  </div>
                  <div style={{ position:'absolute', top:128, left:148, width:165, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', zIndex:4 }}>
                    <span style={{ fontSize:11, color:'white', fontWeight:500, fontFamily:'Arial, sans-serif' }}>{emailAddress}</span>
                  </div>
                  <div style={{ position:'absolute', top:151, left:105, width:60, zIndex:4 }}>
                    <img src={thalaivarSigUrl} alt="Thalaivar Sig" style={{ width:'100%', height:'auto', display:'block' }} />
                  </div>
                  <div style={{ position:'absolute', top:153, right:15, width:68, zIndex:4 }}>
                    <img src={secretarySigUrl} alt="Secretary Sig" style={{ width:'100%', height:'auto', display:'block' }} />
                  </div>
                </div>
                <div className="id-card-back" style={{ position:'relative', width:CW, height:CH, borderRadius:14, backgroundImage:`url(${cardBackTemplate})`, backgroundSize:'cover', backgroundPosition:'center', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.55)', flexShrink:0 }}>
                  <div style={{ position:'absolute', top:44, left:50, width:230, maxHeight:65, overflow:'hidden', zIndex:4 }}>
                    <div style={{ fontSize:9.5, color:'#1E469C', fontWeight:500, lineHeight:1.35, wordBreak:'normal', overflowWrap:'break-word', whiteSpace:'normal', fontFamily:'Arial, sans-serif' }}>{homeAddress}</div>
                  </div>
                  <div style={{ position:'absolute', top:109, left:45, width:86, height:16, background:'white', zIndex:3 }} />
                  <div style={{ position:'absolute', top:110, left:50, zIndex:4 }}>
                    <span style={{ fontSize:9.5, color:'#1E469C', fontWeight:700, whiteSpace:'nowrap', fontFamily:'Arial, sans-serif' }}>ஆதார் கார்டு</span>
                  </div>
                  <div style={{ position:'absolute', top:110, left:124, zIndex:4 }}>
                    <span style={{ fontSize:11, color:'#1E469C', fontWeight:700 }}>:</span>
                  </div>
                  <div style={{ position:'absolute', top:110, left:135, width:157, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', zIndex:4 }}>
                    <span style={{ fontSize:11, color:'#1E469C', fontWeight:500, fontFamily:'Arial, sans-serif' }}>{formatAadhar(aadharNumber)}</span>
                  </div>
                  <div style={{ position:'absolute', top:130, left:135, zIndex:4 }}>
                    <span style={{ fontSize:11, color:'#1E469C', fontWeight:500, fontFamily:'Arial, sans-serif' }}>{bloodGroup}</span>
                  </div>
                  <div style={{ position:'absolute', top:151, left:135, zIndex:4 }}>
                    <span style={{ fontSize:11, color:'#1E469C', fontWeight:500, fontFamily:'Arial, sans-serif' }}>{formatDob(dob)}</span>
                  </div>
                  <div style={{ position:'absolute', top:172, left:135, zIndex:4 }}>
                    <span style={{ fontSize:11, color:'#1E469C', fontWeight:500, fontFamily:'Arial, sans-serif' }}>{personalPhone}</span>
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
                    <Input placeholder="e.g. 47/2025" value={serialNumber} onChange={e=>setSerialNumber(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Owner Name</label>
                    <Input placeholder="Enter Owner Name..." value={ownerName} onChange={e=>setOwnerName(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Shop Name</label>
                    <Input placeholder="Enter Shop Name..." value={shopName} onChange={e=>setShopName(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                    <Input type="email" placeholder="Enter Email Address..." value={emailAddress} onChange={e=>setEmailAddress(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Owner Photo (Passport Size)</label>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-16 rounded-lg bg-secondary/15 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
                      {photoPreview ? <div className="w-full h-full overflow-hidden relative"><img src={photoPreview} alt="Thumb" style={{ width:'100%', height:'100%', objectFit:'cover', transform:`scale(${photoScale}) translate(${photoX}px,${photoY}px)`, transition:'transform 0.1s ease-out' }} /></div> : <User className="h-6 w-6 text-slate-500" />}
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
                    <Input placeholder="+91 9876543210" value={personalPhone} onChange={e=>setPersonalPhone(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" /> Aadhar Number</label>
                    <Input placeholder="1234 5678 9012" value={aadharNumber} onChange={e=>setAadharNumber(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date of Birth</label>
                    <Input type="date" value={dob} onChange={e=>setDob(e.target.value)} className="bg-secondary/35 border-border/80 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Droplet className="h-3.5 w-3.5" /> Blood Group</label>
                    <select value={bloodGroup} onChange={e=>setBloodGroup(e.target.value)} className="flex h-9 w-full rounded-md border border-border/80 bg-secondary/35 px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-white">
                      <option className="bg-neutral-900 text-white" value="">Select Blood Group</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g} className="bg-neutral-900 text-white" value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Home Address (Back of card)</label>
                  <textarea rows={3} placeholder="Enter your residential address..." value={homeAddress} onChange={e=>setHomeAddress(e.target.value)} className="flex w-full rounded-md border border-border/80 bg-secondary/35 px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-white resize-none" />
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
