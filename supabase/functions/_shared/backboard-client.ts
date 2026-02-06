// Backboard.io client for persistent memory

// Updated endpoint based on SDK docs - they use /api/ path on app.backboard.io
// Trying multiple URL patterns based on their documentation
const BACKBOARD_API_URLS = [
  'https://app.backboard.io/api',          // Primary - from SDK/changelog examples
  'https://app.backboard.io/api/v1',       // Alternate versioned path
  'https://backboard.io/api',              // Root domain
];

interface BackboardThread {
  thread_id: string;
  assistant_id: string;
}

interface BackboardMessage {
  content: string;
  role: 'user' | 'assistant';
}

interface BackboardResponse {
  content: string;
  status: string;
  tool_calls?: any[];
  run_id?: string;
}

export class BackboardClient {
  private apiKey: string;
  private maxRetries: number;
  private workingBaseUrl: string | null = null;

  constructor(apiKey: string, maxRetries: number = 3) {
    this.apiKey = apiKey;
    this.maxRetries = maxRetries;
  }

  private async request(endpoint: string, options: RequestInit = {}, retries = 0): Promise<any> {
    // If we already found a working URL, use it
    const urlsToTry = this.workingBaseUrl 
      ? [this.workingBaseUrl] 
      : BACKBOARD_API_URLS;
    
    let lastError: Error | null = null;
    
    for (const baseUrl of urlsToTry) {
      try {
        console.log(`Trying Backboard: ${baseUrl}${endpoint}`);
        const response = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          headers: {
            // Try both auth header formats - Backboard docs show X-API-Key
            'X-API-Key': this.apiKey,
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Backboard API error: ${response.status} - ${error}`);
        }

        // Remember the working URL for future requests
        if (!this.workingBaseUrl) {
          this.workingBaseUrl = baseUrl;
          console.log(`Backboard API connected via: ${baseUrl}`);
        }
        
        return response.json();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Backboard request to ${baseUrl} failed:`, (error as Error).message);
        // Continue to try next URL
      }
    }
    
    // All URLs failed - retry with exponential backoff
    if (retries < this.maxRetries) {
      console.warn(`All Backboard URLs failed (attempt ${retries + 1}/${this.maxRetries}), retrying...`);
      this.workingBaseUrl = null; // Reset to try all URLs again
      await new Promise(r => setTimeout(r, 1000 * (retries + 1)));
      return this.request(endpoint, options, retries + 1);
    }
    
    throw lastError;
  }

  async createAssistant(name: string, systemPrompt: string, tools?: any[]): Promise<{ assistant_id: string }> {
    return this.request('/assistants', {
      method: 'POST',
      body: JSON.stringify({
        name,
        system_prompt: systemPrompt,
        tools: tools || [],
      }),
    });
  }

  async getAssistant(assistantId: string): Promise<{ assistant_id: string; name: string } | null> {
    try {
      return await this.request(`/assistants/${assistantId}`);
    } catch {
      return null;
    }
  }

  async createThread(assistantId: string): Promise<BackboardThread> {
    return this.request('/threads', {
      method: 'POST',
      body: JSON.stringify({ assistant_id: assistantId }),
    });
  }

  async getThread(threadId: string): Promise<BackboardThread | null> {
    try {
      return await this.request(`/threads/${threadId}`);
    } catch {
      return null;
    }
  }

