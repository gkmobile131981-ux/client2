import { supabaseAdmin } from './supabase';

export async function generateTokenNumber(customerId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('generate_token_number', {
    p_customer_id: customerId
  });

  if (error || !data) {
    throw new Error(`Failed to generate token number: ${error?.message || 'Unknown database error'}`);
  }

  return data as string;
}
