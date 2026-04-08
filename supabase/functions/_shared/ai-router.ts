/**
 * AI ROUTER CONFIGURATION
 * 
 * Centralized routing configuration for all AI model usage across Jericho.
 * This enables intelligent model selection based on task complexity, 
 * latency requirements, and cost optimization.
 * 
 * ROUTING PHILOSOPHY:
 * - Gemini Flash-Lite: Ultra-fast, simple tasks (classification, yes/no)
 * - Gemini Flash: Standard tasks (chat, podcasts, recommendations)
 * - Gemini Pro: Complex analysis (vision, strategic reports)
 * - Claude Opus 4.5: Multi-step reasoning (career planning, reviews)
 */

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export type ModelProvider = 'lovable' | 'anthropic' | 'openai' | 'perplexity';

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  maxTokens: number;
  costPer1MInput: number;  // USD
  costPer1MOutput: number; // USD
  latency: 'ultra-fast' | 'fast' | 'medium' | 'slow';
  strengths: string[];
  supportsVision?: boolean;
  supportsStreaming?: boolean;
}

export const MODELS: Record<string, ModelConfig> = {
  // Lovable AI Gateway models (no API key needed)
  'gemini-flash-lite': {
    id: 'google/gemini-2.5-flash-lite',
    provider: 'lovable',
    maxTokens: 8192,
    costPer1MInput: 0.075,
    costPer1MOutput: 0.30,
    latency: 'ultra-fast',
    strengths: ['classification', 'simple extraction', 'yes/no decisions', 'quick parsing'],
    supportsStreaming: true,
  },
  'gemini-flash': {
    id: 'google/gemini-2.5-flash',
    provider: 'lovable',
    maxTokens: 32768,
    costPer1MInput: 0.15,
    costPer1MOutput: 0.60,
    latency: 'fast',
    strengths: ['chat', 'summarization', 'recommendations', 'podcasts', 'coaching'],
    supportsStreaming: true,
  },
  'gemini-pro': {
    id: 'google/gemini-2.5-pro',
    provider: 'lovable',
    maxTokens: 65536,
    costPer1MInput: 1.25,
    costPer1MOutput: 5.00,
    latency: 'medium',
    strengths: ['vision', 'strategic reports', 'complex analysis', 'document understanding'],
    supportsVision: true,
    supportsStreaming: true,
  },
  'gemini-3-pro': {
    id: 'google/gemini-3.1-pro-preview',
    provider: 'lovable',
    maxTokens: 65536,
    costPer1MInput: 1.25,
    costPer1MOutput: 5.00,
    latency: 'medium',
    strengths: ['reasoning', 'sales coaching', 'complex analysis', 'instruction following'],
    supportsStreaming: true,
  },
  
  // Anthropic models (requires ANTHROPIC_API_KEY)
  'opus': {
    id: 'claude-opus-4-6',
    provider: 'anthropic',
    maxTokens: 200000,
    costPer1MInput: 5.00,
    costPer1MOutput: 25.00,
    latency: 'slow',
    strengths: ['multi-step reasoning', 'agentic workflows', 'long context synthesis', 
                'career planning', 'nuanced writing', 'complex decision making'],
    supportsVision: true,
    supportsStreaming: true,
  },
  'sonnet': {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    maxTokens: 200000,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    latency: 'medium',
    strengths: ['content generation', 'nuanced writing', 'code generation'],
    supportsVision: true,
    supportsStreaming: true,
  },
  
  // Specialized models
  'perplexity-sonar': {
    id: 'sonar-pro',
    provider: 'perplexity',
    maxTokens: 8192,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    latency: 'medium',
    strengths: ['web search', 'real-time information', 'news', 'research'],
    supportsStreaming: false,
  },
};

// ============================================================================
// TASK → MODEL ROUTING TABLE
// ============================================================================

export type TaskType = 
  // Ultra-fast tasks (Gemini Flash-Lite)
  | 'simple-classification'
  | 'intent-detection'
  | 'quick-extraction'
  | 'sentiment-analysis'
  
  // Standard tasks (Gemini Flash)
  | 'chat'
  | 'podcast-script'
  | 'resource-recommendation'
  | 'sales-coaching'
  | 'sales-coaching-main'  // Main coaching response - needs strong instruction following
  | 'meeting-parsing'
  | 'habit-suggestions'
  | 'goal-writing'
  | 'content-summary'
  
  // Complex tasks (Gemini Pro)
  | 'vision-analysis'
  | 'strategic-report'
  | 'job-analysis'
  | 'team-insights'
  | 'risk-detection'
  | 'field-map-analysis'
  
  // High-complexity tasks (Opus)
  | 'career-pathing'
  | 'promotion-assessment'
  | 'performance-review'
  | 'multi-step-planning'
  | 'aspiration-synthesis'
  | 'leadership-assessment'
  | 'organizational-design'
  
  // Specialized
  | 'web-search'
  | 'capability-content'
  | 'telegram-chat';

