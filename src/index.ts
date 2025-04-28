// src/index.ts
import {
  logger,
  type Character,
  type IAgentRuntime,
  type Project,
  type ProjectAgent,
  type Plugin,
  ModelType,
  type GenerateTextParams,
} from '@elizaos/core';
import dotenv from 'dotenv';
import { z, ZodError } from 'zod';

dotenv.config();

// --- Local definition mimicking published @elizaos/plugin-livepeer-inference ---

// Define configuration schema based on published plugin (if validation needed locally)
const configSchema = z.object({
  LIVEPEER_GATEWAY_URL: z.string().optional(),
  LIVEPEER_API_KEY: z.string().optional(),
  LIVEPEER_MODEL: z.string().optional(),
  LIVEPEER_LARGE_MODEL: z.string().optional(),
  LIVEPEER_TEMPERATURE: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  LIVEPEER_MAX_TOKENS: z.string().optional().transform(val => val ? parseInt(val) : undefined),
});

type LivepeerConfig = z.infer<typeof configSchema>; // Define type if schema is used

// Copy callLivepeerLLM function logic from published plugin
async function callLivepeerLLM(
  runtime: IAgentRuntime,
  {
    prompt,
    maxTokens = process.env.LIVEPEER_MAX_TOKENS ? parseInt(process.env.LIVEPEER_MAX_TOKENS) : 2048,
    temperature = process.env.LIVEPEER_TEMPERATURE ? parseFloat(process.env.LIVEPEER_TEMPERATURE) : 0.6,
  }: Pick<GenerateTextParams, 'prompt' | 'maxTokens' | 'temperature'> & {
    model?: string; // Optional model override, though published plugin logic uses env vars primarily
  }
): Promise<string> {
  const endpoint =
    process.env.LIVEPEER_GATEWAY_URL || runtime.getSetting('LIVEPEER_GATEWAY_URL');

  if (!endpoint) {
    throw new Error('Livepeer Gateway URL is not defined (LIVEPEER_GATEWAY_URL)');
  }

  // Use specific model if set in environment, otherwise use configurable model with fallback
  // Match published plugin logic
  const model =
    process.env.LIVEPEER_LARGE_MODEL ||
    process.env.LIVEPEER_MODEL ||
    'meta-llama/Meta-Llama-3.1-8B-Instruct'; // Match model fallback

  logger.info('Livepeer LLM Request:', {
    endpoint,
    model,
    systemPrompt: runtime.character.system || 'You are a helpful assistant powered by Livepeer Gateway',
    userPrompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
    maxTokens,
    temperature
  });

  const requestBody = {
    model,
    messages: [
      {
        role: 'system' as const, // Use 'as const' for type safety
        content:
          runtime.character.system ||
          'You are a helpful assistant powered by Livepeer Gateway',
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ],
    max_tokens: maxTokens,
    temperature,
    stream: false,
  } as Record<string, unknown>; // Match published plugin type assertion

  logger.info('Livepeer request body:', JSON.stringify(requestBody, null, 2));

  const res = await runtime.fetch(`${endpoint.replace(/\/$/, '')}/llm`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization:
        'Bearer ' +
        (process.env.LIVEPEER_API_KEY || runtime.getSetting('LIVEPEER_API_KEY') || 'ElizaV2-llm-default'), // Match published plugin token fallback
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('Livepeer request failed:', {
      status: res.status,
      statusText: res.statusText,
      responseText: text,
      requestBody: JSON.stringify(requestBody)
    });
    throw new Error(`Livepeer request failed (${res.status}): ${text}`);
  }

  const json: any = await res.json();
  logger.info('Livepeer response received:', {
    choices: json?.choices?.length,
    hasContent: !!json?.choices?.[0]?.message?.content // Check original path first
  });

  // Use logic from published plugin (check message.content first)
  let content = json?.choices?.[0]?.message?.content as string | undefined;

  // Add delta fallback check IF NEEDED later, start with published logic
  if (!content && json?.choices?.[0]?.delta?.content) {
    logger.warn('Falling back to delta.content for Livepeer response');
    content = json.choices[0].delta.content;
  }


  if (!content) {
    logger.error('Invalid response format from Livepeer (final check): ', json);
    throw new Error('Invalid response format from Livepeer');
  }

  // Match published plugin prefix removal
  return content.replace(/<\|start_header_id\|>assistant<\|end_header_id\|>\n\n/, '');
}

// Re-define the plugin locally, mimicking the published one
export const livepeerPlugin: Plugin = {
  name: 'plugin-livepeer-local', // Keep local name to distinguish
  description: 'Local Livepeer Gateway LLM provider matching published logic',
  config: {
    // Expose env vars similar to published plugin
    LIVEPEER_GATEWAY_URL: process.env.LIVEPEER_GATEWAY_URL,
    LIVEPEER_API_KEY: process.env.LIVEPEER_API_KEY,
    LIVEPEER_MODEL: process.env.LIVEPEER_MODEL,
    LIVEPEER_LARGE_MODEL: process.env.LIVEPEER_LARGE_MODEL,
    LIVEPEER_TEMPERATURE: process.env.LIVEPEER_TEMPERATURE,
    LIVEPEER_MAX_TOKENS: process.env.LIVEPEER_MAX_TOKENS,
  },
  async init(config: Partial<LivepeerConfig>) { // Use local config type
    logger.info('Initializing local Livepeer plugin (matching published config logic)...');
    // Simplified init matching general structure, less strict validation than before
    try {
      // Optionally add config validation if needed, like published plugin
      // const validatedConfig = configSchema.parse(config);
      // Optionally set process.env vars like the published plugin init does
      // for (const [key, value] of Object.entries(validatedConfig)) {
      //   if (value !== undefined) process.env[key] = String(value);
      // }
      logger.info('Local Livepeer plugin configuration processed (no validation/env setting).');
    } catch (error) {
      // Add error handling if validation is used
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        logger.error('Invalid Livepeer plugin configuration (local):', errorMessages);
        throw new Error(`Invalid Livepeer plugin configuration: ${errorMessages.join('; ')}`);
      }
      logger.error('Unknown error during local Livepeer plugin initialization:', error);
      throw error;
    }
  },
  models: {
    // Match published plugin model handlers
    [ModelType.TEXT_SMALL]: async (
      runtime,
      { prompt, maxTokens, temperature }: GenerateTextParams
    ) => {
      return await callLivepeerLLM(runtime, {
        prompt,
        maxTokens: maxTokens || (process.env.LIVEPEER_MAX_TOKENS ? parseInt(process.env.LIVEPEER_MAX_TOKENS) : 512),
        temperature: temperature || (process.env.LIVEPEER_TEMPERATURE ? parseFloat(process.env.LIVEPEER_TEMPERATURE) : 0.6)
      });
    },
    [ModelType.TEXT_LARGE]: async (
      runtime,
      { prompt, maxTokens, temperature }: GenerateTextParams
    ) => {
      return await callLivepeerLLM(runtime, {
        prompt,
        maxTokens: maxTokens || (process.env.LIVEPEER_MAX_TOKENS ? parseInt(process.env.LIVEPEER_MAX_TOKENS) : 2048),
        temperature: temperature || (process.env.LIVEPEER_TEMPERATURE ? parseFloat(process.env.LIVEPEER_TEMPERATURE) : 0.6)
      });
    },
    [ModelType.TEXT_EMBEDDING]: async (
      _runtime: IAgentRuntime,
      params: import('@elizaos/core').TextEmbeddingParams | string | null
    ): Promise<number[]> => {
      // Copy embedding logic from published plugin
      const DIMS = 384;
      if (!params || (typeof params === 'object' && !('text' in params))) {
        return new Array(DIMS).fill(0);
      }
      const text = typeof params === 'string' ? params : params.text ?? '';
      if (!text.trim()) {
        return new Array(DIMS).fill(0);
      }
      const vec = new Array(DIMS).fill(0);
      for (let i = 0; i < text.length; i++) {
        const idx = i % DIMS;
        vec[idx] += text.charCodeAt(i) / 65535;
      }
      logger.debug('Generated placeholder embedding (local, matched): ', text.substring(0, 50));
      return vec;
    },
    // NO OBJECT_SMALL or OBJECT_LARGE handlers, matching published plugin
  },
  // Keep other properties minimal unless needed
  actions: [],
  providers: [],
  services: [],
  events: {},
  tests: [],
  routes: [],
};

