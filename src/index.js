/**
 * SaaS Sesli Asistan - Ana Sunucu
 * Multi-tenant destekli Express sunucusu
 */

// Uncaught exception handler - must be first
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('[Server] Starting...');
console.log('[Server] Node version:', process.version);
console.log('[Server] PORT:', process.env.PORT);

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');
const config = require('./config/env');
const twilioRoutes = require('./routes/twilio');
const vapiRoutes = require('./routes/vapi');
const apiRoutes = require('./routes/api');
const onboardingRoutes = require('./routes/onboarding');
const { createSession, getSession, removeSession } = require('./handlers/callHandler');

// Express app
const app = express();

// CORS yapılandırması
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'saas-sesli-asistan',
    version: '2.0.0',
  });
});

// API routes
app.use('/api', apiRoutes);

// Onboarding routes (public + authenticated)
app.use('/api/onboarding', onboardingRoutes);

// Twilio webhook routes
app.use('/voice', twilioRoutes);

// Vapi webhook routes
app.use('/vapi', vapiRoutes);

// React frontend (production build)
const frontendDistPath = path.join(__dirname, '../frontend/dist');

app.use(express.static(frontendDistPath));

// SPA routing - tüm bilinmeyen route'ları React'a yönlendir
app.get('*', (req, res, next) => {
  // API ve webhook route'larını atla
  if (req.path.startsWith('/api') || req.path.startsWith('/voice') || req.path.startsWith('/vapi')) {
    return next();
  }

  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// HTTP Server
const server = http.createServer(app);

// WebSocket Server - Twilio Media Streams için
const wss = new WebSocketServer({
  server,
  path: '/voice/stream',
});

// WebSocket bağlantı yönetimi
wss.on('connection', (ws, req) => {
  console.log('[WebSocket] Yeni bağlantı');

  let callSid = null;
  let callerNumber = null;

  // Mesaj dinleyicisi
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // İlk start mesajından bilgileri al
      if (data.event === 'start') {
        callSid = data.start.callSid;
        callerNumber = data.start.customParameters?.callerNumber || 'unknown';
        const tenantId = data.start.customParameters?.tenantId || null;

        console.log(`[WebSocket] Stream başladı - CallSid: ${callSid}, Arayan: ${callerNumber}, Tenant: ${tenantId || 'default'}`);

        // Yeni oturum oluştur (tenant-aware)
        const session = createSession(callSid, data.start.streamSid, ws, callerNumber, tenantId);
        await session.start();
      } else if (callSid) {
        // Mevcut oturuma mesajı ilet
        const session = getSession(callSid);
        if (session) {
          await session.handleMessage(message);
        }
      }
    } catch (error) {
      console.error('[WebSocket] Mesaj işleme hatası:', error);
    }
  });

  // Bağlantı kapandığında
  ws.on('close', () => {
    console.log(`[WebSocket] Bağlantı kapandı - CallSid: ${callSid}`);
    if (callSid) {
      removeSession(callSid);
    }
  });

  // Hata durumunda
  ws.on('error', (error) => {
    console.error('[WebSocket] Hata:', error);
    if (callSid) {
      removeSession(callSid);
    }
  });
});

// Sunucuyu başlat
const PORT = config.server.port;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║     🎙️  SAAS SESLİ ASİSTAN v2.0                            ║');
  console.log('║     Multi-tenant Voice Assistant Platform                  ║');
  console.log('║                                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  HTTP Server:    http://localhost:${PORT}                    ║`);
  console.log(`║  WebSocket:      ws://localhost:${PORT}/voice/stream         ║`);
  console.log(`║  Health Check:   http://localhost:${PORT}/health             ║`);
  console.log('║                                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Endpoints:                                                ║');
  console.log('║  • GET  /                 - React Dashboard                ║');
  console.log('║  • GET  /onboarding       - Tenant Onboarding Wizard       ║');
  console.log('║  • POST /api/auth/login   - Authentication                 ║');
  console.log('║  • POST /api/onboarding/* - Onboarding API                 ║');
  console.log('║  • GET  /api/tenant/*     - Tenant API                     ║');
  console.log('║  • GET  /api/admin/*      - Admin API                      ║');
  console.log('║  • POST /voice/voice      - Twilio webhook                 ║');
  console.log('║  • POST /vapi/webhook     - Vapi function calls            ║');
  console.log('║  • WS   /voice/stream     - Media stream                   ║');
  console.log('║                                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Supported Industries:                                     ║');
  console.log('║  • Automotive (Test drives, Service appointments)          ║');
  console.log('║  • Beauty (Hair salon, Nail salon appointments)            ║');
  console.log('║                                                            ║');
  console.log('║  Languages: Turkish, English, German                       ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📝 Kurulum:');
  console.log('1. SQL migration\'larını Supabase\'de çalıştırın');
  console.log('2. .env dosyasını yapılandırın');
  console.log('3. cd frontend && npm install && npm run build');
  console.log('4. ngrok http 3000 ile sunucuyu expose edin');
  console.log('5. Twilio/Vapi webhook\'larını ayarlayın');
  console.log('');

  // Startup: VAPI sync + arama kayıtlarını çekme
  setTimeout(async () => {
    try {
      console.log('[Startup] VAPI sync ve arama kayıtları çekme başlıyor...');

      // 1. Tüm aktif tenant'ları VAPI ile sync et (prompt güncellemesi)
      const vapiSyncService = require('./services/vapiSyncService');
      const { createClient } = require('@supabase/supabase-js');
      const envConfig = require('./config/env');
      const supabaseAdmin = createClient(envConfig.supabase.url, envConfig.supabase.serviceRoleKey);

      const { data: activeTenants } = await supabaseAdmin
        .from('tenants')
        .select('id, name')
        .eq('is_active', true);

      if (activeTenants && activeTenants.length > 0) {
        console.log(`[Startup] ${activeTenants.length} aktif tenant sync ediliyor...`);
        for (const tenant of activeTenants) {
          try {
            await vapiSyncService.syncTenant(tenant.id, 'startup_sync');
            console.log(`[Startup] Tenant synced: ${tenant.name}`);
          } catch (syncError) {
            console.error(`[Startup] Tenant sync error (${tenant.name}):`, syncError.message);
          }
        }
      }

      // 2. VAPI'den son aramaları çek ve DB'ye kaydet
      const vapiService = require('./services/vapiService');
      const callResult = await vapiService.fetchAndSaveRecentCalls();
      console.log(`[Startup] Arama kayıtları: ${callResult.saved} yeni kayıt, ${callResult.skipped || 0} mevcut`);

      console.log('[Startup] VAPI sync ve arama kayıtları tamamlandı.');
    } catch (startupError) {
      console.error('[Startup] VAPI sync hatası:', startupError.message);
    }
  }, 5000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM sinyali alındı, kapatılıyor...');
  server.close(() => {
    console.log('[Server] HTTP sunucusu kapatıldı');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT sinyali alındı, kapatılıyor...');
  server.close(() => {
    console.log('[Server] HTTP sunucusu kapatıldı');
    process.exit(0);
  });
});

module.exports = { app, server };

// Trigger deploy - Wed Feb  4 23:32:20 +03 2026
