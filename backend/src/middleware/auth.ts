import { Request, Response, NextFunction } from 'express';
import { supabaseClient, supabaseAdmin } from '../utils/supabase';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: 'owner' | 'staff';
  shop_id: string | null;
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify user JWT token with Supabase Client
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }

    // Retrieve the user profile from the database to obtain role and shop_id
    // We use supabaseAdmin since the user might not have read access to their own record before authentication, 
    // and using the admin bypasses RLS policies for profile loading
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role, shop_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      res.status(403).json({ error: 'User profile not found in GK Repair System' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role as 'owner' | 'staff',
      shop_id: profile.shop_id
    };

    next();
  } catch (err) {
    res.status(500).json({ error: 'Authentication internal server error' });
  }
}

export function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden: Owner role required' });
    return;
  }

  next();
}

export function requireStaff(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'staff' && req.user.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden: Staff or Owner role required' });
    return;
  }

  next();
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const superAdminEmails = [
    'gkmobile131981@gmail.com',
    'admin@gkrepair.com',
    'test@gkrepair.com'
  ];

  if ((req.user.role as string) === 'superadmin' || (req.user.email && superAdminEmails.includes(req.user.email.toLowerCase().trim()))) {
    next();
    return;
  }

  res.status(403).json({ error: 'Forbidden: Super Admin role required' });
}
