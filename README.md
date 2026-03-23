# Richmond Hypnosis Center — Appointment Scheduling App

A Calendly-style booking system built with React, Express, and TypeScript. Clients can book free screening appointments as new or returning clients, and an admin panel lets you manage availability, settings, and appointments.

---

## Features

- **Client type selection** — New vs. returning client flows
- **New clients**: 45-minute appointments, hourly time slots, 11-field intake form
- **Returning clients**: 60-minute appointments, half-hourly time slots, simplified form
- **Google Calendar integration** — Automatically creates calendar events with Google Meet links
- **Gmail integration** — Sends confirmation emails to clients and the practice owner
- **Admin dashboard** — Manage availability, appointment settings, and form fields

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Express.js 5, TypeScript (ESM) |
| Database | PostgreSQL via Drizzle ORM |
| Routing | Wouter |
| State | TanStack React Query |
| Forms | React Hook Form + Zod |
| Build | Vite (frontend), esbuild (server) |

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# ─── Database ────────────────────────────────────────────────
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host:5432/dbname

# ─── Session ─────────────────────────────────────────────────
# A long random string used to sign session cookies
SESSION_SECRET=your-random-secret-here

# ─── Google OAuth (Calendar + Gmail) ─────────────────────────
# See "Google Setup" section below for how to obtain these
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback

# These are populated automatically after the OAuth flow completes:
GOOGLE_ACCESS_TOKEN=
GOOGLE_REFRESH_TOKEN=
GOOGLE_TOKEN_EXPIRY=
```

> **Note:** When running on Replit, Google Calendar and Gmail credentials are managed automatically through Replit's built-in Google connectors. You do not need to set the `GOOGLE_*` variables on Replit — the connector handles authentication for you.

---

## Google Setup (Outside of Replit)

The app uses two Google APIs: **Google Calendar** and **Gmail**. Follow these steps to set them up:

### 1. Create a Google Cloud Project

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project**, give it a name, and create it
3. Select your new project from the top dropdown

### 2. Enable Required APIs

1. Go to **APIs & Services → Library**
2. Search for and enable:
   - **Google Calendar API**
   - **Gmail API**

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Choose **Web application** as the application type
4. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:5000/auth/google/callback
   ```
   (Replace with your production domain when deploying)
5. Click **Create**
6. Copy the **Client ID** and **Client Secret** into your `.env` file

### 4. Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** (or Internal if you're a Google Workspace user)
3. Fill in the app name, support email, and developer contact email
4. Under **Scopes**, add:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/gmail.send`
5. Add your Gmail address as a **Test User** (while in testing mode)
6. Save and continue

### 5. Run the OAuth Flow

After setting up credentials, you need to authorize the app to access your Google account:

1. Start the app (`npm run dev`)
2. Visit `http://localhost:5000/auth/google` in your browser
3. Sign in with the Google account you want to use for calendar and email
4. Grant the requested permissions
5. The app will store the resulting tokens — copy them into your `.env` as `GOOGLE_ACCESS_TOKEN`, `GOOGLE_REFRESH_TOKEN`, and `GOOGLE_TOKEN_EXPIRY`

> **Important:** The Google account you authorize must own (or have edit access to) the calendar where appointments will be created, and must be the Gmail address from which confirmation emails are sent.

---

## Database Setup

The app uses PostgreSQL. You can use a local Postgres instance or a hosted service like [Supabase](https://supabase.com), [Neon](https://neon.tech), or [Railway](https://railway.app).

1. Create a new database
2. Copy the connection string into `DATABASE_URL` in your `.env`
3. Run the schema migration:
   ```bash
   npm run db:push
   ```

---

## Running Locally

```bash
# Install dependencies
npm install

# Push the database schema
npm run db:push

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5000`.

---

## Project Structure

```
├── client/               # React frontend
│   └── src/
│       ├── pages/        # Route-level page components
│       ├── components/   # Reusable UI components
│       └── lib/          # Utilities and query client
├── server/               # Express backend
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Data access layer
│   ├── google-calendar.ts# Google Calendar integration
│   └── google-mail.ts    # Gmail integration
├── shared/
│   └── schema.ts         # Shared Zod/Drizzle data models
└── drizzle.config.ts     # Database configuration
```

---

## Admin Panel

Visit `/admin` to access the admin dashboard. From there you can:

- Set your weekly availability (days and time ranges)
- Configure appointment settings (buffer time, advance booking window)
- View and manage all booked appointments

---

## Deployment

For production, build the app first:

```bash
npm run build
```

Then start the production server:

```bash
npm start
```

Make sure all environment variables are set in your production environment, and update the `GOOGLE_REDIRECT_URI` to match your production domain.
