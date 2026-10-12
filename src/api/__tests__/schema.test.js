/* global __dirname, test, expect */
/** @jest-environment node */
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

// Run the programmatic generator in Node: its ESM dependencies need Node's
// module loader rather than Jest 29's CommonJS dependency loader.
test('generated schema matches the pinned contract', () => {
  const generated = execFileSync(
    process.execPath,
    ['-e', "require('./generate-schema.cjs').generateSchema().then(s => process.stdout.write(s))"],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' },
  );
  expect(readFileSync(path.join(__dirname, '../schema.ts'), 'utf8')).toBe(generated);
});
