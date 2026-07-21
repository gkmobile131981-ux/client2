import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  ArrowLeft,
  Search,
  Plus,
  X,
  Camera,
  Upload,
  Image as ImageIcon,
  Video,
  Clipboard,
  Smile,
  ShieldCheck,
  CheckCircle,
  Loader2,
  Calendar,
  Clock,
  Sparkles,
  Smartphone,
  MessageSquare,
  Eye,
  EyeOff,
  Package
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';
import SignatureCanvas from 'react-signature-canvas';
const ReactSignatureCanvas = (SignatureCanvas as any).default || SignatureCanvas;

const DEVICE_BRANDS: Record<string, string[]> = {
  'APPLE': [
    'IPHONE 5', 'IPHONE 5S', 'IPHONE SE', 'IPHONE 6', 'IPHONE 6S', 'IPHONE 6 PLUS', 'IPHONE 6S PLUS', 
    'IPHONE 7', 'IPHONE 8', 'IPHONE 7 PLUS', 'IPHONE 8 PLUS', 'IPHONE X', 'IPHONE XS', 'IPHONE XR', 
    'IPHONE XS MAX', 'IPHONE 11', 'IPHONE 11 PRO', 'IPHONE 11 PRO MAX', 'IPHONE 12', 'IPHONE 12 PRO', 
    'IPHONE 12 MINI', 'IPHONE 12 PRO MAX', 'IPHONE 6 (LOGO CUT)', 'IPHONE 6S (LOGO CUT)', 
    'IPHONE 6 PLUS (LOGO CUT)', 'IPHONE 6S PLUS (LOGO CUT)', 'IPHONE 7 (LOGO CUT)', 'IPHONE 8 (LOGO CUT)', 
    'IPHONE 7 PLUS (LOGO CUT)', 'IPHONE 8 PLUS (LOGO CUT)', 'IPHONE X (LOGO CUT)', 'IPHONE XS (LOGO CUT)', 
    'IPHONE XS MAX (LOGO CUT)', 'IPHONE XR (LOGO CUT)', 'IPHONE 13', 'IPHONE 14', 'IPHONE 15', 
    'IPHONE 15 PRO', 'IPHONE 15 PRO MAX', 'IPHONE 16E', 'IPHONE 17', 'IPHONE 17 PRO', 'IPHONE 17 PRO MAX', 
    'IPHONE 17 AIR', 'IPHONE SE (4TH GEN)', 'IPAD AIR', 'IPAD PRO'
  ],
  'SAMSUNG': [
    'SAMSUNG A30S', 'SAMSUNG A12', 'SAMSUNG A31', 'SAMSUNG A32', 'SAMSUNG A40', 'SAMSUNG A50', 
    'SAMSUNG A50S', 'SAMSUNG A51', 'SAMSUNG A70', 'SAMSUNG A70S', 'SAMSUNG A71', 'SAMSUNG A80', 
    'SAMSUNG M02', 'SAMSUNG M02S', 'SAMSUNG M10', 'SAMSUNG M10S', 'SAMSUNG M11', 'SAMSUNG M12', 
    'SAMSUNG M20', 'SAMSUNG M21', 'SAMSUNG M30', 'SAMSUNG M30S', 'SAMSUNG M31', 'SAMSUNG M31S', 
    'SAMSUNG M40', 'SAMSUNG M51', 'SAMSUNG F41', 'SAMSUNG F62', 'SAMSUNG NOTE 8', 'SAMSUNG NOTE 9', 
    'SAMSUNG NOTE 10', 'SAMSUNG NOTE 10 LITE', 'SAMSUNG NOTE 10 PRO', 'SAMSUNG NOTE 20', 'SAMSUNG S4', 
    'SAMSUNG S5', 'SAMSUNG S6', 'SAMSUNG S6 EDGE', 'SAMSUNG S6 EDGE PLUS', 'SAMSUNG S7', 'SAMSUNG S7 EDGE', 
    'SAMSUNG S8', 'SAMSUNG S8 PLUS', 'SAMSUNG S9', 'SAMSUNG S9 PLUS', 'SAMSUNG S10', 'SAMSUNG S10 PLUS', 
    'SAMSUNG S10E', 'SAMSUNG S10 LITE', 'SAMSUNG S20', 'SAMSUNG S20 PLUS', 'SAMSUNG S20 ULTRA', 
    'SAMSUNG S20 FE', 'SAMSUNG A2 CORE', 'SAMSUNG A3 2015', 'SAMSUNG A3 2016', 'SAMSUNG A3 2017', 
    'SAMSUNG A5 2015', 'SAMSUNG A5 2016', 'SAMSUNG A5 2017', 'SAMSUNG A6', 'SAMSUNG A6 PLUS', 
    'SAMSUNG A7 2015', 'SAMSUNG A7 2016', 'SAMSUNG A7 2017', 'SAMSUNG A7 2018', 'SAMSUNG A8 2015', 
    'SAMSUNG A8 PLUS', 'SAMSUNG A8 STAR', 'SAMSUNG A9 2018', 'SAMSUNG A9 PRO', 'SAMSUNG C7 PRO', 
    'SAMSUNG C9 PRO', 'SAMSUNG E5', 'SAMSUNG E7', 'SAMSUNG GRAND 2', 'SAMSUNG GRAND MAX', 
    'SAMSUNG GRAND PRIME', 'SAMSUNG J2 2015', 'SAMSUNG J2 2016', 'SAMSUNG J2 2017', 'SAMSUNG J2 2018', 
    'SAMSUNG J2 CORE', 'SAMSUNG J2 PRO', 'SAMSUNG J3 2015', 'SAMSUNG J3 2016', 'SAMSUNG J3 2017', 
    'SAMSUNG J3 PRO', 'SAMSUNG J4', 'SAMSUNG J4 PLUS', 'SAMSUNG J5 2015', 'SAMSUNG J5 2016', 
    'SAMSUNG J5 PRIME', 'SAMSUNG J5 PRO', 'SAMSUNG J6', 'SAMSUNG J6 PLUS', 'SAMSUNG J7 2015', 
    'SAMSUNG J7 2016', 'SAMSUNG J7 DUO', 'SAMSUNG J7 MAX', 'SAMSUNG J7 NXT', 'SAMSUNG J7 PLUS', 
    'SAMSUNG J7 PRIME', 'SAMSUNG J7 PRIME 2', 'SAMSUNG J7 PRO', 'SAMSUNG J8', 'SAMSUNG ON 5', 
    'SAMSUNG ON 5 PRO', 'SAMSUNG ON 6', 'SAMSUNG ON 7', 'SAMSUNG ON 7 2016', 'SAMSUNG ON 7 PRO', 
    'SAMSUNG ON 8', 'SAMSUNG ON 8 2018', 'SAMSUNG ON MAX', 'SAMSUNG ON NXT', 'SAMSUNG A10', 
    'SAMSUNG A10S', 'SAMSUNG A20', 'SAMSUNG A20S', 'SAMSUNG A21S', 'SAMSUNG A30', 'GALAXY S21', 
    'GALAXY S22', 'GALAXY S23', 'GALAXY S24', 'GALAXY S25', 'GALAXY S25+', 'GALAXY S25 ULTRA', 
    'GALAXY S25 EDGE', 'GALAXY A16', 'GALAXY A36', 'GALAXY A54', 'GALAXY A56', 'GALAXY M-SERIES', 
    'GALAXY M34', 'GALAXY Z FOLD 5', 'GALAXY Z FOLD 7', 'GALAXY Z FLIP 5', 'GALAXY Z FLIP 7'
  ],
  'ONEPLUS': [
    'ONE PLUS 2', 'ONE PLUS 3', 'ONE PLUS 3T', 'ONE PLUS 5', 'ONE PLUS 5T', 'ONE PLUS 6', 
    'ONE PLUS 6T', 'ONE PLUS 7', 'ONE PLUS 7 PRO', 'ONE PLUS 7T', 'ONE PLUS 7T PRO', 'ONE PLUS X', 
    'ONE PLUS 8', 'ONE PLUS 8 PRO', 'ONE PLUS NORD', 'ONEPLUS 10 PRO', 'ONEPLUS 11', 'ONEPLUS 12', 
    'ONEPLUS 13', 'ONEPLUS 13R', 'ONEPLUS 13T', 'ONEPLUS NORD 3', 'ONEPLUS NORD 5', 'ONEPLUS NORD CE 3 LITE', 'ONEPLUS NORD CE5'
  ],
  'GOOGLE': [
    'GOOGLE PIXEL', 'GOOGLE PIXEL 2', 'GOOGLE PIXEL 3', 'GOOGLE PIXEL 3 XL', 'GOOGLE PIXEL 3A', 
    'GOOGLE PIXEL 3A XL', 'GOOGLE PIXEL 4', 'GOOGLE PIXEL 4 XL', 'GOOGLE PIXEL XL', 'GOOGLE PIXEL XL 2',
    'PIXEL 6', 'PIXEL 7', 'PIXEL 7A', 'PIXEL 8', 'PIXEL 8 PRO', 'PIXEL 9A', 'PIXEL 10', 
    'PIXEL 10 PRO', 'PIXEL 10 PRO XL', 'PIXEL 10 PRO FOLD'
  ],
  'XIAOMI': [
    'MI 4', 'MI 4I', 'MI 5', 'MI A1', 'MI A2', 'MI A3', 'MI MAX', 'MI MAX 2', 'MI MIX 2', 
    'POCO F1', 'REDMI 1S', 'REDMI 3S', 'REDMI 3S PRIME', 'REDMI 4', 'REDMI 4A', 'REDMI 5', 
    'REDMI 5A', 'REDMI 6', 'REDMI 6 PRO', 'REDMI 6A', 'REDMI 7', 'REDMI 7A', 'REDMI 8', 
    'REDMI 8A', 'REDMI GO', 'REDMI K20', 'REDMI K20 PRO', 'REDMI K30', 'REDMI NOTE 3', 
    'REDMI NOTE 4', 'REDMI NOTE 4G / NOTE PRIME', 'REDMI NOTE 5', 'REDMI NOTE 5 PRO', 
    'REDMI NOTE 6 PRO', 'REDMI NOTE 7', 'REDMI NOTE 7 PRO', 'REDMI NOTE 7S', 'REDMI NOTE 8', 
    'REDMI NOTE 8 PRO', 'REDMI NOTE 8T', 'REDMI NOTE 9', 'REDMI NOTE 9 PRO / NOTE 9 PRO MAX / POCO M2 PRO', 
    'REDMI 9 PRIME / POCO M2', 'REDMI 9I / REDMI 9A', 'REDMI 9 / REDMI 9C', 'POCO X2', 'POCO X3', 
    'REDMI 9 POWER', 'MI 10I', 'MI 10T', 'POCO M2', 'REDMI Y1', 'REDMI Y1 LITE', 'REDMI Y2', 
    'REDMI Y3', 'REDMI NOTE 12', 'REDMI NOTE 13', 'REDMI NOTE 14 SERIES', 'REDMI 14C', 'XIAOMI 13 PRO', 
    'XIAOMI 15', 'XIAOMI 15 ULTRA', 'XIAOMI 15S PRO', 'POCO F5', 'POCO F7', 'POCO X6 PRO', 'POCO X7 SERIES'
  ],
  'OPPO': [
    'OPPO A1K', 'OPPO A37', 'OPPO A3S', 'OPPO A5', 'OPPO A5 (2020)', 'OPPO A5S', 'OPPO A57', 
    'OPPO A7', 'OPPO A71', 'OPPO A77', 'OPPO A83', 'OPPO A9', 'OPPO A9 (2020)', 'OPPO F1', 
    'OPPO F1 PLUS', 'OPPO F11', 'OPPO F11 PRO', 'OPPO F1S', 'OPPO F3', 'OPPO F3 PLUS', 'OPPO F5', 
    'OPPO F5 YOUTH', 'OPPO F7', 'OPPO F7 YOUTH', 'OPPO F9', 'OPPO F9 PRO', 'OPPO F15', 'OPPO F17', 
    'OPPO F17 PRO', 'OPPO FIND X', 'OPPO K1', 'OPPO K3', 'OPPO NEO 7', 'OPPO R17', 'OPPO R17 PRO', 
    'OPPO R7 LITE', 'OPPO RENO', 'OPPO RENO 2', 'OPPO RENO 2F', 'OPPO RENO 2Z', 'OPPO RENO 10X ZOOM', 
    'RENO 3 PRO', 'RENO 4 PRO', 'RENO 5 PRO 5G', 'OPPO A9 2020', 'OPPO A5 2020', 'OPPO A31', 
    'OPPP A12', 'OPPO A92', 'OPPO A52', 'OPPO A53', 'OPPO A15', 'OPPO A15S',
    'RENO 10', 'RENO 11', 'RENO 13 SERIES', 'FIND X9', 'FIND X9 PRO', 'FIND X9 ULTRA', 'OPPO A-SERIES', 'OPPO F23', 'OPPO A78'
  ],
  'VIVO': [
    'VIVO NEX', 'VIVO NEX A', 'VIVO S1 / Z1X', 'VIVO V1', 'VIVO V1 MAX', 'VIVO V3', 'VIVO V3 MAX', 
    'VIVO V5', 'VIVO V5 PLUS', 'VIVO V5S', 'VIVO V7', 'VIVO V7 PLUS', 'VIVO V9', 'VIVO V9 PRO', 
    'VIVO V9 YOUTH', 'VIVO V11', 'VIVO V11 PRO', 'VIVO V15', 'VIVO V15 PRO', 'VIVO V17', 
    'VIVO V17 PRO', 'VIVO V19', 'VIVO V20', 'VIVO V20 SE', 'VIVO V20 PRO', 'VIVO X21', 'VIVO X5 PRO', 
    'VIVO Y12 / Y15 / Y17 / U10', 'VIVO Y21L', 'VIVO Y51L', 'VIVO Y53', 'VIVO Y55', 'VIVO Y55L', 
    'VIVO Y55S', 'VIVO Y66', 'VIVO Y69', 'VIVO Y71', 'VIVO Y81', 'VIVO Y81I', 'VIVO Y83', 
    'VIVO Y83 PRO', 'VIVO Y90 / VIVO Y91I', 'VIVO Y91 / Y93 / Y95', 'VIVO Y97', 'VIVO Z1 PRO / Z1', 
    'VIVO Y19 / Y20 / U3', 'VIVO Y12S', 'VIVO X50 PRO', 'VIVO X50', 'VIVO S1 PRO', 'VIVO Y20S', 
    'VIVO Y20A', 'VIVO Y20 2021', 'VIVO Y20I', 'VIVO Y20 G', 'VIVO Y51 / Y31 / VIVO Y51A', 'VIVO Y20', 
    'VIVO Y30 / VIVO Y50', 'VIVO V29', 'VIVO V30', 'VIVO V-SERIES', 'VIVO T2X', 'VIVO Y200', 
    'VIVO Y-SERIES', 'X200', 'X200 PRO', 'X200 PRO+'
  ],
  'REALME': [
    'OPPO REALME 1', 'OPPO REALME 2', 'OPPO REALME 2 PRO', 'OPPO REALME 3', 'OPPO REALME 3I', 
    'OPPO REALME 3 PRO', 'OPPO REALME 5', 'OPPO REALME 5S', 'OPPO REALME 5I', 'REALME NARZO 10', 
    'REALME 6', 'REALME 6I', 'REALME 6 PRO', 'REALME 7', 'REALME 7 PRO', 'REALME 7I', 'REALME 8', 
    'REALME C1', 'REALME C2', 'REALME C3', 'REALME C11', 'REALME C12', 'REALME C15', 'REALME C17', 
    'REALME X', 'REALME X2 PRO', 'REALME XT', 'REALME X50 PRO', 'REALME X3', 'REALME X7', 
    'REALME X7 PRO', 'REALME NARZO 20 PRO', 'REALME NARZO 30 PRO', 'REALME U1',
    'REALME 11 PRO+', 'REALME 12 PRO', 'REALME 14 PRO SERIES', 'REALME C53', 'REALME C-SERIES', 'REALME NARZO 60', 'GT 7 PRO'
  ],
  'NOKIA (HMD)': [
    'NOKIA 2', 'NOKIA 2.1', 'NOKIA 3', 'NOKIA 3.1', 'NOKIA 3.2', 'NOKIA 3.1 PLUS', 'NOKIA 3310 (2017)', 
    'NOKIA 4.2', 'NOKIA 5', 'NOKIA 5.1', 'NOKIA 5.1 PLUS', 'NOKIA 6', 'NOKIA 6 2018', 'NOKIA 6.1', 
    'NOKIA 6.1 PLUS', 'NOKIA 7 PLUS', 'NOKIA 7.1', 'NOKIA 7.2', 'NOKIA 8', 'NOKIA 8 SIROCCO', 
    'NOKIA 8.1', 'NOKIA 9 PURE VIEW', 'HMD SKYLINE', 'HMD PULSE SERIES', 'NOKIA 110'
  ],
  'ASUS': [
    'ASUS ZENFONE 3S MAX', 'ASUS ZENFONE 4 SELFIE PRO', 'ASUS ZENFONE 5 LITE', 'ASUS ZENFONE 5Z', 
    'ASUS ZENFONE 6', 'ASUS ZENFONE LITE L1', 'ASUS ZENFONE MAX M1', 'ASUS ZENFONE MAX M2', 
    'ASUS ZENFONE MAX PRO M1', 'ASUS ZENFONE MAX PRO M2', 'ROG PHONE 9', 'ROG PHONE 9 PRO', 'ZENFONE 12'
  ],
  'COOLPAD': [
    'COOLPAD COOL 1', 'COOLPAD MAX', 'COOLPAD MEGA 2.5D', 'COOLPAD NOTE 5'
  ],
  'GIONEE': [
    'GIONEE A1', 'GIONEE A1 LITE', 'GIONEE ELIFE S7', 'GIONEE F103', 'GIONEE F103 PRO', 
    'GIONEE M5', 'GIONEE M5 LITE', 'GIONEE M5 PLUS', 'GIONEE S6', 'GIONEE S6 PRO', 'GIONEE S6S'
  ],
  'HONOR': [
    'HONOR 10', 'HONOR 10 LITE', 'HONOR 20', 'HONOR 20 PRO', 'HONOR 20I', 'HONOR 4C', 
    'HONOR 4X', 'HONOR 5A', 'HONOR 6', 'HONOR 6X', 'HONOR 7', 'HONOR 7A', 'HONOR 7C', 
    'HONOR 7S', 'HONOR 7X', 'HONOR 8', 'HONOR 8 PRO', 'HONOR 8A', 'HONOR 8C', 'HONOR 8X', 
    'HONOR 9 LITE', 'HONOR 9I', 'HONOR 9N', 'HONOR ENJOY 5', 'HONOR G8', 'HONOR HOLLY 2 PLUS', 
    'HONOR MAGIC 2', 'HONOR MATE 20 PRO', 'HONOR NOVA 3I', 'HONOR P10', 'HONOR P10 PLUS', 
    'HONOR P20 LITE', 'HONOR P20 PRO', 'HONOR P30 LITE', 'HONOR P30 PRO', 'HONOR P8', 'HONOR PLAY', 
    'HONOR VIEW 10', 'HONOR VIEW 20', 'HONOR Y9 2019', 'HUAWEI Y9S / 9X PRO', 'MAGIC 7', 
    'MAGIC 7 PRO', 'MAGIC V3', 'HONOR 400 SERIES', 'HONOR X-SERIES'
  ],
  'HTC': [
    'HTC ONE A9', 'HTC U ULTRA', 'HTC U11', 'HTC 10 PRO', 'HTC 728', 'HTC 816', 'HTC 820', 
    'HTC 820 G PLUS', 'HTC 825', 'HTC 826', 'HTC 828', 'HTC 830', 'HTC BOLT', 'HTC M10', 'HTC M9 PLUS'
  ],
  'INFINIX': ['INFINIX NOTE 5', 'ZERO 40 SERIES', 'NOTE 50 SERIES', 'HOT 60 SERIES', 'SMART 10 SERIES'],
  'INTEX': ['INTEX AQUA POWER PLUS'],
  'LENOVO': [
    'LENOVO A6000', 'LENOVO A6000 PLUS', 'LENOVO A6010', 'LENOVO A6010 PLUS', 'LENOVO A6600', 
    'LENOVO K3 NOTE', 'LENOVO K4 NOTE', 'LENOVO K5 NOTE', 'LENOVO K6 NOTE', 'LENOVO K6 POWER', 
    'LENOVO K8', 'LENOVO K8 NOTE', 'LENOVO K8 PLUS', 'LENOVO P1', 'LENOVO P1 MAX', 'LENOVO PHAB 2', 
    'LENOVO PHAB 2 PLUS', 'LENOVO VIBE K5', 'LENOVO VIBE K5 PLUS', 'LENOVO VIBE P2', 'LENOVO VIBE X3', 
    'LENOVO Z2 PRO', 'LENOVO ZUK Z2', 'LENOVO ZUK Z2 PLUS', 'LENOVO ZUKE Z1'
  ],
  'LETV': ['LETV 1S', 'LETV 2 MAX', 'LETV 2S'],
  'LG': [
    'LG G3', 'LG G3 BEAT', 'LG G5', 'LG G6', 'LG G7 PLUS THINQ', 'LG K10 2017', 'LG K8', 
    'LG NEXUS 5', 'LG NEXUS 5X', 'LG Q6', 'LG Q6 PLUS', 'LG Q7', 'LG X POWER'
  ],
  'MEIZU': ['MEIZU M3 NOTE', 'MEIZU 21 SERIES', 'MEIZU NOTE SERIES'],
  'MICROSOFT': ['MICROSOFT LUMIA 540'],
  'MOTO': [
    'MOTO C', 'MOTO C PLUS', 'MOTO E2', 'MOTO E3', 'MOTO E3 POWER', 'MOTO E4', 'MOTO E4 PLUS', 
    'MOTO E5', 'MOTO E5 PLUS', 'MOTO G', 'MOTO G2', 'MOTO G3', 'MOTO G4', 'MOTO G4 PLAY', 
    'MOTO G4 PLUS', 'MOTO G5', 'MOTO G5 PLUS', 'MOTO G5S', 'MOTO G5S PLUS', 'MOTO G6', 
    'MOTO G6 PLAY', 'MOTO G6 PLUS', 'MOTO G7', 'MOTO M', 'MOTO ONE POWER', 'MOTO ONE VISION', 
    'MOTO X FORCE', 'MOTO X PLAY 32 GB', 'MOTO X STYLE', 'MOTO X4', 'MOTO Z', 'MOTO Z FORCE', 
    'MOTO Z PLAY', 'MOTO Z2 PLAY'
  ],
  'HUAWEI': ['MATE 70', 'MATE 70 PRO', 'MATE X6', 'PURA 80', 'NOVA SERIES'],
  'MOTOROLA': ['EDGE 60 SERIES', 'RAZR 60', 'RAZR 60 ULTRA', 'MOTO G SERIES'],
  'NOTHING': ['PHONE (3)', 'PHONE (3A)', 'PHONE (3A) PRO', 'CMF PHONE 2 PRO'],
  'SONY': ['XPERIA 1 VII', 'XPERIA 10 VII'],
  'ZTE': ['NUBIA Z70 ULTRA', 'REDMAGIC 10 PRO', 'ZTE BLADE SERIES'],
  'TECNO': ['CAMON 40 SERIES', 'PHANTOM V FOLD2', 'SPARK 30 SERIES', 'POVA 6 SERIES'],
  'ITEL': ['S25 SERIES', 'A-SERIES'],
  'LAVA': ['BLAZE CURVE', 'YUVA SERIES', 'AGNI 3'],
  'MICROMAX': ['IN NOTE SERIES'],
  'VERTU': ['AGENT Q', 'METAVERTU 2'],
  'FAIRPHONE': ['FAIRPHONE 5'],
  'DOOGEE': ['S-SERIES (RUGGED)', 'V-SERIES (RUGGED)'],
  'ULEFONE': ['ARMOR SERIES (RUGGED)'],
  'CAT (BULLITT)': ['CAT S75'],
  'CUBOT': ['KINGKONG SERIES', 'P-SERIES'],
  'SHARP': ['AQUOS R9', 'AQUOS SENSE SERIES'],
  'TCL': ['TCL 60 SERIES', 'TCL 50 SERIES']
};