  async addMessage(
    threadId: string,
    content: string,
    options: {
      llmProvider?: string;
      modelName?: string;
      stream?: boolean;
    } = {}
  ): Promise<BackboardResponse> {
    return this.request(`/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        llm_provider: options.llmProvider || 'anthropic',
        model_name: options.modelName || 'claude-sonnet-4-20250514',
        stream: options.stream ?? false,
      }),
    });
  }

  async addMessageStreaming(
    threadId: string,
    content: string,
    options: {
      llmProvider?: string;
      modelName?: string;
    } = {}
  ): Promise<Response> {
    // Use working URL if known, otherwise try primary URL
    const baseUrl = this.workingBaseUrl || BACKBOARD_API_URLS[0];
    
    const response = await fetch(`${baseUrl}/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        llm_provider: options.llmProvider || 'anthropic',
        model_name: options.modelName || 'claude-sonnet-4-20250514',
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Backboard API error: ${response.status} - ${error}`);
    }

    return response;
  }

  async getMessages(threadId: string): Promise<BackboardMessage[]> {
    const response = await this.request(`/threads/${threadId}/messages`);
    return response.messages || [];
  }

  // Sync a message to Backboard for memory with retry logic (blocking)
  async syncMessage(threadId: string, role: 'user' | 'assistant', content: string): Promise<boolean> {
    try {
      await this.request(`/threads/${threadId}/messages/sync`, {
        method: 'POST',
        body: JSON.stringify({ role, content }),
      });
      return true;
    } catch (error) {
      console.error('Backboard memory sync failed after retries:', error);
      return false;
    }
  }
  
  // Batch sync multiple messages at once
  async syncMessages(threadId: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<boolean> {
    try {
      for (const msg of messages) {
        await this.syncMessage(threadId, msg.role, msg.content);
      }
      return true;
    } catch (error) {
      console.error('Backboard batch sync failed:', error);
      return false;
    }
  }
}

export function createBackboardClient(): BackboardClient | null {
  const apiKey = Deno.env.get('BACKBOARD_API_KEY');
  if (!apiKey) {
    console.log('BACKBOARD_API_KEY not configured - persistent memory disabled');
    return null;
  }
  return new BackboardClient(apiKey);
}

// Helper to get or create a Backboard thread for a user + optional customer
export async function getOrCreateBackboardThread(
  supabase: any,
  profileId: string,
  contextType: string = 'general',
  customerId: string | null = null
): Promise<{ threadId: string; assistantId: string } | null> {
  const backboard = createBackboardClient();
  if (!backboard) return null;

  try {
    // Check for existing thread with customer context
    let query = supabase
      .from('backboard_threads')
      .select('thread_id, assistant_id')
      .eq('profile_id', profileId)
      .eq('context_type', contextType);
    
    // Handle customer_id matching (NULL = general thread)
    if (customerId) {
      query = query.eq('customer_id', customerId);
    } else {
      query = query.is('customer_id', null);
    }
    
    const { data: existingThread } = await query.single();

    if (existingThread) {
      // Verify thread still exists in Backboard
      const thread = await backboard.getThread(existingThread.thread_id);
      if (thread) {
        return {
          threadId: existingThread.thread_id,
          assistantId: existingThread.assistant_id,
        };
      }
      // Thread doesn't exist in Backboard - delete stale record
      await supabase
        .from('backboard_threads')
        .delete()
        .eq('thread_id', existingThread.thread_id);
    }

    // Create new assistant and thread
    const assistantName = customerId 
      ? `Jericho-${contextType}-${profileId.substring(0, 8)}-${customerId.substring(0, 8)}`
      : `Jericho-${contextType}-${profileId.substring(0, 8)}-general`;
    
    const assistant = await backboard.createAssistant(
      assistantName,
      getJerichoSystemPrompt(contextType, !!customerId)
    );

    const thread = await backboard.createThread(assistant.assistant_id);

    // Store mapping with customer context
    await supabase.from('backboard_threads').insert({
      profile_id: profileId,
      context_type: contextType,
      assistant_id: assistant.assistant_id,
      thread_id: thread.thread_id,
      customer_id: customerId,
    });

    console.log('Created new Backboard thread:', thread.thread_id, customerId ? `for customer ${customerId}` : '(general)');
    return {
      threadId: thread.thread_id,
      assistantId: assistant.assistant_id,
    };
  } catch (error) {
    console.error('Failed to get/create Backboard thread:', error);
    return null;
  }
}

// Load messages from Backboard thread for context injection
export async function loadBackboardMemory(
  threadId: string,
  maxMessages: number = 50
): Promise<BackboardMessage[]> {
  const backboard = createBackboardClient();
  if (!backboard) return [];
  
  try {
    const messages = await backboard.getMessages(threadId);
    return messages.slice(-maxMessages);
  } catch (error) {
    console.error('Failed to load Backboard memory:', error);
    return [];
  }
}

// Format Backboard memory for inclusion in LLM prompt
export function formatBackboardMemoryForPrompt(messages: BackboardMessage[]): string {
  if (!messages || messages.length === 0) return '';
  
  const formatted = messages.map(m => 
    `${m.role === 'user' ? 'User' : 'Jericho'}: ${m.content}`
  ).join('\n\n');
  
  return `\n**YOUR MEMORY OF THIS CONVERSATION:**\n${formatted}\n`;
}

function getJerichoSystemPrompt(contextType: string, isCustomerSpecific: boolean): string {
  const basePrompt = `You are Jericho, an AI sales coach with perfect memory. You remember everything about this user across all conversations.

Your role is to:
1. Remember personal details, preferences, and past conversations
2. Track goals, achievements, and challenges over time
3. Provide personalized coaching based on accumulated knowledge
4. Notice patterns and provide insights about growth
5. Never forget important customer details or commitments

Always maintain context from previous conversations. Reference past discussions naturally.`;

  if (contextType === 'sales' && isCustomerSpecific) {
    return `${basePrompt}

You are focused on a SPECIFIC CUSTOMER RELATIONSHIP:
- Remember every detail about this customer
- Track all commitments, preferences, and history discussed
- Recall previous strategies and outcomes
- Maintain relationship continuity across sessions
- If asked "where did we leave off", recall the last topics discussed`;
  }
  
  if (contextType === 'sales') {
    return `${basePrompt}

You are specifically focused on general sales coaching:
- Track sales goals and pipeline progress
- Provide sales-specific coaching and advice
- Remember general sales strategies discussed
- When no specific customer is selected, provide broad guidance`;
  }

  return basePrompt;
}
