/**
 * Onboarding Agent Routes
 * LLM tabanlı müşteri kurulum chat API endpoints
 */

const express = require('express');
const router = express.Router();
const onboardingAgentService = require('../services/onboardingAgentService');

/**
 * Start a new onboarding session
 * POST /api/admin/onboarding-agent/start
 */
router.post('/start', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID required',
      });
    }

    const session = await onboardingAgentService.createSession(userId);

    res.status(201).json({
      success: true,
      session: {
        id: session.id,
        current_step: session.current_step,
        status: session.status,
        collected_data: session.collected_data,
        messages: session.conversation_history || [],
        expires_at: session.expires_at,
      },
    });
  } catch (error) {
    console.error('[OnboardingAgent] Start session error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send a message to the onboarding agent
 * POST /api/admin/onboarding-agent/chat
 */
router.post('/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'sessionId is required',
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'message is required',
      });
    }

    const result = await onboardingAgentService.processMessage(sessionId, message.trim());

    res.json({
      success: true,
      message: result.message,
      session: {
        id: result.session.id,
        current_step: result.session.current_step,
        status: result.session.status,
        collected_data: result.session.collected_data,
        messages: result.session.conversation_history || [],
      },
      functionResults: result.functionResults,
      tenantCreated: result.tenantCreated ? {
        id: result.tenantCreated.id,
        name: result.tenantCreated.name,
        slug: result.tenantCreated.slug,
        email: result.tenantCreated.email,
      } : null,
    });
  } catch (error) {
    console.error('[OnboardingAgent] Chat error:', error);

    // Handle specific errors
    if (error.message === 'Session not found') {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (error.message === 'Session is not active') {
      return res.status(400).json({ error: 'Session is not active' });
    }
    if (error.message === 'Session expired') {
      return res.status(410).json({ error: 'Session expired' });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * Get session status
 * GET /api/admin/onboarding-agent/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const session = await onboardingAgentService.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found',
      });
    }

    res.json({
      session: {
        id: session.id,
        current_step: session.current_step,
        status: session.status,
        collected_data: session.collected_data,
        messages: session.conversation_history || [],
        created_at: session.created_at,
        expires_at: session.expires_at,
      },
    });
  } catch (error) {
    console.error('[OnboardingAgent] Get session error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Confirm and create tenant
 * POST /api/admin/onboarding-agent/:id/confirm
 */
router.post('/:id/confirm', async (req, res) => {
  try {
    const session = await onboardingAgentService.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found',
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session is not active',
      });
    }

    // Validate required data
    const { collected_data } = session;
    const requiredFields = ['industry', 'name', 'email', 'password'];
    const missingFields = requiredFields.filter(f => !collected_data[f]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    // Create tenant
    const tenant = await onboardingAgentService.createTenantFromSession(req.params.id);

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        industry: tenant.industry,
      },
    });
  } catch (error) {
    console.error('[OnboardingAgent] Confirm error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel a session
 * DELETE /api/admin/onboarding-agent/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const session = await onboardingAgentService.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found',
      });
    }

    await onboardingAgentService.cancelSession(req.params.id);

    res.json({
      success: true,
      message: 'Session cancelled',
    });
  } catch (error) {
    console.error('[OnboardingAgent] Cancel session error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's sessions
 * GET /api/admin/onboarding-agent/sessions
 */
router.get('/sessions/list', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { status } = req.query;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID required',
      });
    }

    const sessions = await onboardingAgentService.getUserSessions(userId, status);

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        current_step: s.current_step,
        status: s.status,
        collected_data: s.collected_data,
        created_at: s.created_at,
        expires_at: s.expires_at,
      })),
    });
  } catch (error) {
    console.error('[OnboardingAgent] Get sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