export interface DeviceOptionEntry {
  brand: string;
  model: string;
}

export function buildDeviceOptions(rateCards: DeviceOptionEntry[]) {
  const mergedBrands: Record<string, Set<string>> = {};

  Object.entries(DEVICE_BRANDS).forEach(([brand, models]) => {
    mergedBrands[brand.trim().toUpperCase()] = new Set(models.map(m => m.trim().toUpperCase()));
  });

  rateCards.forEach(({ brand, model }) => {
    const normalizedBrand = brand.trim().toUpperCase();
    const normalizedModel = model.trim().toUpperCase();
    if (!normalizedBrand || !normalizedModel) return;

    if (!mergedBrands[normalizedBrand]) {
      mergedBrands[normalizedBrand] = new Set<string>();
    }
    mergedBrands[normalizedBrand].add(normalizedModel);
  });

  const brandOptions = Object.keys(mergedBrands).sort((a, b) => a.localeCompare(b));
  const modelsByBrand = Object.fromEntries(
    brandOptions.map((brand) => [brand, Array.from(mergedBrands[brand]).sort((a, b) => a.localeCompare(b))])
  );

  return { brandOptions, modelsByBrand };
}

// ----------------------------------------------------
// Spell check and auto-correction dictionary for common mobile repair terms
const SPELL_CORRECT_MAP: Record<string, string> = {
  'SPEEKAR': 'SPEAKER',
  'SPEEKER': 'SPEAKER',
  'SPEKAR': 'SPEAKER',
  'SPKR': 'SPEAKER',
  'REPAIED': 'REPAIRED',
  'REPARIED': 'REPAIRED',
  'REPAIRD': 'REPAIRED',
  'REPAIRING': 'REPAIRED',
  'BATTRY': 'BATTERY',
  'BATTRYE': 'BATTERY',
  'BATERY': 'BATTERY',
  'CHARGNG': 'CHARGING',
  'CHARGIN': 'CHARGING',
  'CHARGINGE': 'CHARGING',
  'DISPLY': 'DISPLAY',
  'DISPALY': 'DISPLAY',
  'DESPLAY': 'DISPLAY',
  'DISP': 'DISPLAY',
  'NETWK': 'NETWORK',
  'NETWRK': 'NETWORK',
  'SOFTWAR': 'SOFTWARE',
  'SOFTWRE': 'SOFTWARE',
  'CAMRA': 'CAMERA',
  'CAMREA': 'CAMERA',
  'RECIVER': 'RECEIVER',
  'RECOVER': 'RECEIVER',
  'TOCH': 'TOUCH',
  'MOTHERBORD': 'MOTHERBOARD',
  'MOBERBOARD': 'MOTHERBOARD',
  'WATERDAMGE': 'WATER DAMAGE'
};

