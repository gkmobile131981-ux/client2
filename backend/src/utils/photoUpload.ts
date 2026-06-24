import { supabaseAdmin } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Local TypeScript definitions for Express files
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
  }
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MAX_BUCKET_SIZES: Record<string, number> = {
  'device-photos': 5 * 1024 * 1024,   // 5MB
  'customer-photos': 2 * 1024 * 1024, // 2MB
  'shop-logos': 1 * 1024 * 1024,      // 1MB
  'delivery-photos': 5 * 1024 * 1024, // 5MB
  'rate-card-images': 2 * 1024 * 1024, // 2MB
  'carousel-images': 5 * 1024 * 1024,  // 5MB
  'owner-photos': 2 * 1024 * 1024     // 2MB
};

export async function uploadPhoto(
  file: Express.Multer.File,
  bucket: 'device-photos' | 'customer-photos' | 'shop-logos' | 'delivery-photos' | 'rate-card-images' | 'carousel-images' | 'owner-photos'
): Promise<string> {
  // 1. Validate file extension
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error('Invalid file type. Allowed types: JPEG, PNG, WEBP');
  }

  // 2. Validate file size
  const maxLimit = MAX_BUCKET_SIZES[bucket] || 5 * 1024 * 1024;
  if (file.size > maxLimit) {
    throw new Error(`File too large. Max size allowed: ${maxLimit / (1024 * 1024)}MB`);
  }

  // 3. Generate a clean random filename
  const fileExt = path.extname(file.originalname) || '.jpg';
  const fileName = `${uuidv4()}${fileExt}`;
  const filePath = fileName;

  // 4. Upload buffer to Supabase Cloud Storage
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      duplex: 'half'
    });

  if (error || !data) {
    throw new Error(`Cloud storage upload failed: ${error?.message || 'Unknown error'}`);
  }

  // 5. Generate matching public or signed URL path
  if (bucket === 'shop-logos' || bucket === 'rate-card-images' || bucket === 'carousel-images' || bucket === 'owner-photos') {
    // Return Public URL (public buckets)
    const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
    return publicUrl;
  } else {
    // Return Signed URL (expires in 10 years for presentation permanence)
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);

    if (signError || !signedData) {
      throw new Error(`Failed to sign storage path: ${signError?.message || 'Unknown error'}`);
    }

    return signedData.signedUrl;
  }
}