// --- End of Local Plugin Definition ---


// --- Start of Original Project Code ---

/**
 * Represents the default character (Eliza) with her specific attributes and behaviors.
 */
export const character: Character = {
  name: 'Eliza',
  plugins: [
    // Standard plugins (list by name/path for runtime loading)
    '@elizaos/plugin-sql',
    ...(process.env.OPENAI_API_KEY ? ['@elizaos/plugin-openai'] : []),
    ...(process.env.ANTHROPIC_API_KEY ? ['@elizaos/plugin-anthropic'] : []),
    ...(!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.LIVEPEER_GATEWAY_URL
      ? ['@elizaos/plugin-local-ai']
      : []),
    ...(process.env.DISCORD_API_TOKEN ? ['@elizaos/plugin-discord'] : []),
    ...(process.env.TWITTER_USERNAME ? ['@elizaos/plugin-twitter'] : []),
    ...(process.env.TELEGRAM_BOT_TOKEN ? ['@elizaos/plugin-telegram'] : []),
    ...(!process.env.IGNORE_BOOTSTRAP ? ['@elizaos/plugin-bootstrap'] : []),
    // No need to list livepeer here, loaded via projectAgent below
  ],
  settings: {
    secrets: {}, // Keep secrets config if needed
    // Add Livepeer settings here if you want them configurable via runtime settings UI
    // LIVEPEER_GATEWAY_URL: process.env.LIVEPEER_GATEWAY_URL,
    // LIVEPEER_API_KEY: process.env.LIVEPEER_API_KEY,
    // LIVEPEER_MODEL: process.env.LIVEPEER_MODEL,
    // LIVEPEER_LARGE_MODEL: process.env.LIVEPEER_LARGE_MODEL,
  },
  system:
    'You are a helpful community manager named Eliza. Focus on community-related tasks like welcoming users and addressing concerns. Be concise and direct.', // Simplified system prompt
  bio: [
    'Stays out of the way of the her teammates and only responds when specifically asked',
    // 'Ignores messages that are not relevant to the community manager', // Commented out
    'Keeps responses short',
    'Thinks most problems need less validation and more direction',
    'Uses silence as effectively as words',
    "Only asks for help when it's needed",
    'Only offers help when asked',
    'Only offers commentary when it is appropriate, i.e. when asked',
  ],
  messageExamples: [
    // ... (messageExamples remain the same)
    [
      {
        name: '{{name1}}',
        content: {
          text: 'This user keeps derailing technical discussions with personal problems.',
        },
      },
      {
        name: 'Eliza',
        content: {
          text: 'DM them. Sounds like they need to talk about something else.',
        },
      },
      {
        name: '{{name1}}',
        content: {
          text: 'I tried, they just keep bringing drama back to the main channel.',
        },
      },
      {
        name: 'Eliza',
        content: {
          text: "Send them my way. I've got time today.",
        },
      },
    ],
    // ... include all other message examples ...
    [
      {
        name: '{{name1}}',
        content: {
          text: "I'll draft a clean announcement focused on capabilities and vision. Send me the team details and I'll have something for review in 30.",
        },
      },
      {
        name: 'Eliza',
        content: {
          text: '',
          actions: ['IGNORE'],
        },
      },
    ],
  ],
  style: {
    // ... (style remains the same)
    all: [
      'Keep it short, one line when possible',
      'No therapy jargon or coddling',
      'Say more by saying less',
      'Make every word count',
      // 'Use humor to defuse tension', // Maybe too much for now
      'End with questions that matter',
      // 'Let silence do the heavy lifting',
      // 'Ignore messages that are not relevant to the community manager', // Commented out
      'Be kind but firm with community members',
      'Keep it very brief and only share relevant details',
      // 'Ignore messages addressed to other people.', // Commented out
    ],
    chat: [
      "Don't be annoying or verbose",
      // 'Only say something if you have something to say',
      // "Focus on your job, don't be chatty",
      // "Only respond when it's relevant to you or your job", // Commented out
    ],
  },
};

const initCharacter = async (runtime: IAgentRuntime): Promise<void> => {
  logger.info('Initializing character defined in index.ts');
  logger.info('Name: ', character.name);
  // Potentially initialize settings if needed
  // runtime.applySettings(character.settings);
};

export const projectAgent: ProjectAgent = {
  character, // Include the character definition
  init: initCharacter,
  // List the actual Plugin *objects* this agent uses.
  plugins: [
    // Load the LOCAL livepeer plugin object conditionally
    ...(process.env.LIVEPEER_GATEWAY_URL ? [livepeerPlugin] : []),
    // If other plugin *objects* are needed directly by the agent, import and add them here.
  ],
};

const project: Project = {
  agents: [projectAgent],
};

export default project; // Export the project definition

// # sourceMappingURL=index.js.map // Optional: Keep or remove sourcemap comment