export function fixProblemSpelling(text: string): string {
  if (!text) return '';
  let upper = text.toUpperCase().trim();
  
  Object.entries(SPELL_CORRECT_MAP).forEach(([wrong, right]) => {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    upper = upper.replace(regex, right);
  });

  return upper;
}

const repairOrderSchema = z.object({
  status: z.enum(['pending', 'repairing', 'ready', 'delivered', 'cancelled']).default('pending'),
  customerId: z.string().optional().nullable(),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  problem: z.string().min(1, 'Problem description is required'),
  quality: z.enum(['good', 'fair', 'poor', 'damaged']).default('good'),
  physicalDamage: z.string().optional().nullable(),
  lockCode: z.string().optional().nullable(),
  patternLock: z.string().optional().nullable(),
  accessoryAdapter: z.boolean().optional().default(false),
  accessoryKeyboardMouse: z.boolean().optional().default(false),
  accessoryOther: z.boolean().optional().default(false),
  serialNumber: z.string().optional().nullable(),
  imei: z.string().optional().nullable(),
  warranty: z.string().optional().nullable(),
  estimate: z.number().positive('Estimate cost must be positive'),
  advance: z.number().nonnegative('Paid/Advance payment must be positive or zero'),
  allowCashback: z.boolean().optional().default(false),
  expense: z.number().nonnegative('Expense must be zero or positive').optional().default(0),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date').or(z.literal('')).optional().nullable(),
  staffId: z.string().uuid('Invalid staff selection').or(z.literal('')).optional().nullable(),
  notes: z.string().or(z.literal('')).optional().nullable(),
  sendWhatsapp: z.boolean().optional().default(false),
  sendEmail: z.boolean().optional().default(false),
  kycDetails: z.string().optional().nullable(),
  reminderEnable: z.boolean().optional().default(false)
}).refine((data) => data.advance <= data.estimate, {
  message: 'Paid/Advance cannot exceed estimate',
  path: ['advance']
});

type RepairOrderFormValues = z.infer<typeof repairOrderSchema>;

interface Staff {
  id: string;
  name: string;
  staff_id: string | null;
  role: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
}

