# TradeFourge Monorepo

Welcome to the official **TradeFourge** repository. TradeFourge is an advanced, high-performance trading journal, analytics platform, and broker synchronization ecosystem.

This repository is structured as a monorepo containing the web application, companion browser extension, backend services, and database migrations.

---

## 📁 Repository Structure

```
TradeFourge/
├── tradefourge-web/              # Next.js 14+ Web Application & Trading Journal
│   ├── app/                      # Next.js App Router (Dashboard, Analytics, Journal)
│   ├── components/               # UI components (Trading charts, forms, modals)
│   ├── lib/                      # Analytics engines, Supabase client, MT5 bridge
│   ├── middleware.ts             # Auth & route protection middleware
│   └── package.json              # Web application dependencies
│
├── tradefourge-extension/        # Chromium Companion Extension (V1.0)
│   ├── manifest.json             # Manifest Version 3
│   ├── background.js             # Extension service worker
│   ├── content.js                # Host verification & injection bridge
│   ├── inject.js                 # Page-context WebSocket interceptor
│   ├── popup.html / popup.js     # Dark mode Companion status UI
│   └── README.md                 # Extension technical documentation
│
├── backend/                      # Backend Microservices & API services
│   └── .gitkeep
│
├── database/                     # Database schemas, migrations & Forensics
│   └── .gitkeep
│
├── package.json                  # Monorepo root scripts & workspace configuration
├── vercel.json                   # Vercel build configuration
├── .gitignore                    # Monorepo git ignore rules
└── README.md                     # Monorepo documentation
```

---

## 🚀 Deployment Instructions (Vercel)

### Vercel Project Setup

When deploying this repository to **Vercel**, configure the project settings as follows:

1. **Root Directory Configuration**:
   - Go to **Vercel Dashboard** → Select Project → **Settings** → **General**.
   - Under **Root Directory**, click **Edit**.
   - Set the Root Directory to:
     ```text
     tradefourge-web
     ```
   - Save the settings.

2. **Framework Preset**:
   - **Framework Preset**: `Next.js`

3. **Build & Development Settings** (automatically inherited from `tradefourge-web/package.json`):
   - **Build Command**: `npm run build` (or `next build`)
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

4. **Automated Fallback (`vercel.json`)**:
   - The repository includes a root `vercel.json` file which instructs Vercel to build from `tradefourge-web` automatically even if the Root Directory setting is left at root (`/`).

### Required Environment Variables

Configure the following environment variables in Vercel (**Project Settings** → **Environment Variables**):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Application URL
NEXT_PUBLIC_APP_URL=https://tradefourge.com

# Database Connection (Optional for direct migrations)
DATABASE_URL=postgresql://postgres:<password>@db.<your-supabase-project>.supabase.co:5432/postgres
```

---

## 💻 Local Development

### 1. Web Application (`tradefourge-web`)

To run the Next.js web application locally:

```bash
# Option A: From monorepo root
npm run dev:web

# Option B: Navigate to package directory
cd tradefourge-web
npm install
npm run dev
```

The app will start at `http://localhost:3000`.

To build and test the production production bundle:

```bash
npm run build:web
```

---

### 2. Companion Browser Extension (`tradefourge-extension`)

To load the TradeFourge Companion Extension into any Chromium-based browser (Chrome, Brave, Edge, Opera, Vivaldi, Arc):

1. Open your browser and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle switch in the top right corner).
3. Click **Load unpacked**.
4. Select the `tradefourge-extension` folder from this repository.
5. Navigate to supported broker pages (e.g. `https://terminal.exness.com`).
6. Open Developer Tools Console (`F12`) to view intercepted WebSocket log traffic.

For full technical documentation on the extension architecture, see [tradefourge-extension/README.md](file:///c:/Users/suraj/Desktop/Trading%20Journal/tradefourge-extension/README.md).

---

## 📄 License & Ownership

Copyright © 2026 TradeFourge. All rights reserved.
