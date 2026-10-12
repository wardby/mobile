/* global __dirname */
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const path = require('node:path');

const CLI_VERSION = '0.6.0';
const cache = path.join(__dirname, '../../.cache');
mkdirSync(cache, { recursive: true });
const temporary = mkdtempSync(path.join(cache, 'wardby-api-'));
try {
  const packed = JSON.parse(
    execFileSync(
      'npm',
      [
        'pack',
        `@wardby/cli@${CLI_VERSION}`,
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        temporary,
      ],
      { cwd: temporary, encoding: 'utf8' },
    ),
  );
  execFileSync('tar', [
    '-xzf',
    path.join(temporary, (Array.isArray(packed) ? packed[0] : packed['@wardby/cli']).filename),
    '-C',
    temporary,
    'package/docs/viewer-api.openapi.yml',
  ]);
  writeFileSync(
    path.join(__dirname, 'openapi.yml'),
    readFileSync(path.join(temporary, 'package/docs/viewer-api.openapi.yml')),
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
