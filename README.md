# PlanEdu

An intelligent course planning platform for Boston University students.

## Project Structure

This is a Turborepo monorepo containing:

### Apps

- **frontend** - React + Vite frontend application
  - Built with React, TypeScript, and Tailwind CSS
  - Features: Class swiper, schedule builder, profile management
  
- **backend** - Express.js backend API
  - TypeScript + Express server
  - API endpoints for users, classes, schedules, and recommendations
  - Integrates with Gemini AI for transcript parsing and course recommendations

- **solver** - Schedule optimization service
  - FastAPI service using Google OR-Tools CP-SAT
  - Generates optimized course schedules based on constraints and preferences

- **scraping** - Data scraping tools
  - Python scripts for scraping course data from BU's website
  - Processes and stores course information in the database

### Packages

- **@repo/database** - Shared database schema and Drizzle ORM configuration
- **@repo/eslint-config** - ESLint configurations
- **@repo/typescript-config** - TypeScript configurations

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 10.8.2
- Python 3.8+
- PostgreSQL database (Neon Serverless)

### Installation

```bash
# Install dependencies
npm install

# Install Python dependencies
cd apps/backend && pip install -r requirements.txt
cd ../solver && pip install -r requirements.txt
cd ../scraping && pip install -r requirements.txt
```

### Development

```bash
# Start all services in development mode
npm run dev

# Or start specific services
npm run dev --filter=frontend
npm run dev --filter=backend
npm run dev --filter=solver
```

### Environment Variables

Create `.env` files in each app directory:

**Backend** (`apps/backend/.env`):
```
DATABASE_URL=your_database_url
GOOGLE_CLIENT_ID=your_google_client_id
GEMINI_API_KEY=your_gemini_api_key
```

**Frontend** (`apps/frontend/.env`):
```
VITE_API_URL=http://localhost:3001
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Mantine UI
- **Backend**: Express.js, TypeScript, Node.js
- **Database**: PostgreSQL with Neon Serverless, Drizzle ORM
- **Solver**: Python, FastAPI, OR-Tools CP-SAT
- **AI**: Google Gemini API for transcript parsing and recommendations
- **Authentication**: Google OAuth
- **Monorepo**: Turborepo

## Build

```bash
# Build all apps and packages
npm run build
```

## License

Private - All rights reserved