export default function NewRepair() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser, role: authRole } = useAuth();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = window.location.pathname.includes('/edit') || window.location.pathname.endsWith('/edit');
  const routeCustomerId = !isEditMode ? id : undefined;
  const repairId = isEditMode ? id : undefined;

  // Modals & Popups States
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [patternLockOpen, setPatternLockOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [showLockCode, setShowLockCode] = useState(false);
  const [showPattern, setShowPattern] = useState(true);

  // Core Data States
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddr, setNewCustAddr] = useState('');
  const [nameSearchOpen, setNameSearchOpen] = useState(false);
  const [phoneInputSearchOpen, setPhoneInputSearchOpen] = useState(false);
  const [problemSearchOpen, setProblemSearchOpen] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [debouncedPhoneSearch, setDebouncedPhoneSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPhoneSearch(phoneSearch);
    }, 50);
    return () => clearTimeout(timer);
  }, [phoneSearch]);
  const [selectedServices, setSelectedServices] = useState<Array<{ service_name: string; labor_cost: number }>>([]);
  const [customProblem, setCustomProblem] = useState('');
  const [deviceImages, setDeviceImages] = useState<string[]>([]);

  // Handle selecting multiple images from Gallery
  const handleMultipleDeviceImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds 10MB limit`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setDeviceImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Handle capturing photo from Camera
  const handleCameraDeviceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error(`Photo exceeds 10MB limit`);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setDeviceImages(prev => [...prev, reader.result as string]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Remove image by index
  const removeDeviceImage = (indexToRemove: number) => {
    setDeviceImages(prev => prev.filter((_, i) => i !== indexToRemove));
  };
  // Split brand and model states
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // Date and Time Fields Displays
  const [repairDateDisplay, setRepairDateDisplay] = useState('');
  const [repairTimeDisplay, setRepairTimeDisplay] = useState('');

  // Quick Accessories Received State
  const QUICK_ACCESSORIES = [
    'SIM card',
    'Memory card',
    'Charger',
    'Cover',
    'Battery',
    'Earphones',
    'Data cable',
    'Adapter',
    'Box',
    'Other'
  ];
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [accessoryDetails, setAccessoryDetails] = useState<string>('');

  const toggleAccessoryChip = (item: string) => {
    setSelectedAccessories(prev => {
      const exists = prev.includes(item);
      const next = exists ? prev.filter(i => i !== item) : [...prev, item];

      // Sync legacy boolean fields
      setValue('accessoryAdapter', next.includes('Adapter') || next.includes('Charger'));
      setValue('accessoryKeyboardMouse', next.includes('SIM card') || next.includes('Memory card'));
      setValue('accessoryOther', next.length > 0 || accessoryDetails.trim().length > 0);

      return next;
    });
  };

  // Pattern Lock State
  const [patternNodes, setPatternNodes] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pointerCoords, setPointerCoords] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // KYC Files & Signature States
  const [kycData, setKycData] = useState<{
    idCardFront: string | null;
    idCardBack: string | null;
    mobileFront: string | null;
    mobileBack: string | null;
    customerPhoto: string | null;
    signature: string | null;
    documentNumber: string;
  }>({
    idCardFront: null,
    idCardBack: null,
    mobileFront: null,
    mobileBack: null,
    customerPhoto: null,
    signature: null,
    documentNumber: ''
  });

  const [mobileFrontFile, setMobileFrontFile] = useState<File | null>(null);
  const [mobileBackFile, setMobileBackFile] = useState<File | null>(null);

  // Signature Drawing Canvas Ref
  const sigPadRef = useRef<any>(null);

  // Form initialization
  const form = useForm<RepairOrderFormValues>({
    resolver: zodResolver(repairOrderSchema),
    defaultValues: {
      status: 'pending',
      customerId: '',
      brand: '',
      model: '',
      problem: '',
      quality: 'good',
      physicalDamage: '',
      lockCode: '',
      patternLock: '',
      accessoryAdapter: false,
      accessoryKeyboardMouse: false,
      accessoryOther: false,
      serialNumber: '',
      imei: '',
      warranty: '',
      estimate: 0,
      advance: 0,
      allowCashback: false,
      expense: 0,
      deliveryDate: '',
      staffId: '',
      notes: '',
      sendWhatsapp: true,
      sendEmail: true,
      kycDetails: '',
      reminderEnable: false
    }
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;

  // Pre-load current date and time
  useEffect(() => {
    const today = new Date();
    const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
    const formattedTime = `${String(today.getHours()).padStart(2, '0')}H:${String(today.getMinutes()).padStart(2, '0')}M:${String(today.getSeconds()).padStart(2, '0')}S`;
    setRepairDateDisplay(formattedDate);
    setRepairTimeDisplay(formattedTime);

    // Set deliveryDate in DB format YYYY-MM-DD
    const deliveryString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setValue('deliveryDate', deliveryString);
  }, [setValue]);

  // Synchronize brand search query with selectedBrand / customBrand
  useEffect(() => {
    if (selectedBrand) {
      if (selectedBrand === 'Other') {
        setBrandSearchQuery(customBrand);
      } else {
        setBrandSearchQuery(selectedBrand);
      }
    } else {
      setBrandSearchQuery('');
    }
  }, [selectedBrand, customBrand]);

  // Synchronize model search query with selectedModel / customModel
  useEffect(() => {
    if (selectedModel) {
      if (selectedModel === 'Other') {
        setModelSearchQuery(customModel);
      } else {
        setModelSearchQuery(selectedModel);
      }
    } else {
      setModelSearchQuery('');
    }
  }, [selectedModel, customModel]);

  // Close brand/model dropdown lists when clicking outside of them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const brandContainer = document.getElementById('brand-select-container');
      const modelContainer = document.getElementById('model-select-container');
      if (brandContainer && !brandContainer.contains(event.target as Node)) {
        setBrandDropdownOpen(false);
      }
      if (modelContainer && !modelContainer.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch tech staff
  const { data: staffData } = useQuery<{ staff: Staff[] }>({
    queryKey: ['staff-list'],
    queryFn: () => apiClient.get('/auth/staff'),
    enabled: authRole === 'owner'
  });

  const { data: rateCardOptionsData } = useQuery<{ rateCards: DeviceOptionEntry[] }>({
    queryKey: ['rate-card-options'],
    queryFn: () => apiClient.get('/ratecards'),
    staleTime: 5 * 60 * 1000
  });

  // Fetch past repairs to extract real stored problem descriptions and brands/models from database
  const { data: pastRepairsData } = useQuery<{ repairs: Array<{ brand?: string; model?: string; problem?: string; device?: { brand?: string; model?: string; problem?: string } }> }>({
    queryKey: ['past-repairs-problems'],
    queryFn: () => apiClient.get('/repairs?limit=500'),
    staleTime: 2 * 60 * 1000
  });

  const { brandOptions, modelsByBrand } = React.useMemo(() => {
    const rateCardsList = rateCardOptionsData?.rateCards || [];
    const pastRepairsList = pastRepairsData?.repairs || [];
    
    const combined: DeviceOptionEntry[] = [...rateCardsList];
    pastRepairsList.forEach((r: any) => {
      const b = r.brand || r.device?.brand;
      const m = r.model || r.device?.model;
      if (b && m) {
        combined.push({
          brand: b.trim().toUpperCase(),
          model: m.trim().toUpperCase()
        });
      }
    });

    return buildDeviceOptions(combined);
  }, [rateCardOptionsData, pastRepairsData]);

  // Fetch full shop customer list for instant 0ms client-side search & ranking
  const { data: allCustomersData } = useQuery<{ customers: Customer[] }>({
    queryKey: ['all-shop-customers'],
    queryFn: () => apiClient.get('/customers?limit=1000'),
    staleTime: 5 * 60 * 1000
  });

  // Autocomplete customer search backend fallback
  const { data: customersSearchData } = useQuery<{ customers: Customer[] }>({
    queryKey: ['customers-search', debouncedPhoneSearch],
    queryFn: () => apiClient.get(`/customers?search=${debouncedPhoneSearch}`),
    enabled: debouncedPhoneSearch.trim().length >= 1,
    staleTime: 60 * 1000
  });

  // Instant 0ms Smart Relevance Sorted Customer List
  const filteredCustomers = React.useMemo(() => {
    const q = phoneSearch.trim().toLowerCase();
    if (!q) return [];

    const rawList = [...(allCustomersData?.customers || []), ...(customersSearchData?.customers || [])];
    
    // Deduplicate by ID
    const uniqueMap = new Map<string, Customer>();
    rawList.forEach(c => uniqueMap.set(c.id, c));
    const list = Array.from(uniqueMap.values());

    // Filter matching name, phone, or address
    const matches = list.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.toLowerCase().includes(q) ||
      (c.address && c.address.toLowerCase().includes(q))
    );

    // Smart Relevance Sorting (Accuracy Fix):
    // 1. Name or Phone STARTS WITH query comes FIRST (e.g. 's' -> 'saerf', 'singh')
    // 2. Word in name starts with query comes SECOND
    // 3. Alphabetical order for remaining matches
    return matches.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aPhone = a.phone.toLowerCase();
      const bPhone = b.phone.toLowerCase();

      const aStartsWith = aName.startsWith(q) || aPhone.startsWith(q);
      const bStartsWith = bName.startsWith(q) || bPhone.startsWith(q);

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      const aWordStart = aName.split(/\s+/).some(w => w.startsWith(q));
      const bWordStart = bName.split(/\s+/).some(w => w.startsWith(q));

      if (aWordStart && !bWordStart) return -1;
      if (!aWordStart && bWordStart) return 1;

      return aName.localeCompare(bName);
    });
  }, [phoneSearch, allCustomersData, customersSearchData]);

  // Instant 0ms Filtered Customers by Customer Name input
  const filteredCustomersByName = React.useMemo(() => {
    const q = newCustName.trim().toLowerCase();
    if (!q) return [];

    const rawList = [...(allCustomersData?.customers || []), ...(customersSearchData?.customers || [])];
    const uniqueMap = new Map<string, Customer>();
    rawList.forEach(c => uniqueMap.set(c.id, c));
    const list = Array.from(uniqueMap.values());

    const matches = list.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.toLowerCase().includes(q)
    );

    return matches.sort((a, b) => {
      const aStartsWith = a.name.toLowerCase().startsWith(q);
      const bStartsWith = b.name.toLowerCase().startsWith(q);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [newCustName, allCustomersData, customersSearchData]);

  // Instant 0ms Filtered Customers by Customer Phone input
  const filteredCustomersByPhone = React.useMemo(() => {
    const q = newCustPhone.trim().toLowerCase();
    if (!q) return [];

    const rawList = [...(allCustomersData?.customers || []), ...(customersSearchData?.customers || [])];
    const uniqueMap = new Map<string, Customer>();
    rawList.forEach(c => uniqueMap.set(c.id, c));
    const list = Array.from(uniqueMap.values());

    const matches = list.filter(c => 
      c.phone.toLowerCase().includes(q) || 
      c.name.toLowerCase().includes(q)
    );

    return matches.sort((a, b) => {
      const aStartsWith = a.phone.toLowerCase().startsWith(q);
      const bStartsWith = b.phone.toLowerCase().startsWith(q);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [newCustPhone, allCustomersData, customersSearchData]);



  // Extract unique past problem descriptions created in the shop DB with automatic spell correction
  const existingShopProblems = React.useMemo(() => {
    const problemsSet = new Set<string>();
    (pastRepairsData?.repairs || []).forEach(r => {
      const p = r.problem || r.device?.problem;
      if (p && p.trim()) {
        p.split(',').forEach(subP => {
          const cleaned = fixProblemSpelling(subP);
          if (cleaned) problemsSet.add(cleaned);
        });
      }
    });
    return Array.from(problemsSet);
  }, [pastRepairsData]);

  // Instant 1-letter Filter from real database problem entries only
  const filteredProblems = React.useMemo(() => {
    const q = customProblem.trim().toLowerCase();
    if (!q) return existingShopProblems;

    return existingShopProblems.filter(p => p.toLowerCase().includes(q)).sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q);
      const bStarts = b.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });
  }, [customProblem, existingShopProblems]);

  // Ensure Customer Name, Phone, Address ALWAYS start EMPTY for new bookings
  useEffect(() => {
    if (!isEditMode) {
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddr('');
    }
  }, [isEditMode]);

  // Pre-load customer if ID is in URL parameters
  useEffect(() => {
    if (routeCustomerId) {
      const fetchPreSelectedCustomer = async () => {
        try {
          const res = await apiClient.get<{ customer: Customer }>(`/customers/${routeCustomerId}`);
          setSelectedCustomer(res.customer);
          setValue('customerId', res.customer.id, { shouldValidate: true });
        } catch {
          toast.error('Failed to load customer profile.');
        }
      };
      fetchPreSelectedCustomer();
    }
  }, [routeCustomerId, setValue]);

  // Fetch detailed customer profile to list their past problems and devices
  const { data: customerProfileData } = useQuery<any>({
    queryKey: ['selected-customer-profile', selectedCustomer?.id],
    queryFn: () => apiClient.get(`/customers/${selectedCustomer?.id}`),
    enabled: !!selectedCustomer?.id
  });

  // Fetch detailed repair for editing
  const { data: editRepairData, isLoading: isLoadingEditRepair } = useQuery<any>({
    queryKey: ['repair-edit-detail', repairId],
    queryFn: () => apiClient.get(`/repairs/${repairId}`),
    enabled: isEditMode && !!repairId
  });

  // Populate form with existing repair details if in edit mode
  useEffect(() => {
    if (isEditMode && editRepairData?.repair) {
      const r = editRepairData.repair;
      setSelectedCustomer(r.customer);
      setValue('customerId', r.customer?.id || '');
      setNewCustName(r.customer?.name || '');
      setNewCustPhone(r.customer?.phone || '');
      setNewCustAddr(r.customer?.address || '');

      setSelectedBrand(r.device?.brand || '');
      setBrandSearchQuery(r.device?.brand || '');
      setSelectedModel(r.device?.model || '');
      setModelSearchQuery(r.device?.model || '');
      setValue('brand', r.device?.brand || '', { shouldValidate: true });
      setValue('model', r.device?.model || '', { shouldValidate: true });
      setValue('problem', r.device?.problem || '', { shouldValidate: true });
      setValue('quality', r.device?.quality || 'good', { shouldValidate: true });
      setValue('physicalDamage', r.device?.physical_damage || '');
      setValue('lockCode', r.device?.lock_code || r.lock_code || '');
      setValue('patternLock', r.device?.pattern_lock || r.pattern_lock || '');

      setValue('serialNumber', r.device?.serial_number || r.serial_number || '');
      setValue('imei', r.device?.imei || '');
      setValue('warranty', r.device?.warranty || r.warranty || '');
      setValue('estimate', Number(r.estimate) || 0, { shouldValidate: true });
      setValue('advance', Number(r.advance) || 0, { shouldValidate: true });
      setValue('allowCashback', r.allow_cashback || false);
      setValue('expense', Number(r.expense) || 0);
      setValue('deliveryDate', r.delivery_date || '');
      setValue('staffId', r.staff_id || '');
      setValue('notes', r.notes || '');

      if (r.notes && r.notes.includes('[Accessories Received:')) {
        const match = r.notes.match(/\[Accessories Received:\s*(.*?)\]/);
        if (match && match[1]) {
          const items = match[1].split(',').map((s: string) => s.trim());
          const knownChips = items.filter((i: string) => QUICK_ACCESSORIES.includes(i));
          const customText = items.filter((i: string) => !QUICK_ACCESSORIES.includes(i)).join(', ');
          setSelectedAccessories(knownChips);
          setAccessoryDetails(customText);
        }
      }

      if (r.services) {
        setSelectedServices(r.services);
      }
      if (r.kyc_details || r.kycDetails) {
        try {
          const raw = r.kyc_details || r.kycDetails;
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          setKycData(parsed);
          if (parsed?.deviceImages && Array.isArray(parsed.deviceImages)) {
            setDeviceImages(parsed.deviceImages);
          }
        } catch (e) {
          console.error('Error parsing kyc_details:', e);
        }
      }
    }
  }, [isEditMode, editRepairData, setValue]);

  // Fetch Rate Cards based on Brand and Model
  const watchBrand = watch('brand');
  const watchModel = watch('model');
  const { data: rateCardData } = useQuery<{ rateCard: { services: Array<{ id: string; service_name: string; og_cost: number; ditto_cost: number; copy_cost: number }> } | null }>({
    queryKey: ['rate-card-lookup', watchBrand, watchModel],
    queryFn: () => apiClient.get(`/ratecards/lookup?brand=${encodeURIComponent(watchBrand)}&model=${encodeURIComponent(watchModel)}`),
    enabled: watchBrand.length > 0 && watchModel.length > 0
  });

  // Fetch Expected Sequential Job Number
  const { data: nextJobNumberData } = useQuery<{ nextJobNumber: string }>({
    queryKey: ['next-job-number'],
    queryFn: () => apiClient.get('/repairs/next-job-number'),
    staleTime: 0
  });
  const nextJobNumber = nextJobNumberData?.nextJobNumber;

  // Dynamic balance calculations
  const watchEstimate = watch('estimate');
  const watchAdvance = watch('advance');
  const outstandingBalance = Math.max(0, (Number(watchEstimate) || 0) - (Number(watchAdvance) || 0));

  // Toggle selected rate card services and update estimate price sum
  const toggleService = (svc: { service_name: string; labor_cost: number }) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.service_name === svc.service_name);
      const next = exists
        ? prev.filter((s) => s.service_name !== svc.service_name)
        : [...prev, svc];

      const total = next.reduce((sum, s) => sum + s.labor_cost, 0);
      if (total > 0) {
        setValue('estimate', total, { shouldValidate: true });
      }

      // Add to write problem description
      const serviceNames = next.map(s => s.service_name).join(', ');
      setValue('problem', serviceNames || customProblem || 'Repair diagnostics');

      return next;
    });
  };

  // Add custom problem description text to form state with deduplication & spell correction
  const handleAddCustomProblem = (textToAdd?: string) => {
    const raw = (textToAdd || customProblem).trim();
    if (!raw) return;

    const target = fixProblemSpelling(raw);
    const current = watch('problem') || '';
    const existingItems = current.split(',').map(s => fixProblemSpelling(s)).filter(Boolean);

    // Prevent duplicate entries
    if (!existingItems.some(item => item.toLowerCase() === target.toLowerCase())) {
      existingItems.push(target);
      toast.success(`Added problem: "${target}"`);
    }

    const newDesc = existingItems.join(', ');
    setValue('problem', newDesc, { shouldValidate: true });
    setCustomProblem('');
  };

  const handleRemoveProblemTag = (probToRemove: string) => {
    const current = watch('problem') || '';
    const items = current.split(',').map(s => s.trim()).filter(Boolean);
    const updated = items.filter(item => item.toLowerCase() !== probToRemove.toLowerCase());
    setValue('problem', updated.join(', '), { shouldValidate: true });
    toast.success(`Removed problem: "${probToRemove}"`);
  };

  // File Upload Helper to convert files into Base64 strings
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, key: keyof typeof kycData, isDevicePhoto: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const limit = 5 * 1024 * 1024;
    if (file.size > limit) {
      toast.error(`File size exceeds ${limit / (1024 * 1024)}MB limit`);
      return;
    }
    
    if (isDevicePhoto) {
      if (key === 'mobileFront') setMobileFrontFile(file);
      if (key === 'mobileBack') setMobileBackFile(file);
    }

    setUploadProgress(prev => ({ ...prev, [key]: 10 }));

    const reader = new FileReader();
    reader.onloadend = () => {
      let progress = 10;
      const interval = setInterval(() => {
        progress += 30;
        if (progress >= 100) {
          clearInterval(interval);
          setUploadProgress(prev => ({ ...prev, [key]: 100 }));
          setKycData(prev => ({
            ...prev,
            [key]: reader.result as string
          }));
          toast.success(`${key} captured successfully!`);
          setTimeout(() => {
            setUploadProgress(prev => {
              const updated = { ...prev };
              delete updated[key];
              return updated;
            });
          }, 800);
        } else {
          setUploadProgress(prev => ({ ...prev, [key]: progress }));
        }
      }, 100);
    };
    reader.readAsDataURL(file);
  };

  // Signature Canvas Drawing Logic
  const saveSignature = () => {
    if (!sigPadRef.current) return;
    const canvas = sigPadRef.current.getTrimmedCanvas();
    const base64Sig = canvas.toDataURL('image/png');
    setKycData(prev => ({ ...prev, signature: base64Sig }));
    setSignatureOpen(false);
    toast.success('Signature saved successfully');
  };

  const clearSignature = () => {
    sigPadRef.current?.clear();
  };

  // Brand & Model Selection Handlers
  const handleSelectBrand = (brandName: string) => {
    setSelectedBrand(brandName);
    setBrandSearchQuery(brandName);
    setValue('brand', brandName, { shouldValidate: true });
    setBrandDropdownOpen(false);
  };

  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName);
    setModelSearchQuery(modelName);
    setValue('model', modelName, { shouldValidate: true });
    setModelDropdownOpen(false);
  };



  // Pattern Lock Grid dragging handlers
  const handlePointerDownPattern = (node: number) => {
    setIsDrawing(true);
    setPatternNodes([node]);
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const handlePointerMovePattern = (e: React.PointerEvent) => {
    if (!isDrawing || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Clamp to boundaries of w-60 h-60 (240x240 pixels)
    const clampedX = Math.max(0, Math.min(240, x));
    const clampedY = Math.max(0, Math.min(240, y));
    setPointerCoords({ x: clampedX, y: clampedY });

    // Hit test 3x3 nodes
    for (let n = 1; n <= 9; n++) {
      const row = Math.floor((n - 1) / 3);
      const col = (n - 1) % 3;
      const cx = 40 + col * 80;
      const cy = 40 + row * 80;
      
      const dist = Math.hypot(clampedX - cx, clampedY - cy);
      // Nodes are 48px wide, so let's use 28px hit test radius
      if (dist < 28) {
        setPatternNodes((prev) => {
          if (prev.includes(n)) return prev;
          const next = [...prev, n];
          if (navigator.vibrate) {
            navigator.vibrate(20);
          }
          return next;
        });
      }
    }
  };

  const handleSavePatternLock = () => {
    const code = patternNodes.join('-');
    setValue('patternLock', code);
    setPatternLockOpen(false);
    toast.success(`Pattern Lock code recorded: ${code}`);
  };

  // Create Inline Customer Submission
  const registerCustomerInline = async () => {
    if (!newCustName || !newCustPhone) {
      toast.error('Please fill in Name and Phone number');
      return;
    }
    try {
      const res = await apiClient.post<{ customer: Customer }>('/customers', {
        name: newCustName,
        phone: newCustPhone,
        address: newCustAddr
      });
      setSelectedCustomer(res.customer);
      setValue('customerId', res.customer.id, { shouldValidate: true });
      setNewCustomerOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddr('');
      toast.success('Customer registered successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to register customer');
    }
  };

  // Main Submit Mutation
  const createRepairMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.post<{ repair: { id: string; job_number: string } }>('/repairs', formData),
    onSuccess: (data) => {
      toast.success(`Repair Order Job #${data.repair.job_number} created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['repairs-list'] });
      queryClient.invalidateQueries({ queryKey: ['next-job-number'] });
      navigate(`/repairs/${data.repair.id}`);
    },
    onError: (err: any) => {
      let msg = err.message || 'Failed to submit repair order ticket.';
      if (err.details && Array.isArray(err.details)) {
        const detailMsgs = err.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ');
        msg = `Validation failed: ${detailMsgs}`;
      }
      toast.error(msg);
    }
  });

  const updateRepairMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.put<{ repair: { id: string; job_number: string } }>(`/repairs/${repairId}`, formData),
    onSuccess: (data) => {
      toast.success(`Repair Order Job #${data.repair.job_number} updated successfully!`);
      queryClient.invalidateQueries({ queryKey: ['repairs-list'] });
      queryClient.invalidateQueries({ queryKey: ['repair-detail', repairId] });
      navigate(`/repairs/${data.repair.id}`);
    },
    onError: (err: any) => {
      let msg = err.message || 'Failed to update repair order ticket.';
      if (err.details && Array.isArray(err.details)) {
        const detailMsgs = err.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ');
        msg = `Validation failed: ${detailMsgs}`;
      }
      toast.error(msg);
    }
  });

  const onFormSubmit = async (values: RepairOrderFormValues) => {
    let finalCustomerId = values.customerId || selectedCustomer?.id;

    // Auto register customer if name and phone are filled and no customerId is set
    if (!finalCustomerId) {
      if (!newCustName.trim() || !newCustPhone.trim()) {
        toast.error('Please select an existing customer or enter Name & Phone for a new customer.');
        return;
      }

      try {
        const res = await apiClient.post<{ customer: Customer }>('/customers', {
          name: newCustName.trim(),
          phone: newCustPhone.trim(),
          address: newCustAddr.trim()
        });
        setSelectedCustomer(res.customer);
        finalCustomerId = res.customer.id;
        toast.success('Customer registered successfully!');
      } catch (err: any) {
        toast.error(err.message || 'Failed to auto-register customer');
        return;
      }
    }

    const formData = new FormData();
    const finalBrand = values.brand || brandSearchQuery.trim();
    const finalModel = values.model || modelSearchQuery.trim();
    formData.append('brand', finalBrand);
    formData.append('model', finalModel);
    let finalProblem = values.problem || '';
    if (customProblem.trim()) {
      const target = fixProblemSpelling(customProblem.trim());
      const existingItems = finalProblem.split(',').map(s => fixProblemSpelling(s)).filter(Boolean);
      if (!existingItems.some(item => item.toLowerCase() === target.toLowerCase())) {
        existingItems.push(target);
      }
      finalProblem = existingItems.join(', ');
    }
    formData.append('problem', finalProblem);
    formData.append('quality', values.quality);
    if (values.status) formData.append('status', values.status);
    if (values.physicalDamage) formData.append('physicalDamage', values.physicalDamage);
    if (values.lockCode) formData.append('lockCode', values.lockCode);
    if (values.patternLock) formData.append('patternLock', values.patternLock);
    
    // Combine accessory chips + custom description
    const accParts = [...selectedAccessories];
    if (accessoryDetails.trim() && !accParts.includes(accessoryDetails.trim())) {
      accParts.push(accessoryDetails.trim());
    }
    const accSummary = accParts.join(', ');

    const hasAdapter = selectedAccessories.includes('Adapter') || selectedAccessories.includes('Charger');
    const hasKeyboardSim = selectedAccessories.includes('SIM card') || selectedAccessories.includes('Memory card');
    const hasOther = accParts.length > 0;

    formData.append('accessoryAdapter', String(hasAdapter));
    formData.append('accessoryKeyboardMouse', String(hasKeyboardSim));
    formData.append('accessoryOther', String(hasOther));

    if (values.serialNumber) formData.append('serialNumber', values.serialNumber);
    if (values.imei) formData.append('imei', values.imei);
    if (values.warranty) formData.append('warranty', values.warranty);

    formData.append('estimate', String(values.estimate));
    formData.append('advance', String(values.advance));
    formData.append('allowCashback', String(values.allowCashback));
    formData.append('expense', String(values.expense));

    if (values.deliveryDate) formData.append('deliveryDate', values.deliveryDate);
    
    const finalStaffId = authRole === 'owner' ? values.staffId : authUser?.id;
    if (finalStaffId) formData.append('staffId', finalStaffId);

    // Combine accessory summary into notes
    let userNotes = values.notes || '';
    if (accSummary) {
      userNotes = userNotes.replace(/\[Accessories Received:.*?\]/g, '').trim();
      const finalNotes = userNotes 
        ? `${userNotes} | [Accessories Received: ${accSummary}]`
        : `[Accessories Received: ${accSummary}]`;
      formData.append('notes', finalNotes);
    } else if (userNotes) {
      formData.append('notes', userNotes);
    }
    formData.append('sendWhatsapp', String(values.sendWhatsapp));
    formData.append('sendEmail', String(values.sendEmail));
    if (nextJobNumber) {
      formData.append('jobNumber', nextJobNumber);
    }
    
    // Store KYC JSON with Device Images
    const finalKyc = {
      ...kycData,
      deviceImages,
      documentNumber: kycData.documentNumber
    };
    formData.append('kycDetails', JSON.stringify(finalKyc));

    // Upload Files
    if (mobileFrontFile) formData.append('frontPhoto', mobileFrontFile);
    if (mobileBackFile) formData.append('backPhoto', mobileBackFile);

    if (selectedServices.length > 0) {
      formData.append('services', JSON.stringify(selectedServices));
    }

    if (isEditMode) {
      updateRepairMutation.mutate(formData);
    } else {
      createRepairMutation.mutate(formData);
    }
  };

  const renderUploadCard = (
    label: string,
    key: keyof typeof kycData,
    icon: React.ReactNode,
    fileInputProps: { accept: string; capture?: 'environment' | 'user' }
  ) => {
    const value = kycData[key];
    const progress = uploadProgress[key];
    const isUploading = progress !== undefined;

    return (
      <div className="flex flex-col h-56 bg-card/60 border border-border/80 rounded-2xl overflow-hidden group hover:border-primary/50 transition-all duration-300 relative shadow-md">
        {/* Header Label */}
        <div className="bg-secondary/20 border-b border-border/60 py-2.5 px-4 flex items-center justify-between">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{label}</span>
          {value && (
            <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
              <CheckCircle className="h-3.5 w-3.5" /> Ready
            </span>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col justify-center items-center relative p-4">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="absolute text-[10px] font-black text-foreground">{progress}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider animate-pulse">Uploading file...</span>
            </div>
          ) : value ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center group/preview">
              <img src={value} className="h-full w-full object-cover" alt={label} />
              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/80 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                {key === 'signature' ? (
                  <button
                    type="button"
                    onClick={() => setSignatureOpen(true)}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md transition-all active:scale-[0.98]"
                  >
                    Replace
                  </button>
                ) : (
                  <label className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md transition-all active:scale-[0.98] cursor-pointer">
                    Replace
                    <input
                      type="file"
                      {...fileInputProps}
                      onChange={(e) => handleFileUpload(e, key, key === 'mobileFront' || key === 'mobileBack')}
                      className="hidden"
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setKycData(prev => ({ ...prev, [key]: null }));
                    if (key === 'mobileFront') setMobileFrontFile(null);
                    if (key === 'mobileBack') setMobileBackFile(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md transition-all active:scale-[0.98]"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full w-full flex flex-col justify-center items-center">
              {key === 'signature' ? (
                <div
                  onClick={() => setSignatureOpen(true)}
                  className="w-full h-full border border-dashed border-border/80 rounded-xl flex flex-col justify-center items-center cursor-pointer hover:border-primary/50 hover:bg-secondary/10 transition-colors"
                >
                  {icon}
                  <span className="text-[10px] text-white font-black uppercase tracking-wider mt-2">Sign Canvas</span>
                </div>
              ) : (
                <label className="w-full h-full border border-dashed border-border/80 rounded-xl flex flex-col justify-center items-center cursor-pointer hover:border-primary/50 hover:bg-secondary/10 transition-colors">
                  {icon}
                  <span className="text-[10px] text-white font-black uppercase tracking-wider mt-2">Upload Photo</span>
                  <input
                    type="file"
                    {...fileInputProps}
                    onChange={(e) => handleFileUpload(e, key, key === 'mobileFront' || key === 'mobileBack')}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full pb-16 bg-background rounded-3xl overflow-hidden shadow-2xl border border-border/85 light text-foreground">
      {/* Modern Glassmorphic Mesh Banner Header */}
      <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-r from-violet-950 via-slate-900 to-purple-950 p-6 sm:p-8 border-b border-white/10 shadow-2xl">
        {/* Glowing Decorative Ambient Backdrop */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate('/repairs')}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/15 transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              title="Go back to Repairs List"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/25 text-primary-foreground border border-primary/40 backdrop-blur-md">
                  TERMINAL v2.5
                </span>
                <span className="flex items-center text-[10px] font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1" />
                  LIVE DB ACTIVE
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase mt-1 drop-shadow-md">
                {isEditMode ? 'Modify Booking Details' : 'Create New Booking'}
              </h1>
              <p className="text-white/70 text-xs sm:text-sm font-medium mt-0.5">
                {isEditMode ? 'Update diagnostics and repair items' : '⚡ High-speed repair ticket logging & diagnostics portal'}
              </p>
            </div>
          </div>

          {(isEditMode ? editRepairData?.repair?.job_number : nextJobNumber) && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-2.5 rounded-2xl shadow-xl flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <div className="text-left sm:text-right">
                <span className="text-[10px] text-white/70 block uppercase font-bold tracking-wider">
                  {isEditMode ? 'Billing ID' : 'Billing ID (Generated)'}
                </span>
                <span className="font-mono text-base sm:text-lg font-black text-white tracking-wider">
                  {isEditMode ? editRepairData.repair.job_number : nextJobNumber}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white/10 text-white/90">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Form — SINGLE UNIFIED FULL CONTAINER */}
      <form onSubmit={handleSubmit(onFormSubmit)} className="p-4 sm:p-8 space-y-8 divide-y divide-border/40">
        {/* Dummy hidden fields to trap Chrome Password Manager / Autofill */}
        <input type="text" name="chrome_prevent_autofill_email" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
        <input type="password" name="chrome_prevent_autofill_pass" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
        
        {/* SECTION 1: ORDER STATUS & QUICK SEARCH */}
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Order Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span>⚡</span>
                <span>Order Status</span>
              </label>
              <select
                {...register('status')}
                className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-bold uppercase cursor-pointer transition-all shadow-sm min-h-[44px]"
              >
                <option value="pending" className="bg-card text-foreground font-bold py-2">😊 PENDING</option>
                <option value="repairing" className="bg-card text-foreground font-bold py-2">🔧 REPAIRING</option>
                <option value="ready" className="bg-card text-foreground font-bold py-2">✅ READY</option>
                <option value="delivered" className="bg-card text-foreground font-bold py-2">📦 DELIVERED (FULLY PAID)</option>
                <option value="delivered_pending_balance" className="bg-card text-foreground font-bold py-2">⚠️ DELIVERED (PENDING BALANCE)</option>
                <option value="cancelled" className="bg-card text-foreground font-bold py-2">❌ CANCELLED</option>
              </select>
            </div>

            {/* Customer Details Search */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span>🔍</span>
                <span>Quick Customer Search</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search customer name or phone..."
                  value={phoneSearch}
                  onChange={(e) => {
                    setPhoneSearch(e.target.value);
                    setCustomerSearchOpen(true);
                  }}
                  className="w-full pl-9 pr-3 py-3 bg-secondary/35 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 text-foreground font-semibold transition-all shadow-sm min-h-[44px]"
                />
              </div>
              {/* Dropdown autocomplete results */}
              {customerSearchOpen && phoneSearch.trim().length >= 1 && (
                <div className="absolute z-30 left-0 right-0 bg-neutral-900 border border-primary/40 rounded-xl divide-y divide-border/40 overflow-hidden shadow-2xl max-h-52 overflow-y-auto mt-1">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((cust) => (
                      <button
                        type="button"
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setValue('customerId', cust.id, { shouldValidate: true });
                          setNewCustName(cust.name);
                          setNewCustPhone(cust.phone);
                          setNewCustAddr(cust.address || '');
                          setPhoneSearch('');
                          setCustomerSearchOpen(false);
                        }}
                        className="w-full p-3 text-left hover:bg-primary/25 hover:text-white cursor-pointer flex justify-between items-center gap-3 transition-colors"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">{cust.name}</div>
                          <div className="text-xs text-white/70 font-mono">{cust.phone}</div>
                        </div>
                        <span className="text-[10px] uppercase font-black text-primary bg-primary/20 px-2 py-1 rounded-md">Select</span>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No match — fill in details below to register.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: CUSTOMER DETAILS */}
        <div className="space-y-4 pt-6">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">👤</span>
              <span className="text-sm font-extrabold text-foreground uppercase tracking-wider">Customer Details</span>
            </div>
            {selectedCustomer && (
              <span className="flex items-center gap-1.5 text-[10px] font-black text-primary bg-primary/15 border border-primary/30 px-3 py-1 rounded-xl shadow-sm">
                ✓ {selectedCustomer.name}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setValue('customerId', '');
                    setNewCustName('');
                    setNewCustPhone('');
                    setNewCustAddr('');
                  }}
                  className="ml-1 text-red-400 hover:text-red-600 font-extrabold cursor-pointer"
                >✕</button>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Customer Name */}
            <div className="space-y-1 relative">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">Customer Name</label>
              <input
                type="text"
                id="customer_full_name_no_autofill_v2"
                name="customer_full_name_no_autofill_v2"
                placeholder="e.g. Jane Doe"
                value={newCustName}
                autoComplete="off"
                readOnly
                onFocus={(e) => {
                  e.target.removeAttribute('readonly');
                  setNameSearchOpen(true);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes('@')) {
                    setNewCustName('');
                    return;
                  }
                  setNewCustName(val);
                  setNameSearchOpen(true);
                  if (selectedCustomer) { setSelectedCustomer(null); setValue('customerId', ''); }
                }}
                className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-semibold transition-all shadow-sm min-h-[44px]"
              />
              {/* Instant 1-letter Customer Name Autocomplete */}
              {nameSearchOpen && newCustName.trim().length >= 1 && (
                <div className="absolute z-30 left-0 right-0 bg-neutral-900 border border-primary/40 rounded-xl divide-y divide-border/40 overflow-hidden shadow-2xl max-h-48 overflow-y-auto mt-1">
                  {filteredCustomersByName.length > 0 ? (
                    filteredCustomersByName.map((cust) => (
                      <button
                        type="button"
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setValue('customerId', cust.id, { shouldValidate: true });
                          setNewCustName(cust.name);
                          setNewCustPhone(cust.phone);
                          setNewCustAddr(cust.address || '');
                          setNameSearchOpen(false);
                        }}
                        className="w-full p-3 text-left hover:bg-primary/25 hover:text-white cursor-pointer flex justify-between items-center gap-2 transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{cust.name}</div>
                          <div className="text-[10px] text-white/70 font-mono">{cust.phone}</div>
                        </div>
                        <span className="text-[9px] uppercase font-black text-primary bg-primary/20 px-2 py-1 rounded-md">SELECT</span>
                      </button>
                    ))
                  ) : (
                    <div className="p-2 text-center text-[10px] text-muted-foreground">
                      New Customer: "{newCustName}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1 relative">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">Phone Number</label>
              <input
                type="text"
                id="customer_phone_no_autofill"
                name="customer_phone_no_autofill"
                placeholder="e.g. +91 99999 88888"
                value={newCustPhone}
                autoComplete="off"
                onChange={(e) => {
                  setNewCustPhone(e.target.value);
                  setPhoneInputSearchOpen(true);
                  if (selectedCustomer) { setSelectedCustomer(null); setValue('customerId', ''); }
                }}
                onFocus={() => setPhoneInputSearchOpen(true)}
                className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-semibold transition-all shadow-sm min-h-[44px]"
              />
              {/* Instant 1-letter Phone Autocomplete */}
              {phoneInputSearchOpen && newCustPhone.trim().length >= 1 && (
                <div className="absolute z-30 left-0 right-0 bg-neutral-900 border border-primary/40 rounded-xl divide-y divide-border/40 overflow-hidden shadow-2xl max-h-48 overflow-y-auto mt-1">
                  {filteredCustomersByPhone.length > 0 ? (
                    filteredCustomersByPhone.map((cust) => (
                      <button
                        type="button"
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setValue('customerId', cust.id, { shouldValidate: true });
                          setNewCustName(cust.name);
                          setNewCustPhone(cust.phone);
                          setNewCustAddr(cust.address || '');
                          setPhoneInputSearchOpen(false);
                        }}
                        className="w-full p-3 text-left hover:bg-primary/25 hover:text-white cursor-pointer flex justify-between items-center gap-2 transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{cust.phone}</div>
                          <div className="text-[10px] text-white/70">{cust.name}</div>
                        </div>
                        <span className="text-[9px] uppercase font-black text-primary bg-primary/20 px-2 py-1 rounded-md">SELECT</span>
                      </button>
                    ))
                  ) : (
                    <div className="p-2 text-center text-[10px] text-muted-foreground">
                      New Phone: "{newCustPhone}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Address */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">Address</label>
              <input
                type="text"
                placeholder="e.g. New Delhi"
                value={newCustAddr}
                autoComplete="off"
                onChange={(e) => setNewCustAddr(e.target.value)}
                className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-semibold transition-all shadow-sm min-h-[44px]"
              />
            </div>

            {/* Inline Device Images (Optional) Upload Section */}
            <div className="space-y-2 pt-3 border-t border-border/40">
              <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider block flex items-center gap-1.5">
                <span>🖼️</span>
                <span>Device Images (Optional)</span>
              </label>
              <div className="border border-border/80 rounded-2xl p-4 bg-secondary/15 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Upload className="h-4 w-4 text-primary" />
                  <span>Upload device images</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Gallery Button */}
                  <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border bg-card hover:bg-secondary/60 cursor-pointer font-extrabold text-xs text-foreground transition-all shadow-sm active:scale-95 min-h-[44px]">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <span>Gallery</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleMultipleDeviceImagesUpload}
                      className="hidden"
                    />
                  </label>

                  {/* Camera Button */}
                  <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border bg-card hover:bg-secondary/60 cursor-pointer font-extrabold text-xs text-foreground transition-all shadow-sm active:scale-95 min-h-[44px]">
                    <Camera className="h-4 w-4 text-primary" />
                    <span>Camera</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraDeviceImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Horizontal Scrollable/Grid Thumbnails preview with Red ✕ Delete Badge */}
                {deviceImages.length > 0 && (
                  <div className="flex items-center gap-3 overflow-x-auto pt-2 pb-1 pr-2">
                    {deviceImages.map((imgUrl, idx) => (
                      <div key={idx} className="relative group shrink-0 h-20 w-20 rounded-xl overflow-hidden border border-border shadow-md bg-black/20">
                        <img src={imgUrl} alt={`Device photo ${idx + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeDeviceImage(idx)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-[10px] font-black shadow-lg transition-transform active:scale-90"
                          title="Remove image"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {errors.customerId && (
            <p className="text-[11px] text-red-500 font-semibold">{errors.customerId.message}</p>
          )}
        </div>

        {/* SECTION 3: DEVICE & PROBLEM SPECIFICATION */}
        <div className="space-y-4 pt-6">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <span className="text-base">📱</span>
            <span className="text-sm font-extrabold text-foreground uppercase tracking-wider">Device & Problem Specification</span>
          </div>

          {/* Brand & Model Selectors */}
          {(() => {
            const filteredBrands = brandOptions.filter(b => 
              b.toLowerCase().includes(brandSearchQuery.toLowerCase())
            );

            const availableModels = selectedBrand && selectedBrand !== 'Other' 
              ? (modelsByBrand[selectedBrand.toUpperCase()] || []) 
              : [];

            const filteredModels = availableModels.filter(m => 
              m.toLowerCase().includes(modelSearchQuery.toLowerCase())
            );

            return (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Brand Select */}
                  <div className="space-y-1 relative" id="brand-select-container">
                    <label className="text-xs font-semibold text-muted-foreground">Device Brand</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search or Type Brand..."
                        value={brandSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setBrandSearchQuery(val);
                          setValue('brand', val, { shouldValidate: true });
                          setSelectedBrand(val);
                          setBrandDropdownOpen(true);
                        }}
                        onFocus={() => {
                          setBrandDropdownOpen(true);
                          setModelDropdownOpen(false);
                        }}
                        className="w-full bg-secondary/35 border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-bold uppercase text-foreground transition-all shadow-sm min-h-[44px]"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <Search className="h-4 w-4" />
                      </div>
                    </div>
                    {brandDropdownOpen && (brandSearchQuery.trim().length >= 1 || brandOptions.length > 0) && (
                      <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-neutral-900 border border-border rounded-xl shadow-2xl divide-y divide-border/20 scrollbar-thin">
                        {filteredBrands.length > 0 && (
                          filteredBrands.map((b) => (
                            <div
                              key={b}
                              onClick={() => handleSelectBrand(b)}
                              className="px-4 py-2.5 hover:bg-primary/25 hover:text-white cursor-pointer text-xs font-bold uppercase text-white/90 flex items-center justify-between"
                            >
                              <span>📱 {b}</span>
                              <span className="text-[10px] text-primary uppercase font-bold">SELECT</span>
                            </div>
                          ))
                        )}
                        {/* Inline Create New Brand Option if not matching existing brand */}
                        {brandSearchQuery.trim() && !brandOptions.some(b => b.toLowerCase() === brandSearchQuery.trim().toLowerCase()) && (
                          <div
                            onClick={() => handleSelectBrand(brandSearchQuery.trim())}
                            className="px-4 py-2.5 bg-primary/10 hover:bg-primary/25 cursor-pointer text-xs font-extrabold text-primary flex items-center justify-between border-t border-primary/30"
                          >
                            <span>➕ Use brand: "{brandSearchQuery.trim()}"</span>
                            <span className="text-[10px] uppercase tracking-wider font-black">ADD</span>
                          </div>
                        )}
                      </div>
                    )}
                    {errors.brand && (
                      <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.brand.message}</p>
                    )}
                  </div>

                  {/* Model Select */}
                  <div className="space-y-1 relative" id="model-select-container">
                    <label className="text-xs font-semibold text-muted-foreground">Device Model</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search or Type Model..."
                        value={modelSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setModelSearchQuery(val);
                          setValue('model', val, { shouldValidate: true });
                          setSelectedModel(val);
                          setModelDropdownOpen(true);
                        }}
                        onFocus={() => {
                          setModelDropdownOpen(true);
                          setBrandDropdownOpen(false);
                        }}
                        className="w-full bg-secondary/35 border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-bold uppercase text-foreground transition-all shadow-sm min-h-[44px]"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <Search className="h-4 w-4" />
                      </div>
                    </div>
                    {modelDropdownOpen && (modelSearchQuery.trim().length >= 1 || availableModels.length > 0) && (
                      <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-neutral-900 border border-border rounded-xl shadow-2xl divide-y divide-border/20 scrollbar-thin">
                        {filteredModels.length > 0 && (
                          filteredModels.map((m) => (
                            <div
                              key={m}
                              onClick={() => handleSelectModel(m)}
                              className="px-4 py-2.5 hover:bg-primary/25 hover:text-white cursor-pointer text-xs font-bold uppercase text-white/90 flex items-center justify-between"
                            >
                              <span>🔧 {m}</span>
                              <span className="text-[10px] text-primary uppercase font-bold">SELECT</span>
                            </div>
                          ))
                        )}
                        {/* Inline Create New Model Option if not matching existing model */}
                        {modelSearchQuery.trim() && !availableModels.some(m => m.toLowerCase() === modelSearchQuery.trim().toLowerCase()) && (
                          <div
                            onClick={() => handleSelectModel(modelSearchQuery.trim())}
                            className="px-4 py-2.5 bg-primary/10 hover:bg-primary/25 cursor-pointer text-xs font-extrabold text-primary flex items-center justify-between border-t border-primary/30"
                          >
                            <span>➕ Use model: "{modelSearchQuery.trim()}"</span>
                            <span className="text-[10px] uppercase tracking-wider font-black">ADD</span>
                          </div>
                        )}
                      </div>
                    )}
                    {errors.model && (
                      <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.model.message}</p>
                    )}
                  </div>
                </div>

                <input type="hidden" {...register('brand')} />
                <input type="hidden" {...register('model')} />
              </div>
            );
          })()}

          {/* Problem description with 1-letter Autocomplete & Add Button */}
          <div className="relative space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Write Problem Description..."
                value={customProblem}
                onChange={(e) => {
                  setCustomProblem(e.target.value.toUpperCase());
                  setProblemSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomProblem();
                    setProblemSearchOpen(false);
                  }
                }}
                onFocus={() => setProblemSearchOpen(true)}
                className="flex-1 bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-bold uppercase transition-all shadow-sm min-h-[44px]"
              />
              <Button
                type="button"
                onClick={() => {
                  handleAddCustomProblem();
                  setProblemSearchOpen(false);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold uppercase text-xs px-5 shrink-0 rounded-xl shadow-md cursor-pointer min-h-[44px]"
              >
                ADD
              </Button>
            </div>

            {/* Instant 1-Letter Problem Description Autocomplete Dropdown */}
            {problemSearchOpen && customProblem.trim().length >= 1 && (
              <div className="absolute z-40 left-0 right-16 bg-neutral-900 border border-primary/40 rounded-xl divide-y divide-border/40 overflow-hidden shadow-2xl max-h-56 overflow-y-auto mt-1">
                {filteredProblems.length > 0 && (
                  filteredProblems.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => {
                        handleAddCustomProblem(item);
                        setProblemSearchOpen(false);
                      }}
                      className="w-full p-2.5 text-left hover:bg-primary/25 hover:text-white cursor-pointer flex justify-between items-center text-xs font-semibold text-white/90 transition-colors"
                    >
                      <span>🔧 {item}</span>
                      <span className="text-[10px] text-primary uppercase font-bold bg-primary/20 px-2 py-0.5 rounded-md">SELECT +</span>
                    </button>
                  ))
                )}
                {/* Create New Problem Option */}
                <button
                  type="button"
                  onClick={() => {
                    handleAddCustomProblem();
                    setProblemSearchOpen(false);
                  }}
                  className="w-full p-2.5 text-left bg-primary/10 hover:bg-primary/25 cursor-pointer flex justify-between items-center text-xs font-extrabold text-primary border-t border-primary/30"
                >
                  <span>➕ Create new problem: "{customProblem}"</span>
                  <span className="text-[10px] uppercase tracking-wider font-black">ADD</span>
                </button>
              </div>
            )}

            {/* Visual Selected Problems List Chips */}
            {watch('problem') && watch('problem').trim().length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest block w-full">Selected Problems List:</span>
                {watch('problem').split(',').map(s => s.trim()).filter(Boolean).map((prob, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-primary/15 text-primary border border-primary/35 shadow-sm"
                  >
                    <span>🔧 {prob}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveProblemTag(prob)}
                      className="text-red-400 hover:text-red-500 font-black ml-1 text-xs cursor-pointer p-0.5 rounded hover:bg-red-500/20"
                      title="Remove problem"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <input type="hidden" {...register('problem')} />
          {errors.problem && (
            <p className="text-[11px] text-red-500 font-semibold">{errors.problem.message}</p>
          )}

          {/* Rate Card Autocomplete Services List */}
          {rateCardData?.rateCard?.services && rateCardData.rateCard.services.length > 0 && (
            <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-black text-primary/95 uppercase tracking-widest block">Quick Rate Card Services</span>
              <div className="space-y-3">
                {rateCardData.rateCard.services.map((svc: any) => {
                  const ogName = `${svc.service_name} (OG)`;
                  const copyName = `${svc.service_name} (Copy)`;
                  const dittoName = `${svc.service_name} (Ditto)`;
                  const isOgSelected = selectedServices.some(s => s.service_name === ogName);
                  const isCopySelected = selectedServices.some(s => s.service_name === copyName);
                  const isDittoSelected = selectedServices.some(s => s.service_name === dittoName);

                  return (
                    <div key={svc.id} className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-2.5 rounded-lg bg-secondary/20 border border-border/40">
                      <span className="text-xs font-bold text-foreground">{svc.service_name}</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleService({ service_name: ogName, labor_cost: svc.og_cost ?? 0 })}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-extrabold transition-all flex items-center gap-1.5 ${
                            isOgSelected
                              ? 'bg-primary text-white border-transparent shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                              : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/50'
                          }`}
                        >
                          <span>OG: ₹{svc.og_cost ?? 0}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleService({ service_name: copyName, labor_cost: svc.copy_cost ?? 0 })}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-extrabold transition-all flex items-center gap-1.5 ${
                            isCopySelected
                              ? 'bg-rose-600 text-white border-transparent shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                              : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground hover:border-rose-500/50'
                          }`}
                        >
                          <span translate="no" className="notranslate">Copy: ₹{svc.copy_cost ?? 0}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleService({ service_name: dittoName, labor_cost: svc.ditto_cost ?? 0 })}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-extrabold transition-all flex items-center gap-1.5 ${
                            isDittoSelected
                              ? 'bg-amber-600 text-white border-transparent shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                              : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground hover:border-amber-500/50'
                          }`}
                        >
                          <span translate="no" className="notranslate">Ditto: ₹{svc.ditto_cost ?? 0}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: ACCESSORY RECEIVED */}
        <div className="space-y-4 pt-6">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <Package className="h-5 w-5 text-purple-500" />
            <span className="text-sm font-extrabold text-foreground uppercase tracking-wider">📦 ACCESSORY RECEIVED</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACCESSORIES.map((item) => {
              const isSelected = selectedAccessories.includes(item);
              return (
                <button
                  type="button"
                  key={item}
                  onClick={() => toggleAccessoryChip(item)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[40px] ${
                    isSelected
                      ? 'bg-gradient-to-r from-primary to-purple-600 text-white shadow-md shadow-primary/20 scale-105 border border-primary/40'
                      : 'bg-secondary/40 border border-border/70 text-foreground/80 hover:bg-secondary/70 hover:text-foreground'
                  }`}
                >
                  <span>{isSelected ? '✓ ' : ''}{item}</span>
                </button>
              );
            })}
          </div>

          {/* Additional Accessory details text box */}
          <textarea
            placeholder="Add details about received accessories (e.g., color, brand, physical condition)..."
            value={accessoryDetails}
            onChange={(e) => setAccessoryDetails(e.target.value)}
            rows={2}
            className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-medium resize-none shadow-sm"
          />
        </div>

        {/* SECTION 5: SECURITY LOCK & PASSCODE */}
        <div className="space-y-4 pt-6">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <span className="text-base">🔒</span>
            <span className="text-sm font-extrabold text-foreground uppercase tracking-wider">Security Lock & Passcode</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-bold text-primary uppercase tracking-wider block">Lock Code (optional)</label>
              <div className="relative">
                <Input
                  type={showLockCode ? 'text' : 'password'}
                  placeholder="PIN / Password"
                  {...register('lockCode')}
                  className="pr-10 bg-secondary/35 border-border rounded-xl py-3 text-sm font-bold text-foreground min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowLockCode(!showLockCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                  title={showLockCode ? 'Hide password' : 'Show password'}
                >
                  {showLockCode ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setPatternLockOpen(true)}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 py-3 rounded-xl font-extrabold uppercase tracking-wider text-xs min-h-[44px] shadow-sm cursor-pointer"
            >
              {watch('patternLock') ? '✓ EDIT PATTERN LOCK' : '➕ PATTERN LOCK'}
            </Button>
          </div>

          {watch('patternLock') && (
            <div className="flex flex-col items-center gap-3 p-4 bg-primary/10 rounded-2xl border border-primary/25 relative">
              <button
                type="button"
                onClick={() => setShowPattern(!showPattern)}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                title={showPattern ? 'Hide pattern preview' : 'Show pattern preview'}
              >
                {showPattern ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>

              <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center pr-6">
                Selected Pattern Lock Preview
              </div>
              
              {/* Visual Mini Grid Preview */}
              <div className="relative w-24 h-24 bg-secondary/15 rounded-xl border border-border/80 p-2 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {showPattern && (() => {
                    const nodes = (watch('patternLock') || '').split('-').map(Number);
                    return nodes.map((node, index) => {
                      if (index === 0) return null;
                      const prevNode = nodes[index - 1];
                      const getMiniCoords = (n: number) => {
                        const r = Math.floor((n - 1) / 3);
                        const c = (n - 1) % 3;
                        return { x: 16 + c * 32, y: 16 + r * 32 };
                      };
                      const p1 = getMiniCoords(prevNode);
                      const p2 = getMiniCoords(node);
                      return (
                        <line
                          key={index}
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          className="stroke-primary"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                      );
                    });
                  })()}
                  
                  {/* Visual nodes dots */}
                  {Array.from({ length: 9 }).map((_, idx) => {
                    const n = idx + 1;
                    const nodes = (watch('patternLock') || '').split('-').map(Number);
                    const isSelected = showPattern && nodes.includes(n);
                    const r = Math.floor((n - 1) / 3);
                    const c = (n - 1) % 3;
                    const x = 16 + c * 32;
                    const y = 16 + r * 32;
                    return (
                      <circle
                        key={n}
                        cx={x}
                        cy={y}
                        r={isSelected ? 4 : 2}
                        className={isSelected ? "fill-primary" : "fill-muted-foreground/35"}
                      />
                    );
                  })}
                </svg>
              </div>
              
              <div className="text-xs font-mono text-center text-primary/95">
                Sequence: <span className="font-extrabold text-foreground">{showPattern ? watch('patternLock') : '••••••••'}</span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 6: FINANCIALS & REPAIR ESTIMATE */}
        <div className="space-y-4 pt-6">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <span className="text-base">💳</span>
            <span className="text-sm font-extrabold text-foreground uppercase tracking-wider">Financials & Repair Estimate</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-primary uppercase tracking-wider block">Estimated Price (₹)</label>
              <Input
                type="number"
                placeholder="0.00"
                {...register('estimate', { valueAsNumber: true })}
                className={`bg-secondary/35 border-border rounded-xl px-4 py-3 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/30 transition-all min-h-[44px] ${errors.estimate ? 'border-red-500' : ''}`}
              />
              {errors.estimate && (
                <p className="text-[11px] text-red-500 font-semibold">{errors.estimate.message}</p>
              )}
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-emerald-500 uppercase tracking-wider block">Paid (Advance ₹)</label>
              <Input
                type="number"
                placeholder="0.00"
                {...register('advance', { valueAsNumber: true })}
                className={`bg-secondary/35 border-border rounded-xl px-4 py-3 text-sm font-bold text-foreground focus:ring-2 focus:ring-emerald-500/30 transition-all min-h-[44px] ${errors.advance ? 'border-red-500' : ''}`}
              />
              {errors.advance && (
                <p className="text-[11px] text-red-500 font-semibold">{errors.advance.message}</p>
              )}
            </div>
          </div>

          {/* Balances Display Banner */}
          <div className="p-4 bg-secondary/30 border border-border/80 rounded-2xl flex items-center justify-between shadow-inner">
            <div>
              <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider block">Remaining Balance</span>
              <div className="text-2xl sm:text-3xl font-black text-primary mt-0.5">₹{outstandingBalance.toFixed(2)}</div>
            </div>
            <span className="text-xs text-muted-foreground font-medium italic">Balance = Estimate - Paid</span>
          </div>
        </div>

        {/* SECTION 7: REPAIR DATE, TIME & REMINDER */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-6">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Current repair date</span>
            <div className="text-sm font-bold text-foreground">{repairDateDisplay || 'Loading...'}</div>
            <Button
              type="button"
              onClick={() => {
                const today = new Date();
                setRepairDateDisplay(`${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`);
                toast.success('Repair date initialized');
              }}
              className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-[10px] font-bold uppercase py-1 px-3 h-7 mt-1.5 cursor-pointer"
            >
              REPAIR DATE
            </Button>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Current repair time</span>
            <div className="text-sm font-bold text-foreground">{repairTimeDisplay || 'Loading...'}</div>
            <Button
              type="button"
              onClick={() => {
                const today = new Date();
                setRepairTimeDisplay(`${String(today.getHours()).padStart(2, '0')}H:${String(today.getMinutes()).padStart(2, '0')}M:${String(today.getSeconds()).padStart(2, '0')}S`);
                toast.success('Repair time timestamped');
              }}
              className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-[10px] font-bold uppercase py-1 px-3 h-7 mt-1.5 cursor-pointer"
            >
              REPAIR TIME
            </Button>
          </div>

          <div className="col-span-1 sm:col-span-2 pt-3 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs text-foreground font-semibold">Reminder Enable?</span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('reminderEnable')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        {/* SECTION 8: SERIAL NUMBER, IMEI & TECHNICIAN */}
        <div className="space-y-4 pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Serial Number (OPTIONAL)"
                {...register('serialNumber')}
                className="flex-1 bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold min-h-[44px]"
              />
              <Button
                type="button"
                onClick={() => toast.success('Mock barcode scanner triggered')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold uppercase text-xs px-4 rounded-xl cursor-pointer min-h-[44px]"
              >
                SCAN
              </Button>
            </div>
            
            <input
              type="text"
              placeholder="IMEI number (OPTIONAL)"
              {...register('imei')}
              className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold min-h-[44px]"
            />
          </div>

          {authRole === 'owner' ? (
            <div className="space-y-1">
              <label className="text-xs font-bold text-primary uppercase tracking-wider block">Assign Technician</label>
              <select
                {...register('staffId')}
                className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-bold cursor-pointer min-h-[44px]"
              >
                <option value="" className="bg-card text-foreground font-bold">Unassigned (Default)</option>
                {staffData?.staff.map((s) => (
                  <option key={s.id} value={s.id} className="bg-card text-foreground font-bold">{s.name} ({s.staff_id || 'owner'})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-secondary/25 border border-border/80 rounded-xl">
              <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Assigned Staff</span>
              <span className="text-xs font-semibold text-foreground">{authUser?.name} (You)</span>
            </div>
          )}
        </div>

        {/* SECTION 9: MESSAGING & CASHBACK SWITCHES */}
        <div className="space-y-3 pt-6">
          {/* Whatsapp Switch */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-emerald-400" />
              <span className="text-xs text-foreground/95 font-semibold">Send Whatsapp Message ?</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('sendWhatsapp')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Email Switch */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-blue-400" />
              <span className="text-xs text-foreground/95 font-semibold">Send Email To Customer ?</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('sendEmail')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Cashback Switch */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-amber-400" />
              <span className="text-xs text-foreground/95 font-semibold">Allow 10% cashback for this order ?</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('allowCashback')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        {/* SECTION 10: ADDITIONAL DETAILS & WARRANTY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
          <textarea
            placeholder="Additional details (Optional)"
            {...register('notes')}
            rows={3}
            className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold resize-none"
          />
          <textarea
            placeholder="Device Warranty (Optional)"
            {...register('warranty')}
            rows={3}
            className="w-full bg-secondary/35 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-semibold resize-none"
          />
        </div>

        {/* SECTION 11: VIBRANT GRADIENT SUBMIT BUTTON BAR — CREATE BOOKING */}
        <div className="pt-8 flex items-center justify-end">
          <Button
            type="submit"
            disabled={createRepairMutation.isPending || updateRepairMutation.isPending}
            className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white font-black uppercase text-sm tracking-wider shadow-xl shadow-primary/25 hover:shadow-primary/40 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 min-h-[48px]"
          >
            {(createRepairMutation.isPending || updateRepairMutation.isPending) ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{isEditMode ? 'UPDATING BOOKING...' : 'CREATING BOOKING...'}</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                <span>{isEditMode ? 'UPDATE BOOKING' : 'CREATE BOOKING'}</span>
              </>
            )}
          </Button>
        </div>

      </form>


      {signatureOpen && (
        <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center p-3 light text-foreground">
          <div className="bg-card border border-border w-[92%] sm:w-full max-w-sm rounded-2xl p-4 sm:p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest text-center border-b border-border/60 pb-2">
              Draw Signature on Screen
            </h3>
            
            <div className="relative border border-border/80 rounded-xl overflow-hidden bg-white h-44">
              <span className="absolute top-2 left-2 text-[10px] uppercase font-bold text-slate-400 select-none bg-slate-100/60 px-1.5 py-0.5 rounded z-10">
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

            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearSignature}
                className="flex-1 bg-secondary/55 hover:bg-secondary/75 text-foreground py-2.5 rounded-xl text-xs font-bold uppercase"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={saveSignature}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-xl text-xs font-bold uppercase"
              >
                Save
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => setSignatureOpen(false)}
              className="w-full text-center text-xs text-muted-foreground uppercase font-bold tracking-wider hover:text-primary mt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {patternLockOpen && (
        <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center p-3 light text-foreground">
          <div className="bg-card border border-border w-[92%] sm:w-full max-w-xs rounded-2xl p-4 sm:p-5 space-y-5 shadow-2xl relative text-center">
            <h3 className="text-sm font-bold text-primary uppercase tracking-widest border-b border-border/60 pb-2">
              Draw Pattern Lock
            </h3>
            <p className="text-[10px] text-muted-foreground italic">Drag across nodes sequentially to draw pattern</p>

            {/* Visual SVG connecting lines */}
            <div 
              ref={gridRef}
              className="relative w-60 h-60 mx-auto bg-secondary/10 rounded-2xl p-4 border border-border touch-none select-none cursor-crosshair"
              onPointerMove={handlePointerMovePattern}
              onPointerUp={() => {
                setIsDrawing(false);
                setPointerCoords(null);
              }}
              onPointerLeave={() => {
                setIsDrawing(false);
                setPointerCoords(null);
              }}
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Connected nodes lines */}
                {patternNodes.map((node, index) => {
                  if (index === 0) return null;
                  const prevNode = patternNodes[index - 1];
                  const getCoords = (n: number) => {
                    const row = Math.floor((n - 1) / 3);
                    const col = (n - 1) % 3;
                    return { x: 40 + col * 80, y: 40 + row * 80 };
                  };
                  const p1 = getCoords(prevNode);
                  const p2 = getCoords(node);
                  
                  return (
                    <line
                      key={index}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      className="stroke-primary"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  );
                })}
                {/* Active line to cursor */}
                {isDrawing && patternNodes.length > 0 && pointerCoords && (
                  (() => {
                    const lastNode = patternNodes[patternNodes.length - 1];
                    const getCoords = (n: number) => {
                      const row = Math.floor((n - 1) / 3);
                      const col = (n - 1) % 3;
                      return { x: 40 + col * 80, y: 40 + row * 80 };
                    };
                    const p1 = getCoords(lastNode);
                    return (
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={pointerCoords.x}
                        y2={pointerCoords.y}
                        className="stroke-primary/60"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray="4 4"
                      />
                    );
                  })()
                )}
              </svg>

              {/* Grid Nodes */}
              <div className="grid grid-cols-3 gap-6 h-full relative z-10">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                  const isSelected = patternNodes.includes(n);
                  const selectedIndex = patternNodes.indexOf(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onPointerDown={() => handlePointerDownPattern(n)}
                      className={`flex items-center justify-center rounded-full w-12 h-12 text-sm font-black transition-all pointer-events-auto ${
                        isSelected
                          ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/35 border-2 border-white/20'
                          : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border/40'
                      }`}
                    >
                      {isSelected ? selectedIndex + 1 : n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Sequence Output Text */}
            <div className="text-xs font-mono text-muted-foreground">
              Sequence: <span className="font-bold text-white">{patternNodes.join('-') || '(Empty)'}</span>
            </div>

            {/* Pattern Lock Action Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPatternNodes([])}
                className="flex-1 bg-secondary/55 hover:bg-secondary/75 text-foreground py-2.5 rounded-xl text-xs font-bold uppercase"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSavePatternLock}
                className="flex-1 bg-primary hover:bg-primary/95 text-white py-2.5 rounded-xl text-xs font-bold uppercase"
              >
                Save
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setPatternNodes([]);
                setPatternLockOpen(false);
              }}
              className="text-xs text-muted-foreground uppercase font-black tracking-widest hover:text-primary pt-2 border-t border-border/40 block w-full text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
