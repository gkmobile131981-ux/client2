import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Save, Loader2, Edit3, X, Smartphone, Upload, ImageIcon, Search
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient } from '../lib/api';
import toast from 'react-hot-toast';

interface RateCardService {
  id?: string;
  service_name: string;
  og_cost: number;
  ditto_cost: number;
  copy_cost: number;
  sort_order: number;
}

interface RateCard {
  id: string;
  brand: string;
  model: string;
  model_image_url: string | null;
  services: RateCardService[];
}

const DEVICE_BRANDS: Record<string, string[]> = {
  'APPLE': [
    'IPHONE 5', 'IPHONE 5S', 'IPHONE SE', 'IPHONE 6', 'IPHONE 6S', 'IPHONE 6 PLUS', 'IPHONE 6S PLUS', 
    'IPHONE 7', 'IPHONE 8', 'IPHONE 7 PLUS', 'IPHONE 8 PLUS', 'IPHONE X', 'IPHONE XS', 'IPHONE XR', 
    'IPHONE XS MAX', 'IPHONE 11', 'IPHONE 11 PRO', 'IPHONE 11 PRO MAX', 'IPHONE 12', 'IPHONE 12 PRO', 
    'IPHONE 12 MINI', 'IPHONE 12 PRO MAX', 'IPHONE 6 (LOGO CUT)', 'IPHONE 6S (LOGO CUT)', 
    'IPHONE 6 PLUS (LOGO CUT)', 'IPHONE 6S PLUS (LOGO CUT)', 'IPHONE 7 (LOGO CUT)', 'IPHONE 8 (LOGO CUT)', 
    'IPHONE XS MAX', 'IPHONE XR', 'IPHONE XS MAX (LOGO CUT)', 'IPHONE XR (LOGO CUT)', 'IPHONE 13', 'IPHONE 14', 'IPHONE 15', 
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

const DEFAULT_SERVICES: RateCardService[] = [
  { service_name: 'Display Replacement', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 0 },
  { service_name: 'Battery Replacement', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 1 },
  { service_name: 'Charging Port Repair', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 2 },
  { service_name: 'Speaker Replacement', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 3 },
  { service_name: 'Microphone Repair', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 4 },
  { service_name: 'Back Cover Replacement', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 5 },
  { service_name: 'Camera Repair', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 6 },
  { service_name: 'Button / Switch Repair', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 7 },
  { service_name: 'Software / Flash', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 8 },
  { service_name: 'Water Damage Treatment', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: 9 },
];

const getBrandLogoUrl = (brand: string) => {
  const name = brand.toLowerCase().trim();
  if (name.includes('apple') || name.includes('iphone')) return 'https://cdn.simpleicons.org/apple/currentColor';
  if (name.includes('samsung')) return 'https://cdn.simpleicons.org/samsung/1428A0';
  if (name.includes('google') || name.includes('pixel')) return 'https://cdn.simpleicons.org/google/4285F4';
  if (name.includes('oneplus')) return 'https://cdn.simpleicons.org/oneplus/F50F20';
  if (name.includes('xiaomi') || name.includes('redmi') || name.includes('poco')) return 'https://cdn.simpleicons.org/xiaomi/FF6700';
  if (name.includes('oppo')) return 'https://cdn.simpleicons.org/oppo/008148';
  if (name.includes('vivo')) return 'https://cdn.simpleicons.org/vivo/415FFF';
  if (name.includes('realme')) return 'https://cdn.simpleicons.org/realme/FFC900';
  if (name.includes('huawei')) return 'https://cdn.simpleicons.org/huawei/FF0000';
  if (name.includes('motorola') || name.includes('moto')) return 'https://cdn.simpleicons.org/motorola/001438';
  return null;
};

export default function RateCards() {
  const queryClient = useQueryClient();
  const [selectedCard, setSelectedCard] = useState<RateCard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [editServices, setEditServices] = useState<RateCardService[]>([]);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery<{ rateCards: RateCard[] }>({
    queryKey: ['rate-cards'],
    queryFn: () => apiClient.get('/ratecards'),
  });

  // Merged rate cards list (DB entries + Virtual options from static catalog)
  const allRateCards = useMemo(() => {
    const dbCards = data?.rateCards || [];
    const cardsMap = new Map<string, RateCard>();
    
    // 1. Add all DB rate cards first
    dbCards.forEach((rc) => {
      const key = `${rc.brand.toUpperCase()}:${rc.model.toUpperCase()}`;
      cardsMap.set(key, rc);
    });
    
    // 2. Add all static catalog models as virtual rate cards (if not already in DB)
    Object.entries(DEVICE_BRANDS).forEach(([brand, models]) => {
      models.forEach((model) => {
        const key = `${brand.toUpperCase()}:${model.toUpperCase()}`;
        if (!cardsMap.has(key)) {
          cardsMap.set(key, {
            id: `virtual-${brand}-${model}`,
            brand: brand,
            model: model,
            model_image_url: null,
            services: []
          });
        }
      });
    });
    
    return Array.from(cardsMap.values());
  }, [data?.rateCards]);

  const filteredRateCards = allRateCards.filter((card: RateCard) =>
    card.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => apiClient.post<{ message: string, rateCard: RateCard }>('/ratecards', formData),
    onSuccess: (resData) => {
      toast.success('Rate card created!');
      setIsCreating(false);
      setNewBrand('');
      setNewModel('');
      setSelectedBrand('');
      setSelectedModel('');
      setCustomBrand('');
      setCustomModel('');
      setNewImageFile(null);
      
      if (resData?.rateCard) {
        handleSelectCard(resData.rateCard);
      }
      
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create rate card'),
  });

  const saveServicesMutation = useMutation({
    mutationFn: ({ id, services }: { id: string; services: RateCardService[] }) =>
      apiClient.post(`/ratecards/${id}/services`, { services }),
    onSuccess: () => {
      toast.success('Services saved!');
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save services'),
  });

  const updateImageMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      apiClient.put<{ message: string; rateCard: RateCard }>(`/ratecards/${id}`, formData),
    onSuccess: (resData) => {
      toast.success('Rate card updated!');
      setEditImageFile(null);
      if (resData?.rateCard) {
        setSelectedCard((prev) => (prev ? { ...prev, ...resData.rateCard } : null));
      }
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update rate card'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/ratecards/${id}`),
    onSuccess: () => {
      toast.success('Rate card deleted');
      setSelectedCard(null);
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete rate card'),
  });

  const handleSelectCard = (card: RateCard) => {
    setSelectedCard(card);
    setEditBrand(card.brand);
    setEditModel(card.model);
    // Populate services editor — use card's existing services or defaults
    if (card.services && card.services.length > 0) {
      setEditServices(card.services.map((s, i) => ({ 
        ...s, 
        og_cost: s.og_cost ?? (s as any).labor_cost ?? 0,
        ditto_cost: s.ditto_cost ?? (s as any).labor_cost ?? 0,
        copy_cost: s.copy_cost ?? (s as any).labor_cost ?? 0,
        sort_order: i 
      })));
    } else {
      setEditServices(DEFAULT_SERVICES.map((s) => ({ ...s })));
    }
    setEditImageFile(null);
  };

  const handleCreateCard = () => {
    const finalBrand = selectedBrand === 'Other' ? customBrand.trim() : selectedBrand.trim();
    const finalModel = (selectedBrand === 'Other' || selectedModel === 'Other') ? customModel.trim() : selectedModel.trim();

    if (!finalBrand || !finalModel) {
      toast.error('Brand and model are required');
      return;
    }
    const fd = new FormData();
    fd.append('brand', finalBrand);
    fd.append('model', finalModel);
    if (newImageFile) fd.append('modelImage', newImageFile);
    createMutation.mutate(fd);
  };

  const handleSaveServices = () => {
    if (!selectedCard) return;
    const validServices = editServices.filter((s) => s.service_name.trim());

    if (selectedCard.id.startsWith('virtual-')) {
      const fd = new FormData();
      fd.append('brand', selectedCard.brand);
      fd.append('model', selectedCard.model);
      if (editImageFile) fd.append('modelImage', editImageFile);

      createMutation.mutate(fd, {
        onSuccess: (resData) => {
          if (resData?.rateCard) {
            saveServicesMutation.mutate({ id: resData.rateCard.id, services: validServices });
          }
        }
      });
    } else {
      saveServicesMutation.mutate({ id: selectedCard.id, services: validServices });

      if (editImageFile || editBrand !== selectedCard.brand || editModel !== selectedCard.model) {
        const fd = new FormData();
        if (editImageFile) fd.append('modelImage', editImageFile);
        fd.append('brand', editBrand);
        fd.append('model', editModel);
        updateImageMutation.mutate({ id: selectedCard.id, formData: fd });
      }
    }
  };

  const updateServiceRow = (idx: number, field: 'service_name' | 'og_cost' | 'ditto_cost' | 'copy_cost', value: string | number) => {
    setEditServices((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const addServiceRow = () => {
    setEditServices((prev) => [
      ...prev,
      { service_name: '', og_cost: 0, ditto_cost: 0, copy_cost: 0, sort_order: prev.length },
    ]);
  };

  const removeServiceRow = (idx: number) => {
    setEditServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalOgLabor = editServices.reduce((sum, s) => sum + Number(s.og_cost || 0), 0);
  const totalDittoLabor = editServices.reduce((sum, s) => sum + Number(s.ditto_cost || 0), 0);
  const totalCopyLabor = editServices.reduce((sum, s) => sum + Number(s.copy_cost || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full text-foreground">
      {/* LEFT PANEL: Rate Card List */}
      <div className="w-full lg:w-72 xl:w-80 space-y-4 flex-shrink-0 block">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Device Models</h3>
          <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Model
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search brand or model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 bg-card border-border/60 text-sm"
          />
        </div>

        {/* Create New Card Form */}
        {isCreating && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-bold text-primary uppercase tracking-wider">New Rate Card</p>
              {(() => {
                const brandList = Object.keys(DEVICE_BRANDS);
                const filteredBrands = brandList.filter(b => 
                  b.toLowerCase().includes(brandSearchQuery.toLowerCase())
                );

                const availableModels = selectedBrand && selectedBrand !== 'Other' 
                  ? (DEVICE_BRANDS[selectedBrand] || []) 
                  : [];

                const filteredModels = availableModels.filter(m => 
                  m.toLowerCase().includes(modelSearchQuery.toLowerCase())
                );

                return (
                  <>
                    {/* Brand select */}
                    <div className="space-y-1 relative" id="brand-select-container">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search or Select Brand..."
                          value={brandSearchQuery}
                          onChange={(e) => {
                            setBrandSearchQuery(e.target.value);
                            setBrandDropdownOpen(true);
                            const typed = e.target.value;
                            const exactMatch = brandList.find(b => b.toLowerCase() === typed.toLowerCase());
                            if (exactMatch) {
                              setSelectedBrand(exactMatch);
                              setSelectedModel('');
                              setCustomBrand('');
                              setCustomModel('');
                            } else {
                              setSelectedBrand('Other');
                              setCustomBrand(typed);
                              setSelectedModel('');
                              setCustomModel('');
                            }
                          }}
                          onFocus={() => {
                            setBrandDropdownOpen(true);
                            setModelDropdownOpen(false);
                          }}
                          className="w-full bg-secondary/35 border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground select-custom"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                          <Search className="h-4 w-4" />
                        </div>
                      </div>
                      {brandDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-neutral-900 border border-border rounded-xl shadow-lg scrollbar-thin">
                          <div 
                            onClick={() => {
                              setSelectedBrand('Other');
                              setBrandSearchQuery('Other');
                              setSelectedModel('');
                              setCustomBrand('');
                              setCustomModel('');
                              setBrandDropdownOpen(false);
                            }}
                            className="px-4 py-2 hover:bg-primary/25 hover:text-white cursor-pointer text-sm font-semibold text-white/90 border-b border-border/20"
                          >
                            Other (Custom Brand)
                          </div>
                          {filteredBrands.length > 0 ? (
                            filteredBrands.map((b) => (
                              <div
                                key={b}
                                onClick={() => {
                                  setSelectedBrand(b);
                                  setBrandSearchQuery(b);
                                  setSelectedModel('');
                                  setCustomBrand('');
                                  setCustomModel('');
                                  setBrandDropdownOpen(false);
                                }}
                                className="px-4 py-2 hover:bg-primary/25 hover:text-white cursor-pointer text-sm font-semibold text-white/90"
                              >
                                {b}
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-xs text-muted-foreground">
                              No matching brand. Type to specify custom brand.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Model select */}
                    {selectedBrand && selectedBrand !== 'Other' && (
                      <div className="space-y-1 relative" id="model-select-container">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search or Select Model..."
                            value={modelSearchQuery}
                            onChange={(e) => {
                              setModelSearchQuery(e.target.value);
                              setModelDropdownOpen(true);
                              const typed = e.target.value;
                              const exactMatch = availableModels.find(m => m.toLowerCase() === typed.toLowerCase());
                              if (exactMatch) {
                                setSelectedModel(exactMatch);
                                setCustomModel('');
                              } else {
                                setSelectedModel('Other');
                                setCustomModel(typed);
                              }
                            }}
                            onFocus={() => {
                              setModelDropdownOpen(true);
                              setBrandDropdownOpen(false);
                            }}
                            className="w-full bg-secondary/35 border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground select-custom"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                            <Search className="h-4 w-4" />
                          </div>
                        </div>
                        {modelDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-neutral-900 border border-border rounded-xl shadow-lg scrollbar-thin">
                            <div 
                              onClick={() => {
                                setSelectedModel('Other');
                                setModelSearchQuery('Other');
                                setCustomModel('');
                                setModelDropdownOpen(false);
                              }}
                              className="px-4 py-2 hover:bg-primary/25 hover:text-white cursor-pointer text-sm font-semibold text-white/90 border-b border-border/20"
                            >
                              Other (Custom Model)
                            </div>
                            {filteredModels.length > 0 ? (
                              filteredModels.map((m) => (
                                <div
                                  key={m}
                                  onClick={() => {
                                    setSelectedModel(m);
                                    setModelSearchQuery(m);
                                    setCustomModel('');
                                    setModelDropdownOpen(false);
                                  }}
                                  className="px-4 py-2 hover:bg-primary/25 hover:text-white cursor-pointer text-sm font-semibold text-white/90"
                                >
                                  {m}
                                </div>
                              ))
                            ) : (
                              <div className="px-4 py-2 text-xs text-muted-foreground">
                                No matching model. Type to specify custom model.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              {(selectedBrand === 'Other' || selectedModel === 'Other') && (
                <Input
                  placeholder="Model (e.g. G54)"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="uppercase font-semibold text-foreground"
                />
              )}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold uppercase">Device Image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
                  className="text-xs text-muted-foreground cursor-pointer w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-secondary file:text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateCard}
                  disabled={createMutation.isPending}
                  className="flex-1 gap-1 h-8"
                >
                  {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewBrand('');
                    setNewModel('');
                    setSelectedBrand('');
                    setSelectedModel('');
                    setCustomBrand('');
                    setCustomModel('');
                    setNewImageFile(null);
                  }}
                  className="h-8"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rate Card List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (data?.rateCards || []).length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <Smartphone className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No device models added yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filteredRateCards.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No devices match your search.</p>
            ) : (
              filteredRateCards.map((card: RateCard) => (
              <button
                key={card.id}
                onClick={() => handleSelectCard(card)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  selectedCard?.id === card.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/60 bg-card/30 hover:bg-secondary/20 text-muted-foreground'
                }`}
              >
                {card.model_image_url ? (
                  <img src={card.model_image_url} alt={card.model} className="h-10 w-10 rounded-lg object-cover flex-shrink-0 border border-border" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0 border border-border">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{card.model}</p>
                  <p className="text-[10px] text-muted-foreground">{card.brand} · {card.services?.length || 0} services</p>
                </div>
              </button>
            )))}
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Service Editor */}
      <div className="flex-1 w-full block">
        {!selectedCard ? (
          <div className="flex flex-col items-center justify-center h-full py-24 text-center border border-dashed border-border rounded-xl">
            <Edit3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground">Select a device model</h3>
            <p className="text-xs text-muted-foreground mt-1">Choose from the left panel to edit its service rates</p>
          </div>
        ) : (
          <Card className="h-full">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Brand Photo / Logo */}
                  <div className="h-16 w-16 rounded-2xl bg-secondary/35 border border-border flex items-center justify-center p-3.5 shrink-0 shadow-inner">
                    {getBrandLogoUrl(selectedCard.brand) ? (
                      <img 
                        src={getBrandLogoUrl(selectedCard.brand)!} 
                        alt={selectedCard.brand} 
                        className="max-h-full max-w-full object-contain dark:invert-0" 
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-sm font-black text-primary uppercase tracking-tight">
                        {selectedCard.brand.substring(0, 2)}
                      </span>
                    )}
                  </div>

                  {/* Device / Model Image */}
                  <div className="relative group shrink-0">
                    <div className="h-16 w-20 rounded-2xl overflow-hidden bg-secondary/50 border border-border flex items-center justify-center">
                      {editImageFile ? (
                        <img src={URL.createObjectURL(editImageFile)} alt="Preview" className="h-full w-full object-cover" />
                      ) : selectedCard.model_image_url ? (
                        <img src={selectedCard.model_image_url} alt={selectedCard.model} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer">
                      <Upload className="h-5 w-5 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setEditImageFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>

                  <div className="space-y-1">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Input
                        placeholder="Brand"
                        value={editBrand}
                        onChange={(e) => setEditBrand(e.target.value.toUpperCase())}
                        className="h-8 text-xs font-bold text-white w-24 bg-secondary/35 border-border/80"
                      />
                      <Input
                        placeholder="Model"
                        value={editModel}
                        onChange={(e) => setEditModel(e.target.value.toUpperCase())}
                        className="h-8 text-xs font-bold text-white w-32 bg-secondary/35 border-border/80"
                      />
                    </div>
                    <CardDescription className="text-[10px]">Edit brand, model, and service rates</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400 border-red-500/30 hover:bg-red-500/10 h-8"
                    onClick={() => {
                      if (selectedCard.id.startsWith('virtual-')) {
                        setSelectedCard(null);
                        toast.success('Deselected virtual model.');
                      } else {
                        if (confirm(`Delete rate card for ${selectedCard.brand} ${selectedCard.model}?`)) {
                          deleteMutation.mutate(selectedCard.id);
                        }
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedCard(null)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Close
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-thin">
                <div className="min-w-[600px] space-y-4">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_100px_100px_100px_40px] gap-2 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Service Name</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">OG Cost (₹)</span>
                    <span translate="no" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider notranslate">Copy Cost (₹)</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ditto Cost (₹)</span>
                    <span />
                  </div>

                  {/* Service Rows */}
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {editServices.map((svc, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_100px_100px_100px_40px] gap-2 items-center">
                        <Input
                          placeholder={`Service ${idx + 1}`}
                          value={svc.service_name}
                          onChange={(e) => updateServiceRow(idx, 'service_name', e.target.value)}
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={svc.og_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'og_cost', parseFloat(e.target.value) || 0)}
                            className="pl-8 text-foreground font-semibold text-white"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={svc.copy_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'copy_cost', parseFloat(e.target.value) || 0)}
                            className="pl-8 text-foreground font-semibold text-white"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={svc.ditto_cost || ''}
                            onChange={(e) => updateServiceRow(idx, 'ditto_cost', parseFloat(e.target.value) || 0)}
                            className="pl-8 text-foreground font-semibold text-white"
                          />
                        </div>
                        <button
                          onClick={() => removeServiceRow(idx)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add Row + Total + Save */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={addServiceRow} className="gap-1.5 h-8">
                  <Plus className="h-3.5 w-3.5" /> Add Service Row
                </Button>

                <div className="flex items-center gap-4">
                  <div className="text-right flex items-center gap-4 border-r border-border/40 pr-4 mr-1 flex-wrap">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total OG</p>
                      <p className="text-sm font-black text-primary">₹{totalOgLabor.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Copy</p>
                      <p className="text-sm font-black text-rose-500">₹{totalCopyLabor.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Ditto</p>
                      <p className="text-sm font-black text-amber-500">₹{totalDittoLabor.toFixed(2)}</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveServices}
                    disabled={saveServicesMutation.isPending || updateImageMutation.isPending}
                    className="gap-1.5"
                  >
                    {saveServicesMutation.isPending || updateImageMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="h-4 w-4" /> Save Services</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