export const ROUTING_TABLE: Record<TaskType, string> = {
  // Ultra-fast tasks → Gemini Flash-Lite ($0.075/1M input)
  'simple-classification': 'gemini-flash-lite',
  'intent-detection': 'gemini-flash-lite',
  'quick-extraction': 'gemini-flash-lite',
  'sentiment-analysis': 'gemini-flash-lite',
  
  // Standard tasks → Gemini Flash ($0.15/1M input)
  'chat': 'gemini-flash',
  'podcast-script': 'gemini-flash',
  'resource-recommendation': 'gemini-flash',
  'sales-coaching': 'opus',
  'sales-coaching-main': 'opus',
  'meeting-parsing': 'gemini-flash',
  'habit-suggestions': 'gemini-flash',
  'goal-writing': 'gemini-flash',
  'content-summary': 'gemini-flash',
  
  // Complex tasks → Gemini Pro ($1.25/1M input)
  'vision-analysis': 'gemini-pro',
  'strategic-report': 'gemini-pro',
  'job-analysis': 'gemini-pro',
  'team-insights': 'gemini-pro',
  'risk-detection': 'gemini-pro',
  'field-map-analysis': 'gemini-pro',
  
  // High-complexity tasks → Opus ($15/1M input)
  'career-pathing': 'opus',
  'promotion-assessment': 'opus',
  'performance-review': 'opus',
  'multi-step-planning': 'opus',
  'aspiration-synthesis': 'opus',
  'leadership-assessment': 'opus',
  'organizational-design': 'opus',
  
  // Specialized routing
  'web-search': 'perplexity-sonar',
  'capability-content': 'sonnet',
  'telegram-chat': 'gemini-pro',
};

// ============================================================================
// ROUTING CONTEXT
// ============================================================================

export interface RoutingContext {
  taskType: TaskType;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  requiresVision?: boolean;
  requiresStreaming?: boolean;
  companyId?: string | null;
  profileId?: string | null;
  functionName?: string;
}

export interface RoutingResult {
  model: ModelConfig;
  modelKey: string;
  wasUpgraded: boolean;
  upgradeReason?: string;
}

// ============================================================================
// ROUTING FUNCTION
// ============================================================================

/**
 * Intelligently route a task to the optimal model.
 * Handles automatic upgrades for high-token tasks and vision requirements.
 */
export function routeToModel(context: RoutingContext): RoutingResult {
  const baseModelKey = ROUTING_TABLE[context.taskType];
  let modelKey = baseModelKey;
  let wasUpgraded = false;
  let upgradeReason: string | undefined;
  
  // Auto-upgrade for high token count (>40k tokens → Opus)
  const estimatedTokens = (context.estimatedInputTokens || 0) + (context.estimatedOutputTokens || 0);
  if (estimatedTokens > 40000 && modelKey !== 'gemini-3-pro' && modelKey !== 'opus') {
    modelKey = 'gemini-3-pro';
    wasUpgraded = true;
    upgradeReason = `Token count (${estimatedTokens}) exceeds threshold for ${baseModelKey}`;
  }
  
  // Auto-upgrade for vision if needed
  if (context.requiresVision && !MODELS[modelKey].supportsVision) {
    const originalKey = modelKey;
    modelKey = 'gemini-pro';
    wasUpgraded = true;
    upgradeReason = `Vision required, upgrading from ${originalKey}`;
  }
  
  const model = MODELS[modelKey];
  
  console.log(`[AI Router] ${context.taskType} → ${model.id}${wasUpgraded ? ` (upgraded: ${upgradeReason})` : ''}`);
  
  return {
    model,
    modelKey,
    wasUpgraded,
    upgradeReason,
  };
}

// ============================================================================
// COST ESTIMATION
// ============================================================================

/**
 * Estimate the cost of a model call in USD.
 */
export function estimateCost(
  modelKey: string, 
  inputTokens: number, 
  outputTokens: number
): number {
  const model = MODELS[modelKey];
  if (!model) return 0;
  
  const inputCost = (inputTokens / 1_000_000) * model.costPer1MInput;
  const outputCost = (outputTokens / 1_000_000) * model.costPer1MOutput;
  
  return Number((inputCost + outputCost).toFixed(6));
}

// ============================================================================
// MODEL CALL HELPERS
// ============================================================================

