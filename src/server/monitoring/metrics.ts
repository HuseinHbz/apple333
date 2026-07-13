import {
  collectDefaultMetrics,
  Gauge,
  Histogram,
  Registry
} from 'prom-client';

type CheckStatus = 'ok' | 'disabled' | 'unavailable';

type ReadinessSnapshot = {
  ready: boolean;
  checks: {
    configuration: CheckStatus;
    database: CheckStatus;
    redis: CheckStatus;
  };
};

type MetricsStore = {
  dependencyUp: Gauge<'dependency'>;
  readinessUp: Gauge;
  readinessDuration: Histogram<'route'>;
  registry: Registry;
};

const metricsGlobal = globalThis as typeof globalThis & {
  __apple333MetricsStore?: MetricsStore;
};

function metricsStore(): MetricsStore {
  if (metricsGlobal.__apple333MetricsStore) {
    return metricsGlobal.__apple333MetricsStore;
  }

  const registry = new Registry();
  collectDefaultMetrics({ prefix: 'apple333_process_', register: registry });

  const store: MetricsStore = {
    registry,
    readinessUp: new Gauge({
      name: 'apple333_readiness_up',
      help: 'Whether Apple333 is ready to receive application traffic.',
      registers: [registry]
    }),
    dependencyUp: new Gauge({
      name: 'apple333_dependency_up',
      help: 'Latest dependency readiness result, where 1 is healthy and 0 is unavailable or disabled.',
      labelNames: ['dependency'],
      registers: [registry]
    }),
    readinessDuration: new Histogram({
      name: 'apple333_readiness_duration_seconds',
      help: 'Duration of the readiness dependency probe.',
      labelNames: ['route'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [registry]
    })
  };

  metricsGlobal.__apple333MetricsStore = store;
  return store;
}

function up(status: CheckStatus): number {
  return status === 'ok' ? 1 : 0;
}

export function recordReadiness(snapshot: ReadinessSnapshot, durationMs: number): void {
  const store = metricsStore();
  store.readinessUp.set(snapshot.ready ? 1 : 0);
  store.dependencyUp.set({ dependency: 'configuration' }, up(snapshot.checks.configuration));
  store.dependencyUp.set({ dependency: 'database' }, up(snapshot.checks.database));
  store.dependencyUp.set({ dependency: 'redis' }, up(snapshot.checks.redis));
  store.readinessDuration.observe({ route: '/api/ready' }, durationMs / 1_000);
}

export function metricsContentType(): string {
  return metricsStore().registry.contentType;
}

export function collectMetrics(): Promise<string> {
  return metricsStore().registry.metrics();
}
