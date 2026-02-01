// Backboard.io client for persistent memory

const BACKBOARD_API_URL = 'https://api.backboard.io/v1';

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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${BACKBOARD_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Backboard API error: ${response.status} - ${error}`);
    }

    return response.json();
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
    const response = await fetch(`${BACKBOARD_API_URL}/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
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

  // Sync a message to Backboard for memory (fire and forget pattern)
  async syncMessage(threadId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    try {
      // For memory sync, we just add the message without expecting a response
      await this.request(`/threads/${threadId}/messages/sync`, {
        method: 'POST',
        body: JSON.stringify({ role, content }),
      });
    } catch (error) {
      // Log but don't throw - memory sync is best-effort
      console.warn('Backboard memory sync failed:', error);
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

// Helper to get or create a Backboard thread for a user
export async function getOrCreateBackboardThread(
  supabase: any,
  profileId: string,
  contextType: string = 'general'
): Promise<{ threadId: string; assistantId: string } | null> {
  const backboard = createBackboardClient();
  if (!backboard) return null;

  try {
    // Check for existing thread
    const { data: existingThread } = await supabase
      .from('backboard_threads')
      .select('thread_id, assistant_id')
      .eq('profile_id', profileId)
      .eq('context_type', contextType)
      .single();

    if (existingThread) {
      // Verify thread still exists in Backboard
      const thread = await backboard.getThread(existingThread.thread_id);
      if (thread) {
        return {
          threadId: existingThread.thread_id,
          assistantId: existingThread.assistant_id,
        };
      }
    }

    // Create new assistant and thread
    const assistant = await backboard.createAssistant(
      `Jericho-${contextType}-${profileId.substring(0, 8)}`,
      getJerichoSystemPrompt(contextType)
    );

    const thread = await backboard.createThread(assistant.assistant_id);

    // Store mapping
    await supabase.from('backboard_threads').upsert({
      profile_id: profileId,
      context_type: contextType,
      assistant_id: assistant.assistant_id,
      thread_id: thread.thread_id,
    });

    console.log('Created new Backboard thread:', thread.thread_id);
    return {
      threadId: thread.thread_id,
      assistantId: assistant.assistant_id,
    };
  } catch (error) {
    console.error('Failed to get/create Backboard thread:', error);
    return null;
  }
}

function getJerichoSystemPrompt(contextType: string): string {
  const basePrompt = `You are Jericho, an AI career coach with perfect memory. You remember everything about this user across all conversations.

Your role is to:
1. Remember personal details, preferences, and past conversations
2. Track goals, achievements, and challenges over time
3. Provide personalized coaching based on accumulated knowledge
4. Notice patterns and provide insights about growth

Always maintain context from previous conversations. Reference past discussions naturally.`;

  if (contextType === 'sales') {
    return `${basePrompt}

You are specifically focused on sales coaching:
- Remember customer relationships and deal histories
- Track sales goals and pipeline progress
- Recall previous customer interactions and strategies
- Provide sales-specific coaching and advice`;
  }

  return basePrompt;
}
