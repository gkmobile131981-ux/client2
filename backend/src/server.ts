import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import repairRoutes from './routes/repairs.routes';
import authRoutes from './routes/auth.routes';
import customerRoutes from './routes/customers.routes';
import reportsRoutes from './routes/reports.routes';
import rateCardsRoutes from './routes/ratecards.routes';
import superadminRoutes from './routes/superadmin.routes';
import carouselRoutes from './routes/carousel.routes';
import { sanitizeMiddleware } from './middleware/sanitize';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL_RAW = process.env.FRONTEND_URL || 'http://localhost:5173';
const FRONTEND_URLS = FRONTEND_URL_RAW.split(',').map(url => url.trim().replace(/\/$/, '')).filter(Boolean);

// Security configuration using Helmet with strict CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.supabase.co"],
        connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co"],
      },
    },
  })
);

// Cors setup — allow any localhost in development
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? FRONTEND_URLS
  : [
      ...FRONTEND_URLS,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5180',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5180'
    ];

const corsOptionsDelegate = (
  req: Request,
  callback: (err: Error | null, options?: cors.CorsOptions) => void
) => {
  const origin = req.header('Origin');
  let isAllowed = false;

  if (!origin) {
    isAllowed = true;
  } else {
    // 1. Check if it's in the allowed origins array
    if (allowedOrigins.includes(origin)) {
      isAllowed = true;
    }
    // 2. Check if it's a localhost origin in development
    else if (process.env.NODE_ENV !== 'production') {
      const isLocalhost = origin.startsWith('http://localhost:') || 
                          origin.startsWith('http://127.0.0.1:') || 
                          origin === 'http://localhost' || 
                          origin === 'http://127.0.0.1';
      if (isLocalhost) isAllowed = true;
    }
    
    // 3. Check if it's a Vercel deployment domain
    if (!isAllowed) {
      const isVercelOrigin = origin.endsWith('.vercel.app') || origin.includes('vercel.app');
      if (isVercelOrigin) isAllowed = true;
    }

    // 4. Dynamic Apex Domain Matching (Self-Healing CORS)
    if (!isAllowed) {
      try {
        const host = req.header('host'); // e.g. api.panruticellphoneservice.org
        if (host) {
          const getApexDomain = (hostname: string): string => {
            const cleanHost = hostname.split(':')[0];
            const parts = cleanHost.split('.');
            if (parts.length <= 2) return cleanHost;
            const last = parts[parts.length - 1];
            const secondLast = parts[parts.length - 2];
            const doubleTlds = ['com', 'co', 'org', 'net', 'gov', 'edu', 'mil', 'ac'];
            if (parts.length > 2 && doubleTlds.includes(secondLast) && last.length === 2) {
              return parts.slice(-3).join('.');
            }
            return parts.slice(-2).join('.');
          };

          const originHostname = new URL(origin).hostname;
          const hostApex = getApexDomain(host);
          const originApex = getApexDomain(originHostname);

          if (hostApex && originApex && hostApex === originApex) {
            isAllowed = true;
          }
        }
      } catch (e) {
        // Ignore URL parsing errors for invalid origins
      }
    }
  }

  callback(null, {
    origin: isAllowed,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
};

app.use(cors(corsOptionsDelegate));

// Body parser with 50MB limit
app.use(express.json({ limit: '50mb' }));

// Global input HTML sanitization middleware
app.use(sanitizeMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // Much higher limits to avoid throttling
  skip: (req) => req.method === 'OPTIONS', // Skip preflight options requests
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  skip: (req) => req.method === 'OPTIONS', // Skip preflight options requests
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login or registration attempts. Please try again after 15 minutes.' }
});

app.use('/api', limiter);
app.use('/api/auth', authLimiter);

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

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`GK Repair System backend running on port ${PORT}`);
    console.log(`Allowed origins: ${FRONTEND_URLS.join(', ')}`);
  });
}

export default app;
