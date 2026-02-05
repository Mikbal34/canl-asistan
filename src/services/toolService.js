/**
 * Tool Service
 * Manages tool definitions from database
 * Replaces hardcoded functions.js for tool definitions
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

// Tool service is called from webhooks and admin routes, needs serviceRoleKey
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// In-memory cache for tool definitions
let _toolDefinitionsCache = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get all active tool definitions from database
 * @returns {Array} - Tool definitions in OpenAI function format
 */
async function getMasterToolDefinitions() {
  // Check cache
  const now = Date.now();
  if (_toolDefinitionsCache && (now - _cacheTimestamp) < CACHE_TTL_MS) {
    return _toolDefinitionsCache;
  }

  const { data, error } = await supabase
    .from('tool_definitions')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[ToolService] Error fetching tool definitions:', error);
    // Return cache even if expired, rather than nothing
    if (_toolDefinitionsCache) {
      return _toolDefinitionsCache;
    }
    throw error;
  }

  // Transform to OpenAI function format and cache
  const toolMap = {};
  for (const tool of data || []) {
    toolMap[tool.id] = {
      type: 'function',
      function: {
        name: tool.id,
        description: tool.description,
        parameters: tool.parameters || { type: 'object', properties: {} },
      },
      // Extra metadata
      _category: tool.category,
      _industry: tool.industry,
      _displayName: tool.name,
    };
  }

  _toolDefinitionsCache = toolMap;
  _cacheTimestamp = now;

  console.log(`[ToolService] Cached ${Object.keys(toolMap).length} tool definitions`);
  return toolMap;
}

/**
 * Get tool definition by ID
 * @param {string} toolId - Tool ID
 * @returns {Object} - Tool definition in OpenAI format
 */
async function getToolById(toolId) {
  const tools = await getMasterToolDefinitions();
  return tools[toolId] || null;
}

/**
 * Get tool definitions for specific tool names
 * @param {Array} toolNames - Array of tool IDs
 * @returns {Array} - Array of tool definitions
 */
async function getToolDefinitions(toolNames) {
  const tools = await getMasterToolDefinitions();
  return toolNames
    .map(name => tools[name])
    .filter(tool => tool !== undefined);
}

/**
 * Get tools by category
 * @param {string} category - Category (core, automotive, beauty, addon)
 * @returns {Array} - Array of tool definitions
 */
async function getToolsByCategory(category) {
  const tools = await getMasterToolDefinitions();
  return Object.values(tools).filter(tool => tool._category === category);
}

/**
 * Get tools for an industry (core + industry-specific + addon)
 * @param {string} industry - Industry code
 * @returns {Array} - Array of tool definitions
 */
async function getToolsForIndustry(industry) {
  const tools = await getMasterToolDefinitions();
  return Object.values(tools).filter(tool =>
    tool._category === 'core' ||
    tool._category === 'addon' ||
    tool._industry === industry ||
    tool._industry === null
  );
}

/**
 * Get all tools as array (for listing/admin)
 * @returns {Array} - Array of tool info objects
 */
async function getAllTools() {
  const tools = await getMasterToolDefinitions();
  return Object.values(tools).map(tool => ({
    id: tool.function.name,
    name: tool._displayName,
    description: tool.function.description,
    parameters: tool.function.parameters,
    category: tool._category,
    industry: tool._industry,
  }));
}

/**
 * Create a new tool definition
 * @param {Object} toolData - Tool data
 * @returns {Object} - Created tool
 */
async function createTool(toolData) {
  const { id, name, description, parameters, category, industry } = toolData;

  const { data, error } = await supabase
    .from('tool_definitions')
    .insert({
      id,
      name,
      description,
      parameters: parameters || { type: 'object', properties: {} },
      category: category || 'addon',
      industry,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[ToolService] Error creating tool:', error);
    throw error;
  }

  // Invalidate cache
  invalidateCache();

  console.log(`[ToolService] Created tool: ${id}`);
  return data;
}

/**
 * Update a tool definition
 * @param {string} toolId - Tool ID
 * @param {Object} updates - Updates to apply
 * @returns {Object} - Updated tool
 */
async function updateTool(toolId, updates) {
  const { data, error } = await supabase
    .from('tool_definitions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', toolId)
    .select()
    .single();

  if (error) {
    console.error('[ToolService] Error updating tool:', error);
    throw error;
  }

  // Invalidate cache
  invalidateCache();

  console.log(`[ToolService] Updated tool: ${toolId}`);
  return data;
}

/**
 * Delete a tool definition (soft delete - set is_active = false)
 * @param {string} toolId - Tool ID
 * @param {boolean} hard - If true, permanently delete
 * @returns {Object} - Result
 */
async function deleteTool(toolId, hard = false) {
  if (hard) {
    const { error } = await supabase
      .from('tool_definitions')
      .delete()
      .eq('id', toolId);

    if (error) {
      console.error('[ToolService] Error deleting tool:', error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('tool_definitions')
      .update({ is_active: false })
      .eq('id', toolId);

    if (error) {
      console.error('[ToolService] Error soft-deleting tool:', error);
      throw error;
    }
  }

  // Invalidate cache
  invalidateCache();

  console.log(`[ToolService] Deleted tool: ${toolId}`);
  return { deleted: true };
}

/**
 * Invalidate the tool definitions cache
 */
function invalidateCache() {
  _toolDefinitionsCache = null;
  _cacheTimestamp = 0;
  console.log('[ToolService] Cache invalidated');
}

/**
 * Get cache stats
 * @returns {Object} - Cache statistics
 */
function getCacheStats() {
  return {
    isCached: _toolDefinitionsCache !== null,
    cacheAge: _toolDefinitionsCache ? Date.now() - _cacheTimestamp : 0,
    cacheTtl: CACHE_TTL_MS,
    toolCount: _toolDefinitionsCache ? Object.keys(_toolDefinitionsCache).length : 0,
  };
}

/**
 * Backward compatibility: Get tools in legacy format
 * Maps new DB format to existing functions.js format
 * @param {string} industry - Industry code
 * @returns {Array} - Tool definitions in legacy format
 */
async function getLegacyToolDefinitions(industry = 'automotive') {
  const tools = await getToolsForIndustry(industry);

  // Return in same format as functions.js
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    },
  }));
}

module.exports = {
  // Main functions
  getMasterToolDefinitions,
  getToolById,
  getToolDefinitions,

  // Query functions
  getToolsByCategory,
  getToolsForIndustry,
  getAllTools,

  // CRUD
  createTool,
  updateTool,
  deleteTool,

  // Cache management
  invalidateCache,
  getCacheStats,

  // Backward compatibility
  getLegacyToolDefinitions,
};
