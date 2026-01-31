# Voice Assistant Dashboard - Frontend

Modern, professional multi-tenant SaaS dashboard for AI-powered voice assistant platform built with React, Vite, and TailwindCSS.

## Features

- Multi-tenant architecture with role-based access control
- Modern, responsive UI with glass morphism design
- Internationalization (Turkish, English, German)
- Real-time dashboard with statistics
- Appointment management
- Customer management
- Call logs and transcripts
- Settings and configuration
- Admin panel for super admins

## Tech Stack

- **React 19.2** - UI library
- **Vite 7.2** - Build tool
- **TailwindCSS 4.1** - Utility-first CSS framework
- **React Router 7** - Routing
- **React i18next** - Internationalization
- **Axios** - HTTP client
- **Lucide React** - Icon library

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/          # Reusable components
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Table.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Layout.jsx
│   │   └── ProtectedRoute.jsx
│   ├── pages/
│   │   ├── auth/
│   │   │   └── Login.jsx
│   │   ├── tenant/          # Tenant pages
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Appointments.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── Services.jsx
│   │   │   ├── CallLogs.jsx
│   │   │   └── Settings.jsx
│   │   └── admin/           # Admin pages
│   │       ├── AdminDashboard.jsx
│   │       ├── Tenants.jsx
│   │       └── Presets.jsx
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── TenantContext.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useTenant.js
│   ├── services/
│   │   └── api.js           # API service with axios
│   ├── locales/
│   │   ├── tr.json
│   │   ├── en.json
│   │   └── de.json
│   ├── App.jsx
│   ├── main.jsx
│   ├── i18n.js
│   └── index.css
├── .env
├── .env.example
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your API URL:
```env
VITE_API_URL=http://localhost:3000
```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Environment Variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:3000)

## Features by Role

### Tenant User
- Dashboard with statistics
- Appointment management
- Customer database
- Service offerings
- Call logs and transcripts
- Settings and configuration

### Super Admin
- Admin dashboard
- Tenant management
- Industry preset configuration
- System monitoring

## Color Scheme

- Primary: `#c9a227` (Gold)
- Dark Background: `#0a0a0a`
- Card Background: `#1a1a1a` with transparency
- Glass morphism effects with backdrop blur

## Styling

The project uses TailwindCSS with custom utility classes:

- `.glass` - Glass morphism effect
- `.card` - Card component styling
- `.btn-*` - Button variants
- `.input` - Input field styling
- `.badge-*` - Status badge variants

## API Integration

The frontend integrates with the backend API:

### Auth APIs
- `POST /api/auth/login`
- `GET /api/auth/me`

### Tenant APIs
- `GET /api/tenant/settings`
- `PUT /api/tenant/settings`
- `GET /api/tenant/stats`

### Appointments APIs
- `GET /api/test-drives` (Automotive)
- `GET /api/beauty/appointments` (Beauty)

### Other APIs
- `GET /api/customers`
- `GET /api/services`
- `GET /api/call-logs`

### Admin APIs
- `GET /api/admin/tenants`
- `GET /api/admin/presets`

## Internationalization

The app supports 3 languages:
- Turkish (tr) - Default
- English (en)
- German (de)

Language can be changed from the header menu. Translations are stored in `src/locales/`.

## Authentication

- JWT token-based authentication
- Token stored in localStorage
- Automatic token refresh on API calls
- Protected routes with role-based access

## Performance Considerations

- Code splitting with React.lazy (can be added)
- Optimized bundle size with Vite
- Tree-shaking enabled
- Production build minification
- CSS purging with TailwindCSS

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ support required

## License

Private - All rights reserved
