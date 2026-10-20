import assert from 'node:assert/strict';
import {existsSync, readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const manifest = readJson('package.json');
const baseline = readJson('toolchain.lock.json');
const version = baseline.runtime.node.version;
const normalize = (value) => {
  const resolved = realpathSync(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

try {
  assert.equal(process.version, `v${version}`, 'Wrong Node version. Use inaya.cmd or activate the project tools.');
  assert.equal(manifest.engines.node, version, 'package.json engines drifted');
  assert.equal(manifest.devEngines.runtime.version, version, 'devEngines runtime drifted');
  assert.equal(manifest.devEngines.runtime.onFail, 'error', 'Runtime substitution must remain disabled');
  assert.equal(readFileSync(path.join(root, '.node-version'), 'utf8').trim(), version, '.node-version drifted');
  const manager = baseline.packages.find((entry) => entry.name === 'pnpm').version;
  assert.equal(manifest.packageManager, `pnpm@${manager}`, 'Package-manager pin drifted');
  assert.equal(manifest.engines.pnpm, manager, 'Package-manager engine drifted');
  if (process.env.npm_config_user_agent) {
    assert.ok(process.env.npm_config_user_agent.startsWith(`pnpm/${manager} `), 'Run project scripts/install with the selected pnpm, not npm/yarn.');
  }
  if (process.platform === 'win32' && existsSync(path.join(root, '.local', 'tooling.json'))) {
    const config = readJson('.local/tooling.json');
    assert.equal(normalize(process.execPath), normalize(path.join(config.nodeDirectory, 'node.exe')), 'Node executable is not the configured project installation');
  }
  if (!process.argv.includes('--quiet')) console.log(`PASS: project runtime ${process.version}; ${manifest.packageManager}; ${process.execPath}`);
} catch (error) {
  console.error(`Runtime selection failed: ${error.message}`);
  process.exitCode = 1;
}
