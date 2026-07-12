const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DEVICE_BRANDS = {
  'APPLE': ['IPHONE 11', 'IPHONE 12', 'IPHONE 13', 'IPHONE 14', 'IPHONE 15', 'IPHONE 15 PRO', 'IPHONE 15 PRO MAX', 'IPHONE 16E', 'IPHONE 17', 'IPHONE 17 PRO', 'IPHONE 17 PRO MAX', 'IPHONE 17 AIR', 'IPHONE SE (4TH GEN)', 'IPAD AIR', 'IPAD PRO'],
  'SAMSUNG': ['GALAXY S21', 'GALAXY S22', 'GALAXY S23', 'GALAXY S24', 'GALAXY S25', 'GALAXY S25+', 'GALAXY S25 ULTRA', 'GALAXY S25 EDGE', 'GALAXY A16', 'GALAXY A36', 'GALAXY A54', 'GALAXY A56', 'GALAXY M-SERIES', 'GALAXY M34', 'GALAXY Z FOLD 5', 'GALAXY Z FOLD 7', 'GALAXY Z FLIP 5', 'GALAXY Z FLIP 7'],
  'ONEPLUS': ['ONEPLUS 10 PRO', 'ONEPLUS 11', 'ONEPLUS 12', 'ONEPLUS 13', 'ONEPLUS 13R', 'ONEPLUS 13T', 'ONEPLUS NORD 3', 'ONEPLUS NORD 5', 'ONEPLUS NORD CE 3 LITE', 'ONEPLUS NORD CE5'],
  'GOOGLE': ['PIXEL 6', 'PIXEL 7', 'PIXEL 7A', 'PIXEL 8', 'PIXEL 8 PRO', 'PIXEL 9A', 'PIXEL 10', 'PIXEL 10 PRO', 'PIXEL 10 PRO XL', 'PIXEL 10 PRO FOLD'],
  'XIAOMI': ['REDMI NOTE 12', 'REDMI NOTE 13', 'REDMI NOTE 14 SERIES', 'REDMI 14C', 'XIAOMI 13 PRO', 'XIAOMI 15', 'XIAOMI 15 ULTRA', 'XIAOMI 15S PRO', 'POCO F5', 'POCO F7', 'POCO X6 PRO', 'POCO X7 SERIES'],
  'OPPO': ['RENO 10', 'RENO 11', 'RENO 13 SERIES', 'FIND X9', 'FIND X9 PRO', 'FIND X9 ULTRA', 'OPPO A-SERIES', 'OPPO F23', 'OPPO A78'],
  'VIVO': ['VIVO V29', 'VIVO V30', 'VIVO V-SERIES', 'VIVO T2X', 'VIVO Y200', 'VIVO Y-SERIES', 'X200', 'X200 PRO', 'X200 PRO+'],
  'REALME': ['REALME 11 PRO+', 'REALME 12 PRO', 'REALME 14 PRO SERIES', 'REALME C53', 'REALME C-SERIES', 'REALME NARZO 60', 'GT 7 PRO'],
  'HUAWEI': ['MATE 70', 'MATE 70 PRO', 'MATE X6', 'PURA 80', 'NOVA SERIES'],
  'HONOR': ['MAGIC 7', 'MAGIC 7 PRO', 'MAGIC V3', 'HONOR 400 SERIES', 'HONOR X-SERIES'],
  'MOTOROLA': ['EDGE 60 SERIES', 'RAZR 60', 'RAZR 60 ULTRA', 'MOTO G SERIES'],
  'NOTHING': ['PHONE (3)', 'PHONE (3A)', 'PHONE (3A) PRO', 'CMF PHONE 2 PRO'],
  'ASUS': ['ROG PHONE 9', 'ROG PHONE 9 PRO', 'ZENFONE 12'],
  'SONY': ['XPERIA 1 VII', 'XPERIA 10 VII'],
  'NOKIA (HMD)': ['HMD SKYLINE', 'HMD PULSE SERIES', 'NOKIA 110'],
  'ZTE': ['NUBIA Z70 ULTRA', 'REDMAGIC 10 PRO', 'ZTE BLADE SERIES'],
  'MEIZU': ['MEIZU 21 SERIES', 'MEIZU NOTE SERIES'],
  'INFINIX': ['ZERO 40 SERIES', 'NOTE 50 SERIES', 'HOT 60 SERIES', 'SMART 10 SERIES'],
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

async function seedDevices() {
  console.log('Fetching first shop...');
  const { data: shops, error: shopsErr } = await supabase.from('shops').select('id').limit(1);
  if (shopsErr || !shops || shops.length === 0) {
    console.error('Error fetching shops or no shop exists:', shopsErr);
    process.exit(1);
  }
  const shopId = shops[0].id;
  console.log('Using Shop ID:', shopId);

  console.log('Fetching existing rate cards for shop...');
  const { data: existing } = await supabase
    .from('rate_cards')
    .select('brand, model')
    .eq('shop_id', shopId);

  const existingSet = new Set((existing || []).map(r => `${r.brand}-${r.model}`));

  const toInsert = [];
  for (const [brand, models] of Object.entries(DEVICE_BRANDS)) {
    for (const model of models) {
      if (!existingSet.has(`${brand}-${model}`)) {
        toInsert.push({ shop_id: shopId, brand, model });
      }
    }
  }

  if (toInsert.length === 0) {
    console.log('All devices already exist in the database.');
    return;
  }

  console.log(`Inserting ${toInsert.length} new rate cards...`);
  // Insert in batches of 50
  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50);
    const { error } = await supabase.from('rate_cards').insert(batch);
    if (error) {
      console.error('Error inserting batch:', error.message);
    } else {
      console.log(`Inserted batch ${i / 50 + 1}`);
    }
  }
  console.log('✅ Seeding complete!');
}

seedDevices();
