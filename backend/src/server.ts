import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import repairRoutes from './routes/repairs.routes';
import authRoutes from './routes/auth.routes';
import customerRoutes from './routes/customers.routes';
import reportsRoutes from './routes/reports.routes';
import rateCardsRoutes from './routes/ratecards.routes';
import superadminRoutes from './routes/superadmin.routes';
import carouselRoutes from './routes/carousel.routes';
import subscriptionRoutes from './routes/subscriptions.routes';
import { sanitizeMiddleware } from './middleware/sanitize';
import { supabaseAdmin } from './utils/supabase';

dotenv.config();

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
const FRONTEND_URL_RAW = process.env.FRONTEND_URL || 'http://localhost:5173';
const FRONTEND_URLS = FRONTEND_URL_RAW.split(',').map(url => url.trim().replace(/\/$/, '')).filter(Boolean);

const isDomainAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  
  // Always allow localhost
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }

  // Always allow panruticellphoneservice.org subdomains & apex
  if (origin.includes('panruticellphoneservice.org')) {
    return true;
  }

  // Allow railway and vercel deployment domains
  if (origin.includes('railway.app') || origin.includes('vercel.app')) {
    return true;
  }

  // Check FRONTEND_URLS
  if (FRONTEND_URLS.some(url => url && origin.startsWith(url))) {
    return true;
  }

  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isDomainAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Body parser with 50MB limit
app.use(express.json({ limit: '50mb' }));

// Global input HTML sanitization middleware
app.use(sanitizeMiddleware);

// Rate limiting disabled completely to prevent lockouts


// Health Check Route
app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api', reportsRoutes);
app.use('/api/ratecards', rateCardsRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/carousel', carouselRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// 404 Route handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const runStartupSync = async () => {
  try {
    const { data: repairs, error } = await supabaseAdmin
      .from('repairs')
      .select('id, estimate')
      .eq('status', 'delivered');

    if (!error && repairs && repairs.length > 0) {
      let count = 0;
      for (const r of repairs) {
        const { error: updateErr } = await supabaseAdmin
          .from('repairs')
          .update({ advance: r.estimate })
          .eq('id', r.id);
        if (!updateErr) count++;
      }
      if (count > 0) {
        console.log(`[Startup Database Sync] Synced ${count} historical delivered orders to balance ₹0.00.`);
      }
    }
  } catch (err) {
    console.error('[Startup Database Sync] Sync failed:', err);
  }
};

// Run database sync immediately on module initialization (runs on server spin-up / Vercel serverless cold-start)
runStartupSync();

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  const portNum = Number(process.env.PORT) || 5000;
  app.listen(portNum, '0.0.0.0', () => {
    console.log(`GK Repair System backend running on port ${portNum} (0.0.0.0)`);
    console.log(`Allowed origins: ${FRONTEND_URLS.join(', ')}`);
  });
}

export default app;
