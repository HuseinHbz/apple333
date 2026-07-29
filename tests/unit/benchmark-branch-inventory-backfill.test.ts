import { describe, expect, it } from 'vitest';

import {
  parseBenchmarkProjectionBackfillArguments,
  planBenchmarkProjectionBackfill,
} from '../../scripts/backfill-benchmark-branch-inventory.mjs';

describe('benchmark BranchInventory projection backfill', () => {
  it('parses a read-only preview and an explicit apply request', () => {
    expect(parseBenchmarkProjectionBackfillArguments(['--run-id', 'phase0611-10k-20260729'])).toEqual({
      help: false,
      runId: 'phase0611-10k-20260729',
      apply: false,
    });
    expect(parseBenchmarkProjectionBackfillArguments(['--run-id', 'phase0611-10k-20260729', '--apply'])).toEqual({
      help: false,
      runId: 'phase0611-10k-20260729',
      apply: true,
    });
    expect(() => parseBenchmarkProjectionBackfillArguments(['--apply'])).toThrow('Use --run-id');
  });

  it('creates only missing projections and refuses conflicting ones', () => {
    const canonical = [
      { branchId: 'branch-a', variantId: 'variant-a', onHand: 4, reserved: 1 },
      { branchId: 'branch-b', variantId: 'variant-b', onHand: 8, reserved: 0 },
    ];
    const plan = planBenchmarkProjectionBackfill(canonical, [
      { branchId: 'branch-a', variantId: 'variant-a', onHand: 4, reserved: 1 },
    ]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.missing).toEqual([{ branchId: 'branch-b', variantId: 'variant-b', onHand: 8, reserved: 0 }]);

    const conflict = planBenchmarkProjectionBackfill(canonical, [
      { branchId: 'branch-a', variantId: 'variant-a', onHand: 3, reserved: 1 },
      { branchId: 'branch-b', variantId: 'variant-b', onHand: 8, reserved: 0 },
    ]);
    expect(conflict.missing).toEqual([]);
    expect(conflict.conflicts).toHaveLength(1);
    expect(conflict.conflicts[0]).toMatchObject({ branchId: 'branch-a', variantId: 'variant-a' });
  });
});
