# Shuttle Passenger Management System

A full-stack shuttle passenger management system with customer management, subscription plans, NFC/RFID kiosk check-in, Stripe payments, ridership reports, and GPS tracking.

## Tech Stack

- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React + Vite
- **Payments**: Stripe
- **Auth**: JWT
- **Tracking**: Traccar webhook receiver
- **Maps**: Leaflet / OpenStreetMap
- **Charts**: Recharts

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your database URL, JWT secret, Stripe keys
npm install
node src/db/migrate.js   # Creates tables and default admin
npm run dev              # Starts on :3001
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev   # Starts on :3000 (proxies /api to :3001)
```

### 3. Access

- **Admin Console**: http://localhost:3000
- **Kiosk Mode**: http://localhost:3000/kiosk
- **Default login**: admin@example.com / changeme123
  *(Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running migrate)*

## Features

### Admin Console (8 Tabs)

| Tab | Description |
|-----|-------------|
| Dashboard | Revenue, active subscribers, expiring plans, ridership charts |
| Customers | Search, add (3-step wizard), view/edit, subscription history |
| Plans | Monthly, bi-monthly, pay-as-you-go, manual — create/edit/delete |
| Trips | Single, daily, weekly routes with schedule management |
| Payments | View all payments, manual cash entry, Stripe refunds |
| Reports | Trip ridership charts, customer history, CSV export |
| Tracking | Live GPS map (Leaflet), history playback via Traccar |
| Settings | Company branding, renewal reminders, Stripe config, admin users |

### Kiosk Mode (`/kiosk`)

- Full-screen NFC/RFID keyboard-wedge scan interface
- Auto-detects currently active trip
- Large green/red feedback screens
- Handles all plan types:
  - **Monthly/Bi-Monthly (unlimited)**: ✅ show expiry
  - **Trip-limited**: ✅ decrement + show remaining
  - **Pay-as-you-go**: ✅ charge via Stripe or flag for cash
  - **Expired**: 🚫 DENIED with reason
  - **No trips left**: 🚫 DENIED
- Renewal warning banner when near expiry

## API Endpoints

```
POST /api/auth/login
GET  /api/auth/me

GET/POST   /api/customers
GET/PUT    /api/customers/:id
GET        /api/customers/:id/scans
GET        /api/customers/:id/payments
GET/POST   /api/customers/:id/plans
POST       /api/customers/:id/subscribe

GET/POST   /api/plans
GET/PUT    /api/plans/:id

GET/POST   /api/trips
GET/PUT    /api/trips/:id
GET        /api/trips/:id/scans

GET        /api/kiosk/trips
POST       /api/kiosk/scan

GET        /api/payments
POST       /api/payments
POST       /api/payments/:id/refund
POST       /api/payments/create-intent
POST       /api/payments/stripe/webhook

GET        /api/reports/summary
GET        /api/reports/trips/:trip_id
GET        /api/reports/customers/:customer_id
GET        /api/reports/export/trips/:trip_id
GET        /api/reports/export/customers/:customer_id

POST       /api/tracking          (Traccar webhook)
GET        /api/tracking/live
GET        /api/tracking/history
GET        /api/tracking/devices

GET/PUT    /api/settings

GET/POST   /api/auth/admins
DELETE     /api/auth/admins/:id
```

## Traccar Integration

Configure Traccar to forward device positions to:
```
POST http://your-server:3001/api/tracking
```

Supports both OsmAnd query-string format and JSON body format.

## Stripe Integration

1. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `backend/.env`
2. Set `stripe_publishable_key` in Settings tab
3. Configure Stripe webhook to point to `POST /api/payments/stripe/webhook`

## Database Schema

Core tables: `customers`, `plans`, `customer_plans`, `trips`, `trip_scans`, `payments`, `tracking_data`, `settings`, `admin_users`

Run `node src/db/migrate.js` to apply schema and seed default admin.
