# BookNFeast

BookNFeast is a hotel and restaurant management system with a Node/Express + MongoDB backend and a static, single-page frontend. It covers rooms, guests, bookings, menu items, restaurant tables, orders, staff, and reports.

## Features
- Hotel operations: rooms, guests, bookings, and occupancy insights.
- Restaurant operations: menu, tables, orders, and service tracking.
- Admin auth flow with default credentials on first run.
- MongoDB-backed data with a localStorage fallback in the UI.
- Reports and dashboard with charts.

## Tech Stack
- Frontend: HTML, CSS, JavaScript (Chart.js)
- Backend: Node.js, Express, MongoDB
- Database: MongoDB Atlas (free tier)

## Project Structure
- backend/ - API server, DB setup, and seed logic
- database/ - Reference SQL schema and MongoDB aggregation examples
- frontend/ - SPA UI and pages
- assets/ - shared images and icons

## Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free) or local MongoDB

### Backend
1) Install dependencies

```bash
cd backend
npm install
```

2) Create a MongoDB Atlas cluster and set env vars (create backend/.env)

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/booknfeast
```

3) Initialize database indexes

```bash
npm run db:init
```

4) Start the API server

```bash
npm run dev
```

API runs at http://localhost:3000

### Frontend
Open frontend/index.html in your browser. For a better dev experience, use a local server (VS Code Live Server or any static file server).

## Default Admin
- Username: admin
- Password: admin

## API Overview
- GET /api/health
- POST /api/auth/login
- POST /api/auth/reset
- GET /api/bootstrap
- POST /api/seed

## Notes
- The UI will fallback to localStorage seed data if the backend is offline.

## Deployment

### Vercel (Recommended)

1) Push this repository to GitHub.

2) Go to [vercel.com](https://vercel.com) and import your repository.

3) Add the `MONGODB_URI` environment variable in Vercel project settings:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/booknfeast
```

4) Deploy. The included `vercel.json` configures:
   - API routes → Express serverless function
   - Static assets → served directly
   - Frontend → SPA with index.html fallback

5) After deployment, initialize the database:
   - Visit `https://your-app.vercel.app/api/health` to verify
   - POST to `https://your-app.vercel.app/api/seed` to load sample data

### Render (Alternative)

1) Push this repository to GitHub.

2) In Render, create a new Blueprint from the repository. The included
`render.yaml` sets:

```bash
Build Command: npm run build
Start Command: npm start
Health Check Path: /api/health
```

3) Add the `MONGODB_URI` environment variable in Render.

4) Deploy the service and open `/api/health`. A healthy deployment returns:

```json
{ "ok": true }
```

The frontend is served by the same Express app, so API calls use `/api` in
production and do not need a separate frontend deployment.

## MongoDB Atlas Setup Guide

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and sign up (free, no credit card required).
2. Create a new project and build a **free shared cluster** (M0).
3. Under **Database Access**, create a database user with a password.
4. Under **Network Access**, add `0.0.0.0/0` to allow connections from anywhere (required for Vercel).
5. Click **Connect** on your cluster → **Connect your application** → copy the connection string.
6. Replace `<password>` in the URI and set `booknfeast` as the database name.
7. Paste the full URI into your `.env` file or Vercel environment variables.
