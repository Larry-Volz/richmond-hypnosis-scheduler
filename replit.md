# replit.md

## Overview

This is an appointment scheduling application for "Magical Mind Shifts Inc." - a hypnotherapy practice. The system allows clients to book free screening appointments with "Doc Volz" through a calendar-based interface. It features a public booking flow where clients select available time slots and submit their contact information, plus an admin interface for managing settings, availability, and appointments.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a pages-based structure with three main routes:
- `/` - Public booking calendar page
- `/book/info` - Booking form for client details
- `/admin` - Administrative dashboard

### Backend Architecture
- **Framework**: Express.js 5 running on Node.js
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful endpoints under `/api/*`
- **Storage**: In-memory storage implementation with interface ready for database migration

Key API endpoints:
- `GET/PUT /api/settings` - System configuration
- `GET/PUT /api/availability` - Weekly availability slots
- `GET/PUT /api/form-fields` - Custom form field definitions
- `GET/POST /api/appointments` - Appointment management
- `GET /api/available-slots` - Calculate available booking times

### Data Layer
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema**: Defined in `shared/schema.ts` using Zod for validation
- **Current Storage**: In-memory `MemStorage` class (production should use database)

Core data models:
- Settings (buffer time, duration, advance booking, reminders)
- Availability slots (day of week, start/end times)
- Form fields (customizable intake form)
- Appointments (client info, datetime, status)

### Build System
- **Development**: Vite dev server with HMR proxied through Express
- **Production**: Custom build script using esbuild for server bundling, Vite for client
- **Output**: Single `dist/` folder with server bundle and static client files

## External Dependencies

### Google Integrations (via Replit Connectors)
- **Google Calendar**: Create calendar events for booked appointments, check busy times
- **Gmail**: Send confirmation and reminder emails to clients and owner

### Database
- **PostgreSQL**: Configured via `DATABASE_URL` environment variable
- **Drizzle Kit**: Schema push with `npm run db:push`

### Key NPM Packages
- `googleapis` - Google Calendar and Gmail API access
- `date-fns` - Date manipulation and formatting
- `zod` - Runtime type validation
- `drizzle-orm` / `drizzle-zod` - Database ORM and schema validation
- `express-session` / `connect-pg-simple` - Session management (available but not currently used)

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- Replit connector environment variables for Google Calendar/Gmail authentication