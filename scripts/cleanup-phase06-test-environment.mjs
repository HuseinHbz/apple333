import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateInventoryTestEnvironment } from './verify-inventory-test-environment.mjs';

const COMPOSE_FILE = 'docker-compose.inventory-test.yml';
const ENV_FILE = '.env.inventory-test';
const CONFIRMATION = 'DELETE_OWNED_PHASE06_RESOURCES';
const ownedResources = [
  { kind: 'container', name: 'apple333-phase06-redis' },
  { kind: 'container', name: 'apple333-phase06-postgres' },
  { kind: 'volume', name: 'apple333_phase06_test_postgres_data' },
  { kind: 'network', name: 'apple333_phase06_test_network' },
];
const requiredLabels = {
  'com.apple333.project': 'apple333',
  'com.apple333.owner': 'phase-06.1',
  'com.apple333.disposable': 'true',
};

export function parsePhase06CleanupArguments(argumentsList) {
  const argumentsSet = new Set(argumentsList.slice(2));
  for (const argument of argumentsSet) {
    if (!['--dry-run', '--destroy-owned'].includes(argument)) {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }
  if (argumentsSet.has('--dry-run') && argumentsSet.has('--destroy-owned')) {
    throw new Error('Use either --dry-run or --destroy-owned, not both.');
  }
  return { destroyOwned: argumentsSet.has('--destroy-owned') };
}

function invokeDocker(argumentsList, options = {}) {
  const result = spawnSync('docker', argumentsList, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw new Error(`Docker is required for Phase 06.1 cleanup: ${result.error.message}`);
  return result;
}

function readLabels(resource) {
  const template = resource.kind === 'container' ? '{{json .Config.Labels}}' : '{{json .Labels}}';
  const result = invokeDocker([resource.kind, 'inspect', resource.name, '--format', template], { capture: true });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (/No such (container|volume|network)|not found/i.test(output)) return null;
    throw new Error(`Unable to inspect ${resource.kind} ${resource.name}: ${output.trim()}`);
  }
  try {
    return JSON.parse(String(result.stdout).trim());
  } catch {
    throw new Error(`Unable to parse ownership labels for ${resource.kind} ${resource.name}.`);
  }
}

export function assertOwnedLabels(resource, labels) {
  for (const [key, value] of Object.entries(requiredLabels)) {
    if (labels?.[key] !== value) {
      throw new Error(`Refusing cleanup: ${resource.kind} ${resource.name} is missing the required ${key}=${value} ownership label.`);
    }
  }
}

function main() {
  const options = parsePhase06CleanupArguments(process.argv);
  const preflight = validateInventoryTestEnvironment(process.env);
  if (!preflight.ok) throw new Error(`Phase 06.1 cleanup preflight failed: ${preflight.errors.join(' ')}`);
  if (!existsSync(resolve(ENV_FILE))) {
    throw new Error(`Phase 06.1 cleanup requires ${ENV_FILE}; copy the checked-in example and keep it local.`);
  }

  const present = [];
  for (const resource of ownedResources) {
    const labels = readLabels(resource);
    if (!labels) {
      console.log(`Not present: ${resource.kind} ${resource.name}`);
      continue;
    }
    assertOwnedLabels(resource, labels);
    present.push(resource);
    console.log(`Owned disposable resource verified: ${resource.kind} ${resource.name}`);
  }

  if (!options.destroyOwned) {
    console.log(`Dry run complete. To remove only verified Phase 06.1 resources, set APPLE333_PHASE06_CLEANUP_ACK=${CONFIRMATION} and run with --destroy-owned.`);
    return;
  }
  if (process.env.APPLE333_PHASE06_CLEANUP_ACK !== CONFIRMATION) {
    throw new Error(`Refusing cleanup without APPLE333_PHASE06_CLEANUP_ACK=${CONFIRMATION}.`);
  }
  if (present.length === 0) {
    console.log('No owned Phase 06.1 Docker resources exist; nothing was removed.');
    return;
  }

  const compose = invokeDocker(['compose', '--env-file', ENV_FILE, '-f', COMPOSE_FILE, 'down', '--volumes']);
  if (compose.status !== 0) throw new Error('Docker Compose failed to remove the verified Phase 06.1 resources.');
  console.log('Removed only verified Phase 06.1 disposable Docker resources.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Phase 06.1 cleanup failed.');
    process.exitCode = 1;
  }
}
