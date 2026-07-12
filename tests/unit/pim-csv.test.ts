import { describe, expect, it } from 'vitest';

import { parsePimCsv } from '@/modules/pim/csv';

describe('PIM CSV staging parser', () => {
  it('parses quoted fields as inert strings and preserves headers', () => {
    expect(parsePimCsv('name,slug,summary\n"iPhone, Pro",iphone-pro,"=HYPERLINK(""https://example.test"")"\n')).toEqual([
      { name: 'iPhone, Pro', slug: 'iphone-pro', summary: '=HYPERLINK("https://example.test")' },
    ]);
  });

  it('rejects malformed quoting, duplicate headers, and row shape drift', () => {
    expect(() => parsePimCsv('name,slug\n"iPhone,iphone\n')).toThrow('CSV_UNTERMINATED_QUOTE');
    expect(() => parsePimCsv('name,name\niPhone,iPhone\n')).toThrow('CSV_INVALID_HEADER');
    expect(() => parsePimCsv('name,slug\niPhone\n')).toThrow('CSV_COLUMN_COUNT_MISMATCH');
  });

  it('enforces the requested row bound', () => {
    expect(() => parsePimCsv('name\na\nb\n', 1)).toThrow('CSV_ROW_LIMIT_EXCEEDED');
  });
});
