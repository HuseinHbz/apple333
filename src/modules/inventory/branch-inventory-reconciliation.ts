export type ReconciliationTimestamp = Date | string | null | undefined;

export type CanonicalBranchInventoryBalance = Readonly<{
  branchId: string;
  variantId: string;
  onHand: number;
  reserved: number;
  updatedAt?: ReconciliationTimestamp;
  skuIds?: readonly string[];
}>;

export type LegacyBranchInventoryBalance = Readonly<{
  branchId: string;
  variantId: string;
  onHand: number;
  reserved: number;
  updatedAt?: ReconciliationTimestamp;
}>;

export type BranchInventoryDriftKind =
  | 'DUPLICATE_CANONICAL'
  | 'DUPLICATE_PROJECTION'
  | 'MISSING_CANONICAL'
  | 'MISSING_PROJECTION'
  | 'SKU_DRIFT'
  | 'ON_HAND_DRIFT'
  | 'RESERVED_DRIFT'
  | 'STALE_PROJECTION';

export type BranchInventoryDrift = Readonly<{
  kind: BranchInventoryDriftKind;
  branchId: string;
  variantId: string;
  canonical?: CanonicalBranchInventoryBalance;
  projection?: LegacyBranchInventoryBalance;
  detail: string;
}>;

export type BranchInventoryReconciliationResult = Readonly<{
  canonicalCount: number;
  projectionCount: number;
  drift: readonly BranchInventoryDrift[];
  isReconciled: boolean;
}>;

function keyOf(record: Readonly<{ branchId: string; variantId: string }>): string {
  return `${record.branchId}\u001f${record.variantId}`;
}

function parseTimestamp(value: ReconciliationTimestamp): number | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function groupByKey<T extends Readonly<{ branchId: string; variantId: string }>>(records: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const key = keyOf(record);
    const values = groups.get(key) ?? [];
    values.push(record);
    groups.set(key, values);
  }
  return groups;
}

function describeSkus(record: CanonicalBranchInventoryBalance): string {
  const skuIds = [...new Set(record.skuIds ?? [])].sort();
  return skuIds.length === 0 ? 'no source SKU identifiers' : `source SKU identifiers: ${skuIds.join(', ')}`;
}

/**
 * Compares the canonical sellable aggregate with the BranchInventory
 * transactional projection. The canonical query retains physical source keys
 * but contributes only active STORAGE/PICKUP balances; receiving, quarantine,
 * and damaged inventory deliberately reconcile as zero sellable stock. The
 * function is side-effect-free so it can be used by a read-only runtime
 * reconciliation command and deterministic unit tests.
 */
export function reconcileBranchInventory(
  canonicalBalances: readonly CanonicalBranchInventoryBalance[],
  projectionBalances: readonly LegacyBranchInventoryBalance[],
): BranchInventoryReconciliationResult {
  const canonicalGroups = groupByKey(canonicalBalances);
  const projectionGroups = groupByKey(projectionBalances);
  const keys = new Set([...canonicalGroups.keys(), ...projectionGroups.keys()]);
  const drift: BranchInventoryDrift[] = [];

  for (const key of [...keys].sort()) {
    const canonicalGroup = canonicalGroups.get(key) ?? [];
    const projectionGroup = projectionGroups.get(key) ?? [];
    const representative = canonicalGroup[0] ?? projectionGroup[0];
    if (!representative) continue;

    const duplicateCanonical = canonicalGroup[0];
    const duplicateProjection = projectionGroup[0];
    if (canonicalGroup.length > 1 && duplicateCanonical) {
      drift.push({
        kind: 'DUPLICATE_CANONICAL',
        branchId: representative.branchId,
        variantId: representative.variantId,
        canonical: duplicateCanonical,
        detail: `Canonical aggregate returned ${canonicalGroup.length} rows for one branch/variant key.`,
      });
    }
    if (projectionGroup.length > 1 && duplicateProjection) {
      drift.push({
        kind: 'DUPLICATE_PROJECTION',
        branchId: representative.branchId,
        variantId: representative.variantId,
        projection: duplicateProjection,
        detail: `BranchInventory returned ${projectionGroup.length} rows for one branch/variant key.`,
      });
    }

    const canonical = canonicalGroup[0];
    const projection = projectionGroup[0];
    if (!canonical && projection) {
      drift.push({
        kind: 'MISSING_CANONICAL',
        branchId: projection.branchId,
        variantId: projection.variantId,
        projection,
        detail: 'BranchInventory has a row without canonical inventory evidence.',
      });
      continue;
    }
    if (canonical && !projection) {
      drift.push({
        kind: 'MISSING_PROJECTION',
        branchId: canonical.branchId,
        variantId: canonical.variantId,
        canonical,
        detail: 'Canonical sellable aggregate has no matching BranchInventory row.',
      });
      drift.push({
        kind: 'SKU_DRIFT',
        branchId: canonical.branchId,
        variantId: canonical.variantId,
        canonical,
        detail: `The compatibility projection is missing the variant represented by ${describeSkus(canonical)}.`,
      });
      continue;
    }
    if (!canonical || !projection) continue;

    if (canonical.onHand !== projection.onHand) {
      drift.push({
        kind: 'ON_HAND_DRIFT',
        branchId: canonical.branchId,
        variantId: canonical.variantId,
        canonical,
        projection,
        detail: `onHand differs: canonical=${canonical.onHand}, projection=${projection.onHand}.`,
      });
    }
    if (canonical.reserved !== projection.reserved) {
      drift.push({
        kind: 'RESERVED_DRIFT',
        branchId: canonical.branchId,
        variantId: canonical.variantId,
        canonical,
        projection,
        detail: `reserved differs: canonical=${canonical.reserved}, projection=${projection.reserved}.`,
      });
    }

    const canonicalTimestamp = parseTimestamp(canonical.updatedAt);
    const projectionTimestamp = parseTimestamp(projection.updatedAt);
    if (canonicalTimestamp !== null && projectionTimestamp !== null && projectionTimestamp < canonicalTimestamp) {
      drift.push({
        kind: 'STALE_PROJECTION',
        branchId: canonical.branchId,
        variantId: canonical.variantId,
        canonical,
        projection,
        detail: 'BranchInventory updatedAt predates the canonical sellable aggregate.',
      });
    }
  }

  return {
    canonicalCount: canonicalBalances.length,
    projectionCount: projectionBalances.length,
    drift,
    isReconciled: drift.length === 0,
  };
}
