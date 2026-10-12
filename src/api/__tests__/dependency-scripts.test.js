/* global __dirname, test, expect, jest */
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '../../..');

test('scripts use installed tools without installation fallbacks', () => {
  const { scripts, devDependencies } = JSON.parse(
    readFileSync(path.join(root, 'package.json'), 'utf8'),
  );
  for (const script of Object.values(scripts)) {
    expect(script).not.toMatch(/\bnpm\s+(?:install|ci)\b/);
    expect(script).not.toMatch(/\bnpx\s+(?!--no-install\b)/);
  }
  // Expo lint can install missing prerequisites; use the local tool directly.
  expect(scripts.lint).toBe('eslint .');
  expect(devDependencies.eslint).toBeDefined();
});

test('contract sync isolates npm pack and disables lifecycle scripts', () => {
  const temporary = path.join(root, '.cache/wardby-api-test');
  const contract = readFileSync(path.join(root, 'src/api/openapi.yml'));
  const execFileSync = jest.fn((command) =>
    command === 'npm' ? JSON.stringify([{ filename: 'cli.tgz' }]) : undefined,
  );
  const writeFileSync = jest.fn();
  const rmSync = jest.fn();
  vm.runInNewContext(readFileSync(path.join(root, 'src/api/sync-contract.cjs'), 'utf8'), {
    __dirname: path.join(root, 'src/api'),
    require: (name) => {
      if (name === 'node:child_process') return { execFileSync };
      if (name === 'node:fs')
        return {
          mkdirSync: jest.fn(),
          mkdtempSync: () => temporary,
          readFileSync: () => contract,
          writeFileSync,
          rmSync,
        };
      return require(name);
    },
  });
  expect(execFileSync).toHaveBeenCalledWith(
    'npm',
    ['pack', '@wardby/cli@0.6.0', '--json', '--ignore-scripts', '--pack-destination', temporary],
    { cwd: temporary, encoding: 'utf8' },
  );
  expect(execFileSync).toHaveBeenCalledTimes(2);
  expect(writeFileSync).toHaveBeenCalledTimes(1);
  expect(writeFileSync).toHaveBeenCalledWith(path.join(root, 'src/api/openapi.yml'), contract);
  expect(rmSync).toHaveBeenCalledWith(temporary, { recursive: true, force: true });
});
