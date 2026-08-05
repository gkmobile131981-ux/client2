import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../utils/supabase';
import { uploadPhoto } from '../utils/photoUpload';

const createSlideSchema = z.object({
  title: z.string().optional().default(''),
  description: z.string().optional().default('')
});

// Marquee ticker scroll settings (seconds per full cycle)
const DEFAULT_MARQUEE_SPEED = 120;
const MIN_MARQUEE_SPEED = 10;
const MAX_MARQUEE_SPEED = 600;

const clampMarqueeSpeed = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MARQUEE_SPEED;
  return Math.min(Math.max(Math.round(parsed), MIN_MARQUEE_SPEED), MAX_MARQUEE_SPEED);
};

export async function getSlides(_req: Request, res: Response): Promise<void> {
  try {
    const { data: slides, error } = await supabaseAdmin
      .from('carousel_slides')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ slides });
  } catch (err) {
    console.error('Failed to get slides:', err);
    res.status(500).json({ error: 'Failed to fetch carousel slides' });
  }
}

export async function createSlide(req: Request, res: Response): Promise<void> {
  try {
    const validated = createSlideSchema.parse(req.body);

    let imageUrl: string | null = null;
    if (req.file) {
      try {
        imageUrl = await uploadPhoto(req.file as Express.Multer.File, 'carousel-images');
      } catch (uploadErr: any) {
        console.error('Carousel slide image upload failed:', uploadErr);
        res.status(400).json({ error: uploadErr.message || 'Failed to upload slide image' });
        return;
      }
    }

    const { data: slide, error } = await supabaseAdmin
      .from('carousel_slides')
      .insert({
        title: validated.title,
        description: validated.description,
        image_url: imageUrl
      })
      .select()
      .single();

    if (error || !slide) {
      // Cleanup image if database insert fails
      if (imageUrl) {
        try {
          const path = imageUrl.split('/carousel-images/')[1];
          if (path) {
            await supabaseAdmin.storage.from('carousel-images').remove([path]);
          }
        } catch (e) {
          console.error('Failed to clean up uploaded image:', e);
        }
      }
      res.status(400).json({ error: error?.message || 'Failed to create carousel slide' });
      return;
    }

    res.status(201).json({ slide });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Failed to create slide:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteSlide(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // 1. Fetch slide to find image path
    const { data: slide, error: fetchError } = await supabaseAdmin
      .from('carousel_slides')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !slide) {
      res.status(404).json({ error: 'Carousel slide not found' });
      return;
    }

    // 2. Delete slide record from DB
    const { error: deleteError } = await supabaseAdmin
      .from('carousel_slides')
      .delete()
      .eq('id', id);

    if (deleteError) {
      res.status(400).json({ error: deleteError.message });
      return;
    }

    // 3. Delete image from Storage if present
    if (slide.image_url) {
      try {
        const path = slide.image_url.split('/carousel-images/')[1];
        if (path) {
          await supabaseAdmin.storage.from('carousel-images').remove([path]);
        }
      } catch (e) {
        console.error('Failed to delete slide image from storage:', e);
      }
    }

    res.json({ message: 'Carousel slide deleted successfully' });
  } catch (err) {
    console.error('Failed to delete slide:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateSlide(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // 1. Fetch slide to find image path
    const { data: slide, error: fetchError } = await supabaseAdmin
      .from('carousel_slides')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !slide) {
      res.status(404).json({ error: 'Carousel slide not found' });
      return;
    }

    let imageUrl = slide.image_url;
    if (req.file) {
      try {
        imageUrl = await uploadPhoto(req.file as Express.Multer.File, 'carousel-images');
        
        // Remove old image from storage if it exists
        if (slide.image_url) {
          const path = slide.image_url.split('/carousel-images/')[1];
          if (path) {
            await supabaseAdmin.storage.from('carousel-images').remove([path]);
          }
        }
      } catch (uploadErr: any) {
        console.error('Carousel slide image upload failed:', uploadErr);
        res.status(400).json({ error: uploadErr.message || 'Failed to upload slide image' });
        return;
      }
    }

    const { data: updatedSlide, error } = await supabaseAdmin
      .from('carousel_slides')
      .update({
        image_url: imageUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !updatedSlide) {
      res.status(400).json({ error: error?.message || 'Failed to update carousel slide' });
      return;
    }

    res.json({ slide: updatedSlide, message: 'Carousel slide updated successfully' });
  } catch (err) {
    console.error('Failed to update slide:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/carousel/marquee
 * Returns the current global marquee ticker text.
 */
export async function getMarqueeText(_req: Request, res: Response): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('marquee_settings')
      .select('title, text, is_active, speed_seconds')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      // Table might not exist yet — return empty gracefully
      res.json({ title: 'Latest Updates', text: '', is_active: false, speed_seconds: DEFAULT_MARQUEE_SPEED });
      return;
    }

    res.json({
      title: data?.title || 'Latest Updates',
      text: data?.text || '',
      is_active: data?.is_active ?? true,
      speed_seconds: clampMarqueeSpeed(data?.speed_seconds)
    });
  } catch (err) {
    console.error('Failed to get marquee text:', err);
    res.json({ text: '', is_active: false });
  }
}

/**
 * POST /api/carousel/marquee
 * Upserts the global marquee ticker text (SuperAdmin only).
 */
export async function upsertMarqueeText(req: Request, res: Response): Promise<void> {
  try {
    const { title, text, is_active, speed_seconds } = req.body;

    if (typeof text !== 'string') {
      res.status(400).json({ error: 'text field is required' });
      return;
    }

    if (typeof title !== 'string') {
      res.status(400).json({ error: 'title field is required' });
      return;
    }

    const marqueeTitle = title.trim() || 'Latest Updates';
    const marqueeSpeed = clampMarqueeSpeed(speed_seconds);

    // Check if a row exists
    const { data: existing } = await supabaseAdmin
      .from('marquee_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    let result;
    if (existing?.id) {
      // Update existing row
      const { data, error } = await supabaseAdmin
        .from('marquee_settings')
        .update({
          title: marqueeTitle,
          text: text.trim(),
          is_active: is_active ?? true,
          speed_seconds: marqueeSpeed,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Insert first row
      const { data, error } = await supabaseAdmin
        .from('marquee_settings')
        .insert({
          title: marqueeTitle,
          text: text.trim(),
          is_active: is_active ?? true,
          speed_seconds: marqueeSpeed
        })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json({ message: 'Marquee text saved successfully', data: result });
  } catch (err: any) {
    console.error('Failed to save marquee text:', err);
    res.status(500).json({ error: err.message || 'Failed to save marquee text' });
  }
}

