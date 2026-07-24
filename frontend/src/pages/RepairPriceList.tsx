import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Smartphone, BookOpen, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { apiClient } from '../lib/api';

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

export default function RepairPriceList() {
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  // Fetch all rate cards
  const { data, isLoading, refetch, isFetching } = useQuery<{ rateCards: RateCard[] }>({
    queryKey: ['rate-cards'],
    queryFn: () => apiClient.get('/ratecards'),
  });

  const rateCards = data?.rateCards || [];

  // Get unique brands list from DB rate cards
  const uniqueBrands = useMemo(() => {
    const brandsSet = new Set(rateCards.map((rc) => rc.brand.toUpperCase()));
    return Array.from(brandsSet).sort();
  }, [rateCards]);

  // Filter models based on selected brand from DB rate cards
  const filteredModels = useMemo(() => {
    if (!selectedBrand) return [];
    const models = rateCards
      .filter((rc) => rc.brand.toUpperCase() === selectedBrand.toUpperCase())
      .map((rc) => ({ id: rc.id, model: rc.model }));
    return models.sort((a, b) => a.model.localeCompare(b.model));
  }, [selectedBrand, rateCards]);

  // Find the selected rate card details
  const selectedRateCard = useMemo(() => {
    if (!selectedModelId) return null;
    return rateCards.find((rc) => rc.id === selectedModelId) || null;
  }, [selectedModelId, rateCards]);

  // Fallback to DEFAULT_SERVICES when no services are configured in database
  const activeServices = useMemo(() => {
    if (!selectedRateCard) return [];
    return selectedRateCard.services && selectedRateCard.services.length > 0
      ? selectedRateCard.services
      : DEFAULT_SERVICES;
  }, [selectedRateCard]);

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBrand(e.target.value);
    setSelectedModelId('');
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModelId(e.target.value);
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 text-foreground max-w-7xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span>Repair Price List</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Quickly query standard repair rates and device model photographs.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-secondary/15 hover:bg-secondary/40 text-xs font-bold text-foreground transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Sync Rates</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-semibold">Loading price list cards...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PANEL: Filters & Device image */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <Card className="bg-slate-900/40 border-border/80 shadow-lg">
              <CardHeader className="pb-4 border-b border-border/40">
                <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Device Search</CardTitle>
                <CardDescription>Select a device brand and model to pull the pricing sheet.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Brand Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary uppercase tracking-wider block">Brand</label>
                  <select
                    value={selectedBrand}
                    onChange={handleBrandChange}
                    className="w-full bg-slate-950 border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground cursor-pointer transition-all animate-none"
                  >
                    <option value="">Select Brand</option>
                    {uniqueBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary uppercase tracking-wider block">Model</label>
                  <select
                    value={selectedModelId}
                    onChange={handleModelChange}
                    disabled={!selectedBrand}
                    className="w-full bg-slate-950 border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold text-foreground cursor-pointer transition-all disabled:opacity-50"
                  >
                    <option value="">Select Model</option>
                    {filteredModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.model.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Device Image Box */}
            <Card className="bg-slate-900/40 border-border/80 overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/40">
                <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Device Photo</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center p-6 bg-slate-950/20 min-h-[220px]">
                {selectedRateCard ? (
                  selectedRateCard.model_image_url ? (
                    <div className="relative rounded-xl overflow-hidden border border-border/60 max-h-[300px]">
                      <img
                        src={selectedRateCard.model_image_url}
                        alt={`${selectedRateCard.brand} ${selectedRateCard.model}`}
                        className="object-contain max-h-[260px] max-w-full rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
                      <div className="p-4 rounded-full bg-secondary/35 border border-border/60">
                        <Smartphone className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <span className="text-xs font-semibold">No model image uploaded.</span>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground/60 p-8">
                    <Smartphone className="h-12 w-12 stroke-[1.5]" />
                    <span className="text-xs font-medium text-center">Select model to view photos</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL: Price Table Sheet */}
          <div className="lg:col-span-7">
            {selectedRateCard ? (
              <Card className="bg-slate-900/40 border-border/80 shadow-lg">
                <CardHeader className="pb-4 border-b border-border/40 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-black text-white uppercase tracking-wider">
                      {selectedRateCard.brand} {selectedRateCard.model}
                    </CardTitle>
                    <CardDescription>Official repair service price schedule.</CardDescription>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-primary/20 text-primary border border-primary/30 tracking-wider">
                    {selectedRateCard.services.length > 0 
                      ? `${selectedRateCard.services.length} Configured` 
                      : 'Default Template'}
                  </span>
                </CardHeader>
                <CardContent className="pt-6">
                  {activeServices.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-border/60">
                      <table className="min-w-full divide-y divide-border/40">
                        <thead className="bg-secondary/15">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              Service Name
                            </th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              OG Cost (₹)
                            </th>
                            <th scope="col" translate="no" className="notranslate px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              Copy Cost (₹)
                            </th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              Ditto Cost (₹)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-transparent divide-y divide-border/30">
                          {[...activeServices]
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((service, idx) => (
                              <tr key={service.id || idx} className="hover:bg-secondary/10 transition-colors">
                                <td className="px-4 py-3 text-xs font-semibold text-white whitespace-nowrap">
                                  {service.service_name}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono font-bold text-emerald-400 text-right whitespace-nowrap">
                                  ₹ {Number(service.og_cost ?? 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono font-bold text-pink-400 text-right whitespace-nowrap">
                                  ₹ {Number(service.copy_cost ?? 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono font-bold text-sky-400 text-right whitespace-nowrap">
                                  ₹ {Number(service.ditto_cost ?? 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-xs text-muted-foreground font-medium">
                      No rates configured for this model yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-900/40 border-border/80 border-dashed py-20 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-secondary/15 border border-border/60 mb-4">
                  <BookOpen className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Pricing Sheet Lookup</h3>
                <p className="text-xs text-muted-foreground text-center max-w-sm px-6 leading-relaxed">
                  Choose a device from the selectors on the left side to display its registered servicing prices.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
