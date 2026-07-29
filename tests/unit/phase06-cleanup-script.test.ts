import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Phase 06.1 cleanup script', () => {
  it('requires ownership verification and an explicit destructive acknowledgement', () => {
    const source = readFileSync(resolve('scripts/cleanup-phase06-test-environment.mjs'), 'utf8');

    expect(source).toContain("'com.apple333.owner': 'phase-06.1'");
    expect(source).toContain("'com.apple333.disposable': 'true'");
    expect(source).toContain("resource.kind === 'container' ? '{{json .Config.Labels}}' : '{{json .Labels}}'");
    expect(source).toContain('DELETE_OWNED_PHASE06_RESOURCES');
    expect(source).toContain("'--destroy-owned'");
    expect(source).toContain("'down', '--volumes'");
    expect(source).not.toContain('--remove-orphans');
  });
});