/**
 * Get the appropriate API endpoint and headers for a model.
 */
export function getModelEndpoint(model: ModelConfig): { url: string; headers: Record<string, string> } {
  switch (model.provider) {
    case 'lovable':
      return {
        url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
          'Content-Type': 'application/json',
        },
      };
    
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') || '',
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      };
    
    case 'perplexity':
      return {
        url: 'https://api.perplexity.ai/chat/completions',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('PERPLEXITY_API_KEY')}`,
          'Content-Type': 'application/json',
        },
      };
    
    default:
      throw new Error(`Unknown provider: ${model.provider}`);
  }
}

/**
 * Make an AI call with automatic routing and cost logging.
 */
export async function callAI(
  context: RoutingContext,
  messages: Array<{ role: string; content: string }>,
  options: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}
): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number }; modelUsed: string }> {
  const { model, modelKey, wasUpgraded, upgradeReason } = routeToModel(context);
  const { url, headers } = getModelEndpoint(model);
  
  const startTime = Date.now();
  
  try {
    if (model.provider === 'anthropic') {
      // Anthropic API format
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model.id,
          max_tokens: options.maxTokens || 4096,
          system: options.systemPrompt,
          messages: messages.map(m => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.content,
          })),
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`[AI Router] Anthropic error:`, error);
        throw new Error(`Anthropic API error: ${response.status}`);
      }
      
      const data = await response.json();
      const latencyMs = Date.now() - startTime;
      
      const usage = {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      };
      
      // Log usage
      await logAIUsage({
        ...context,
        modelUsed: model.id,
        modelProvider: model.provider,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs,
        wasFallback: wasUpgraded,
        fallbackReason: upgradeReason,
      });
      
      return {
        content: data.content?.[0]?.text || '',
        usage,
        modelUsed: model.id,
      };
      
    } else {
      // OpenAI-compatible format (Lovable, Perplexity)
      const allMessages = options.systemPrompt 
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages;
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model.id,
          messages: allMessages,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`[AI Router] ${model.provider} error:`, error);
        throw new Error(`${model.provider} API error: ${response.status}`);
      }
      
      const data = await response.json();
      const latencyMs = Date.now() - startTime;
      
      const usage = {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      };
      
      // Log usage
      await logAIUsage({
        ...context,
        modelUsed: model.id,
        modelProvider: model.provider,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs,
        wasFallback: wasUpgraded,
        fallbackReason: upgradeReason,
      });
      
      return {
        content: data.choices?.[0]?.message?.content || '',
        usage,
        modelUsed: model.id,
      };
    }
  } catch (error) {
    console.error(`[AI Router] Error calling ${model.id}:`, error);
    console.error(`[AI Router] Provider: ${model.provider}, URL: ${url}, Status may be in error above`);
    
    // Fallback logic: Try a more reliable model
    if (model.provider === 'anthropic') {
      console.warn(`[AI Router] ⚠️ FALLING BACK from ${model.id} to Gemini Pro — Anthropic call failed`);
      return callAI(
        { ...context, taskType: 'strategic-report' }, // Force Gemini Pro
        messages,
        options
      );
    }
    
    throw error;
  }
}

// ============================================================================
// USAGE LOGGING
// ============================================================================

interface UsageLogEntry {
  companyId?: string | null;
  profileId?: string | null;
  functionName?: string | null;
  modelUsed: string;
  modelProvider: string;
  taskType: TaskType;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  wasFallback: boolean;
  fallbackReason?: string;
}

async function logAIUsage(entry: UsageLogEntry): Promise<void> {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const estimatedCost = estimateCost(
      Object.keys(MODELS).find(k => MODELS[k].id === entry.modelUsed) || 'gemini-flash',
      entry.inputTokens,
      entry.outputTokens
    );
    
    await supabase.from('ai_usage_log').insert({
      company_id: entry.companyId || null,
      profile_id: entry.profileId || null,
      function_name: entry.functionName || 'unknown',
      model_used: entry.modelUsed,
      model_provider: entry.modelProvider,
      task_type: entry.taskType,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      estimated_cost_usd: estimatedCost,
      latency_ms: entry.latencyMs,
      was_fallback: entry.wasFallback,
      fallback_reason: entry.fallbackReason || null,
    });
  } catch (err) {
    // Don't fail the main request if logging fails
    console.error('[AI Router] Failed to log usage:', err);
  }
}

// ============================================================================
// EXPORTS FOR BACKWARDS COMPATIBILITY
// ============================================================================

// Default model for quick access (matches current jericho-config.ts)
export const DEFAULT_MODEL = MODELS['gemini-flash'].id;
export const DEFAULT_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
