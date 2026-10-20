import './check-runtime.mjs';
import assert from 'node:assert/strict';
import {readFileSync, realpathSync, readdirSync, existsSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';

if (process.exitCode) process.exit(process.exitCode);
const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const manifest = readJson('package.json');
const baseline = readJson('toolchain.lock.json');
const expected = new Map(baseline.packages.map((entry) => [entry.name, entry]));
const settings = readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
const setting = (key) => new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm').exec(settings)?.[1];
assert.equal(setting('nodeVersion'), baseline.runtime.node.version, 'pnpm Node compatibility target drifted');
assert.equal(setting('engineStrict'), 'true', 'Strict engine checks must remain enabled');
assert.equal(setting('strictPeerDependencies'), 'true', 'Strict peer checks must remain enabled');
assert.equal(setting('runtimeOnFail'), 'error', 'pnpm must not silently substitute Node');
assert.equal(setting('pmOnFail'), 'error', 'pnpm must not silently substitute itself');
const direct = {...manifest.dependencies, ...manifest.devDependencies};
for (const [name, version] of Object.entries(direct)) {
  assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must have an exact stable pin`);
  assert.equal(version, expected.get(name)?.version, `${name} differs from the documented baseline`);
  assert.ok(expected.get(name)?.codexUsage, `${name} needs an explicit Codex usage`);
  assert.equal(readJson(`node_modules/${name}/package.json`).version, version, `${name} installed version drifted`);
}
assert.equal(Object.keys(direct).length, baseline.packages.filter((p) => ['runtime', 'development'].includes(p.kind)).length, 'Baseline/install package counts differ');
assert.equal(direct.react, direct['react-dom'], 'React and React DOM versions differ');

const singletons = ['react', 'react-dom', '@types/react', '@types/react-dom'];
let command = process.env.npm_execpath;
if (!command && process.platform === 'win32') command = path.join(readJson('.local/tooling.json').pnpmDirectory, 'node_modules', 'pnpm', 'pnpm.exe');
command ??= 'pnpm';
const args = ['list', ...singletons, '--depth', 'Infinity', '--json'];
const tree = JSON.parse(execFileSync(command.endsWith('.js') || command.endsWith('.cjs') ? process.execPath : command,
  command.endsWith('.js') || command.endsWith('.cjs') ? [command, ...args] : args,
  {cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024}));
const found = Object.fromEntries(singletons.map((name) => [name, {versions: new Set(), paths: new Set()}]));
function walk(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (found[key] && child?.version) {
      found[key].versions.add(child.version);
      if (child.path) found[key].paths.add(realpathSync(child.path));
    }
    if (typeof child === 'object') walk(child);
  }
}
walk(tree);
const singletonReport = {};
for (const [name, entry] of Object.entries(found)) {
  assert.deepEqual([...entry.versions], [direct[name]], `Multiple or unexpected ${name} versions`);
  assert.equal(entry.paths.size, 1, `Multiple physical ${name} module instances`);
  singletonReport[name] = {version: direct[name], physicalInstances: entry.paths.size};
  console.log(`PASS: ${name}@${direct[name]} — one reachable version and one physical module instance.`);
}
// Confirm hooks from direct libraries resolve the very same React singleton.
const require = createRequire(import.meta.url);
const reactPath = realpathSync(require.resolve('react'));
for (const name of ['react-dom', 'radix-ui', 'lucide-react', 'react-router', '@tanstack/react-query', 'react-i18next', 'better-auth']) {
  const entry = path.join(root, 'node_modules', name, 'package.json');
  const fromLibrary = createRequire(pathToFileURL(entry));
  assert.equal(realpathSync(fromLibrary.resolve('react')), reactPath, `${name} resolves another React instance`);
}
for (const name of ['package-lock.json', 'yarn.lock', 'bun.lock', 'bun.lockb']) assert.equal(existsSync(path.join(root, name)), false, `Unexpected competing lockfile: ${name}`);
const pnpmStore = readdirSync(path.join(root, 'node_modules', '.pnpm'));
for (const name of ['react', 'react-dom']) {
  const versions = new Set(pnpmStore.filter((entry) => entry.startsWith(`${name}@`)).map((entry) => entry.slice(name.length + 1).split('_')[0]));
  assert.deepEqual([...versions], [direct[name]], `Stale duplicate ${name} version remains in the project virtual store`);
}
const report = {verifiedAt: new Date().toISOString(), node: process.version, nodeExecutable: process.execPath, packageManager: manifest.packageManager, directPackages: Object.keys(direct).length, singletons: singletonReport, otherApplicationLockfiles: 0};
if (existsSync(path.join(root, '.local'))) writeFileSync(path.join(root, '.local', 'dependency-consistency.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS: ${Object.keys(direct).length} exact installed pins, documented Codex usage and one project lockfile.`);
