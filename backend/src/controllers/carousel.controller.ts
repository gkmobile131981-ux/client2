import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../utils/supabase';
import { uploadPhoto } from '../utils/photoUpload';

const createSlideSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required')
});

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
