import test from 'node:test';
import assert from 'node:assert/strict';
import { autoMapCsvHeaders, parseCsvText, validateCsvRows } from './csvImport';
import { SEED_AREAS, SEED_CATEGORIES } from './seedData';

test('parseCsvText handles quoted commas, escaped quotes, and blank lines', () => {
  const csv = [
    'name_en,phone,category,area,address',
    '"Al-Madina Pharmacy, Plus","0300-8671234",pharmacy,rail-bazaar,"Shop 4, ""Main"" Market"',
    '',
    'Bismillah Bakers,068-5701122,restaurants,klp-road,KLP Road',
  ].join('\n');

  const rows = parseCsvText(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][0], 'Al-Madina Pharmacy, Plus');
  assert.equal(rows[1][4], 'Shop 4, "Main" Market');
  assert.equal(rows[2][0], 'Bismillah Bakers');
});

test('autoMapCsvHeaders maps flexible column header aliases cleanly', () => {
  const mapping = autoMapCsvHeaders([
    'Business Name',
    'Mobile Number',
    'Trade',
    'Chowk',
    'Urdu Name',
    'Unknown Col',
  ]);
  assert.equal(mapping[0].target, 'name_en');
  assert.equal(mapping[1].target, 'phone');
  assert.equal(mapping[2].target, 'category');
  assert.equal(mapping[3].target, 'area');
  assert.equal(mapping[4].target, 'name_ur');
  assert.equal(mapping[5].target, 'ignore');
});

test('validateCsvRows catches invalid rows and warns on duplicate phones', () => {
  const headers = ['name_en', 'phone', 'category', 'area'];
  const mappings = autoMapCsvHeaders(headers);
  const rows = [
    ['Valid Shop', '0300-1112233', 'pharmacy', 'rail-bazaar'],
    ['Duplicate Shop', '03001112233', 'pharmacy', 'klp-road'],
    ['', '12', 'unknown-cat', ''],
  ];

  const validated = validateCsvRows(rows, mappings, SEED_CATEGORIES, SEED_AREAS, ['923009998887']);
  assert.equal(validated[0].isValid, true);
  assert.equal(validated[0].warnings.length, 0);

  assert.equal(validated[1].isValid, true);
  assert.ok(validated[1].warnings.some((w) => w.includes('Duplicate phone')));

  assert.equal(validated[2].isValid, false);
  assert.ok(validated[2].errors.some((e) => e.includes('Missing business name')));
  assert.ok(validated[2].errors.some((e) => e.includes('Invalid or missing phone')));
});
