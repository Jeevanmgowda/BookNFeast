# BookNFeast

BookNFeast is a hotel and restaurant management system with a Node/Express + MySQL backend and a static, single-page frontend. It covers rooms, guests, bookings, menu items, restaurant tables, orders, staff, and reports.

## Features
- Hotel operations: rooms, guests, bookings, and occupancy insights.
- Restaurant operations: menu, tables, orders, and service tracking.
- Admin auth flow with default credentials on first run.
- SQL-backed data with a localStorage fallback in the UI.
- Reports and dashboard with charts.

## Tech Stack
- Frontend: HTML, CSS, JavaScript (Chart.js)
- Backend: Node.js, Express, MySQL

## Project Structure
- backend/ - API server, DB setup, and seed logic
- database/ - MySQL schema, triggers, and sample DML query commands
- frontend/ - SPA UI and pages
- assets/ - shared images and icons

## Setup

### Prerequisites
- Node.js 18+
- MySQL 8+

### Backend
1) Install dependencies

```bash
cd backend
npm install
```

2) Create a database user and set env vars (create backend/.env)

```bash
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=your_password
```

3) Initialize schema

```bash
npm run db:init
```

Sample JOIN and aggregate DML commands are available in `database/dml_commands.sql`.

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

This app needs a Node web service plus a hosted MySQL database. Do not use
`localhost` for MySQL in production; create a cloud MySQL database first, then
add its connection values as environment variables.

### Render

1) Push this repository to GitHub.

2) In Render, create a new Blueprint from the repository. The included
`render.yaml` sets:

```bash
Build Command: npm run build
Start Command: npm start
Health Check Path: /api/health
```

3) Add these environment variables in Render:

```bash
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=booknfeast
```

4) Initialize the production database once by running the SQL in
`database/schema.sql` against the hosted MySQL database.

5) Deploy the service and open `/api/health`. A healthy deployment returns:

```json
{ "ok": true }
```

The frontend is served by the same Express app, so API calls use `/api` in
production and do not need a separate frontend deployment.
