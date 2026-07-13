import { createClient, type RedisClientType } from 'redis';

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  ping(): Promise<boolean>;
}

export type RedisHealth = {
  status: 'ok' | 'disabled' | 'unavailable';
  latencyMs: number | null;
};

type RedisClient = RedisClientType;

type RedisConnectionState = {
  client: RedisClient | undefined;
  connecting: Promise<RedisClient> | undefined;
  url: string | undefined;
};

const redisGlobal = globalThis as typeof globalThis & {
  __apple333RedisConnection?: RedisConnectionState;
};

function configuredRedisUrl(): string | undefined {
  const value = process.env.REDIS_URL?.trim();
  return value || undefined;
}

function connectionState(): RedisConnectionState {
  redisGlobal.__apple333RedisConnection ??= {
    client: undefined,
    connecting: undefined,
    url: undefined
  };
  return redisGlobal.__apple333RedisConnection;
}

async function redisClient(): Promise<RedisClient> {
  const url = configuredRedisUrl();
  if (!url) {
    throw new Error('REDIS_NOT_CONFIGURED');
  }

  const state = connectionState();
  if (state.client && state.url === url) {
    if (state.client.isOpen) {
      return state.client;
    }
    if (state.connecting) {
      return state.connecting;
    }
  } else {
    if (state.client?.isOpen) {
      state.client.disconnect();
    }
    state.client = undefined;
    state.connecting = undefined;
    state.url = url;
  }

  const client = state.client ?? createClient({
    url,
    socket: {
      connectTimeout: 1_500,
      reconnectStrategy: false
    }
  });

  // Redis errors are handled by the caller. Registering this listener prevents
  // Node from treating a transient socket error as an unhandled EventEmitter error.
  client.on('error', () => undefined);
  state.client = client;
  state.connecting = client.connect()
    .then(() => client)
    .finally(() => {
      state.connecting = undefined;
    });

  try {
    return await state.connecting;
  } catch (error) {
    if (state.client === client && !client.isOpen) {
      state.client = undefined;
    }
    throw error;
  }
}

export async function checkRedisHealth(): Promise<RedisHealth> {
  if (!configuredRedisUrl()) {
    return { status: 'disabled', latencyMs: null };
  }

  const startedAt = performance.now();
  try {
    const response = await (await redisClient()).ping();
    return {
      status: response === 'PONG' ? 'ok' : 'unavailable',
      latencyMs: Math.round((performance.now() - startedAt) * 100) / 100
    };
  } catch {
    return {
      status: 'unavailable',
      latencyMs: Math.round((performance.now() - startedAt) * 100) / 100
    };
  }
}

class EnvironmentCache implements Cache {
  async get(key: string): Promise<string | null> {
    if (!configuredRedisUrl()) {
      return null;
    }
    return (await redisClient()).get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!configuredRedisUrl()) {
      return;
    }
    await (await redisClient()).set(key, value, { EX: ttlSeconds });
  }

  async ping(): Promise<boolean> {
    return (await checkRedisHealth()).status === 'ok';
  }
}

export const cache: Cache = new EnvironmentCache();
