# Quick Start Guide

## Installation

```bash
cd /Users/ikbalkoc/Desktop/canlıasistan/frontend
npm install
```

## Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

## Project Overview

This is a complete React frontend for a multi-tenant voice assistant SaaS platform with:

### Components Created:
- **Common Components**: Button, Card, Input, Table, Badge, Modal, Sidebar, Header, Layout
- **Auth Pages**: Login
- **Tenant Pages**: Dashboard, Appointments, Customers, Services, CallLogs, Settings
- **Admin Pages**: AdminDashboard, Tenants, Presets

### Features:
- Modern glass morphism UI design
- Responsive layout with Tailwind CSS
- Multi-language support (TR, EN, DE)
- Protected routes with role-based access
- API integration ready
- Context API for state management

### Tech Stack:
- React 19.2
- Vite 7.2
- TailwindCSS 4.1
- React Router 7
- React i18next
- Axios
- Lucide React (icons)

## Connecting to Backend

Make sure your backend API is running on `http://localhost:3000` or update the `.env` file:

```env
VITE_API_URL=http://localhost:3000
```

## Building for Production

```bash
npm run build
```

The production build will be in the `dist/` folder.

## File Structure

```
src/
├── components/
│   ├── common/           # Reusable UI components
│   └── ProtectedRoute.jsx
├── pages/
│   ├── auth/            # Authentication pages
│   ├── tenant/          # Tenant dashboard pages
│   └── admin/           # Admin panel pages
├── context/             # React context providers
├── hooks/               # Custom React hooks
├── services/            # API services
├── locales/             # Translation files
├── App.jsx              # Main app with routing
├── main.jsx             # Entry point
└── i18n.js              # i18n configuration
```

## Key Features by Page

### Dashboard
- Statistics cards (appointments, customers, calls, success rate)
- Recent appointments table
- Industry-specific data

### Appointments
- Full appointment list with filters
- Status badges (confirmed, pending, cancelled)
- Search functionality

### Customers
- Customer database with search
- Contact information
- Appointment history

### Services
- Service offerings list
- Duration and pricing
- CRUD operations ready

### Call Logs
- Voice assistant call history
- Call duration and outcomes
- Transcript access

### Settings
- Company information
- Voice assistant configuration
- Notification preferences

### Admin Panel (Super Admin only)
- Tenant management
- Industry preset configuration
- System overview

## Customization

### Colors
Edit `/Users/ikbalkoc/Desktop/canlıasistan/frontend/tailwind.config.js`:
```js
colors: {
  primary: {
    DEFAULT: '#c9a227', // Change this
  }
}
```

### Translations
Add new languages in `/Users/ikbalkoc/Desktop/canlıasistan/frontend/src/locales/`

### API Endpoints
Update in `/Users/ikbalkoc/Desktop/canlıasistan/frontend/src/services/api.js`

## Troubleshooting

### Port already in use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Tailwind not working
```bash
# Rebuild
rm -rf node_modules
npm install
```

### API connection issues
Check that:
1. Backend is running on port 3000
2. `.env` file has correct API URL
3. CORS is enabled on backend

## Next Steps

1. Connect to your backend API
2. Test authentication flow
3. Customize branding and colors
4. Add additional features as needed
5. Deploy to production

## Support

For issues or questions, check the main README.md or contact the development team.
