# GK Repair Shop Management System

GK Repair System is a premium, full-stack monorepo application designed to manage mobile repair shops, clients, tickets, device intake checklists, delivery closure signatures, and staff roles.

---

## Project Architecture

```
gk-repair-system/
├── .github/                  # CI/CD Workflows
│   └── workflows/
│       └── deploy.yml        # GitHub Actions test runner and deployment trigger
├── backend/                  # Node.js + Express + TypeScript API Service
│   ├── src/
│   │   ├── controllers/      # Route controllers (repairs, status, dashboard)
│   │   ├── routes/           # Express API route bindings
│   │   ├── middleware/       # JWT auth token verifications, RBAC security filters
│   │   ├── utils/            # Supabase clients & receipt PDF generators
│   │   └── server.ts         # Express server entry point
│   ├── tests/                # Jest integration test suite & db mocks
│   ├── .env.example          # Server environment variables template
│   ├── tsconfig.json         # TS compiler options
│   └── package.json          # Backend npm configurations
│
├── frontend/                 # React 18 + Vite + TS + Tailwind + Shadcn Web Application
│   ├── src/
│   │   ├── components/ui/    # Shadcn styled UI components (Button, Input, Card)
│   │   ├── components/layout/# Sidebar, Topbar, Layout grid templates
│   │   ├── pages/            # Views (Dashboard, Deliver, Repairs, Customers, Settings)
│   │   ├── lib/              # API clients and Supabase connection libraries
│   │   └── types/            # DB schema definitions
│   ├── .env.example          # Client environment variables template
│   ├── vercel.json           # Vercel SPA routing rewrites
│   ├── tsconfig.json         # TS compiler options
│   └── package.json          # React client configurations
│
├── scripts/                  # Shell & automation helper scripts
│   └── verify-deployment.js  # Post-deployment validation test runner
│
└── supabase/                 # Cloud Storage & Database Schema Migrations
    ├── migrations/           # PostgreSQL RLS tables, triggers, and RPC functions
    └── seed.sql              # Seed SQL script to populate sandbox local DBs
```

---

## Technical Stack & Configuration

### Backend:
- **Express + TypeScript** compiled in strict type checking mode.
- Security hardened via `helmet` (strict Content Security Policies), `cors` (restricted to frontend domain), `express-rate-limit` (brute-force prevention), and sanitization middleware (XSS injection filters).
- Configures connection pools to **Supabase Auth and PostgreSQL** with RLS compliance.

### Frontend:
- **Vite + React 18 + TypeScript + Tailwind CSS** styled with dynamic glassmorphism panels, dark mode toggles, and customized scrolling feeds.
- Serves responsive mobile bottom-tab navigation layouts for small screens.
- Connects through `@tanstack/react-query` to cache, refresh, and query backend API states.

### Database & Storage (Supabase):
- Relational mapping of **Shops**, **Users**, **Customers**, **Devices**, **Repairs**, and **Repair History**.
- Row-Level Security (RLS) policies restrict technicians to reading and updating only their assigned repairs, while granting owners store-wide access.
- Audit triggers record status transition events (with old/new values) to `repair_history`.

---

## Environment Variables

### Backend (`/backend/.env`)
```env
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-vercel-url.vercel.app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-private-service-role-key
```

### Frontend (`/frontend/.env.production`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-public-anon-key
VITE_API_URL=https://your-backend-render-url.onrender.com
```

---

## Installation & Local Development

1. **Supabase Database Setup:**
   - Initialize Supabase locally: `supabase init`.
   - Link to a Supabase project: `supabase link --project-ref your-project-id`.
   - Apply migrations to the database: `supabase db push`.
   - Seed mock data (optional): `supabase db reset`.

2. **Backend Server Setup:**
   - Navigate to `/backend` and install dependencies: `npm install`.
   - Create `.env` from `.env.example` and populate values.
   - Start local hot-reloading development server: `npm run dev`.

3. **Frontend React App Setup:**
   - Navigate to `/frontend` and install dependencies: `npm install`.
   - Create `.env` and fill out public URLs.
   - Run Vite local development server: `npm run dev` (runs at `http://localhost:5173`).

---

## Running Automated Tests

Run test suites locally to verify logic changes:

```bash
# Run Backend Integration Tests (Jest + Supertest)
cd backend
npm run test:backend

# Run Frontend Unit/Integration Tests (Vitest + JSDOM)
cd ../frontend
npm run test
```

---

## Deployment Guide (100% Free Tier)

### 1. Database & Auth Setup (Supabase)
- Set up a new project on the Supabase Free Tier.
- Apply database migrations located under `/supabase/migrations`.
- **Supabase Auth Config**:
  - In Auth Settings, enable **Email Confirmations**.
  - Set **Site URL** to your Vercel frontend URL.
  - Set **Allowed Redirect URLs** to include your Vercel domain and your Render backend URL.

### 2. Backend API Deployment (Render.com)
- Create a new free **Web Service** on Render connected to your GitHub repository.
- Use the following settings (automatically loaded from [render.yaml](render.yaml)):
  - **Environment**: `Node`
  - **Build Command**: `cd backend && npm install && npm run build`
  - **Start Command**: `cd backend && npm start`
- Add the required environment variables in the Render console:
  - `NODE_ENV=production`
  - `FRONTEND_URL` (your Vercel URL)
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 3. Frontend Client Deployment (Vercel)
- Set up a new project on Vercel connected to your GitHub repository.
- Configure the project settings:
  - **Build Command**: `cd frontend && npm install && npm run build`
  - **Output Directory**: `frontend/dist`
- Configure the production environment variables in the Vercel dashboard:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_API_URL` (your Render backend `.onrender.com` URL)

---

## CI/CD Workflow (GitHub Actions)

The deployment pipeline is automated under [.github/workflows/deploy.yml](.github/workflows/deploy.yml):
1. Runs code checking, builds, and test runner tasks on every push to the `main` branch.
2. If both frontend and backend test suites pass, it triggers Render and Vercel hooks to auto-deploy production bundles.
3. Configure the following secrets in your GitHub repository settings:
   - `RENDER_DEPLOY_HOOK_URL`: Your Render dashboard deploy webhook URL.
   - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`: Core deployment credentials for Vercel CLI.

---

## Post-Deployment Verification

A validation script is located at `scripts/verify-deployment.js` to run end-to-end integration checks against a deployed server instance.

```bash
# Run validation against a deployed API instance
node scripts/verify-deployment.js https://your-backend-render-url.onrender.com
```

The script executes the following cycles:
- Registers a temporary shop owner and shop.
- Adds a staff profile and logs in as staff.
- Creates a customer record and uploads a profile image.
- Registers a repair ticket with device photos.
- Transitions ticket status and verifies history log entries.
- Validates the vector PDF receipt generation and download streams.
- Verifies analytics charts dashboard payloads.
- Checks RLS policies and RBAC security boundaries.

---

## References & Documentation
- **User Workflows**: Refer to [USER_MANUAL.md](USER_MANUAL.md) for Shop Owner and Technician workflows.
- **REST Endpoints**: Refer to [API.md](API.md) for full HTTP request/response payloads.
