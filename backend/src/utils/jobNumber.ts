import { supabaseAdmin } from './supabase';

export async function generateJobNumber(shopId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('generate_job_number', {
    p_shop_id: shopId
  });

  if (error || !data) {
    throw new Error(`Failed to generate atomic job number: ${error?.message || 'Unknown database error'}`);
  }

  return data as string;
}
