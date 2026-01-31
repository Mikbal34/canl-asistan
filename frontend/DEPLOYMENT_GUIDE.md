# Deployment Guide

## Pre-Deployment Checklist

- [ ] Backend API is running and accessible
- [ ] Environment variables are configured
- [ ] Build completes without errors
- [ ] All features tested in development
- [ ] API endpoints verified
- [ ] Authentication flow tested

## Environment Setup

### Development
```bash
# Copy environment template
cp .env.example .env

# Edit with your values
VITE_API_URL=http://localhost:3000
```

### Production
```bash
# Production environment
VITE_API_URL=https://api.yourdomain.com
```

## Build Commands

### Development
```bash
npm run dev
# Runs on http://localhost:5173
```

### Production Build
```bash
npm run build
# Output: dist/ folder
```

### Preview Production Build
```bash
npm run preview
# Preview the production build locally
```

## Deployment Options

### Option 1: Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
cd /Users/ikbalkoc/Desktop/canlıasistan/frontend
vercel
```

3. Configure environment variables in Vercel dashboard

### Option 2: Netlify

1. Install Netlify CLI:
```bash
npm i -g netlify-cli
```

2. Build and deploy:
```bash
npm run build
netlify deploy --prod --dir=dist
```

### Option 3: Docker

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Build and run:
```bash
docker build -t voice-assistant-frontend .
docker run -p 80:80 voice-assistant-frontend
```

### Option 4: Static Server

Build and serve:
```bash
npm run build
npx serve -s dist -l 3001
```

## Environment Variables

Required variables:

| Variable | Description | Example |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | https://api.example.com |

## Post-Deployment

1. **Verify Build**
   - Check all routes load
   - Test authentication flow
   - Verify API connections

2. **Performance Check**
   - Lighthouse score
   - Page load times
   - Asset optimization

3. **Security**
   - HTTPS enabled
   - CORS configured
   - API tokens secured

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### API Connection Issues
- Check CORS settings on backend
- Verify API URL in .env
- Check network firewall rules

### Routing Issues (404 on refresh)
Configure server to always serve index.html:
- Vercel: `vercel.json`
- Netlify: `_redirects`
- nginx: `try_files` directive

## Monitoring

Recommended tools:
- Google Analytics
- Sentry for error tracking
- LogRocket for session replay
- Vercel Analytics

## Continuous Deployment

### GitHub Actions

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## Performance Optimization

### Before Deployment

1. **Code Splitting**
   - Implement React.lazy for routes
   - Split large components

2. **Asset Optimization**
   - Compress images
   - Use WebP format
   - Lazy load images

3. **Bundle Analysis**
```bash
npm run build
npx vite-bundle-visualizer
```

### CDN Setup

Use CDN for static assets:
- Cloudflare
- AWS CloudFront
- Vercel Edge Network

## Rollback Plan

1. Keep previous build:
```bash
mv dist dist.backup
```

2. Quick rollback:
```bash
rm -rf dist
mv dist.backup dist
```

## Support & Maintenance

- Monitor error logs
- Update dependencies regularly
- Review analytics weekly
- Backup deployments

---

For questions: Check README.md and QUICKSTART.md
