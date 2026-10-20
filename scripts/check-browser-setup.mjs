import './check-runtime.mjs';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Fastify from 'fastify';
import staticFiles from '@fastify/static';
import {chromium} from '@playwright/test';

if (process.exitCode) process.exit(process.exitCode);
const root = fileURLToPath(new URL('../', import.meta.url));
const built = path.join(root, '.local', 'verification', 'dist');
assert.ok(existsSync(path.join(built, 'index.html')), 'Run check:setup first to create the private dependency fixture');
const app = Fastify({logger: false});
let browser;
try {
  await app.register(staticFiles, {root: built});
  const address = await app.listen({host: '127.0.0.1', port: 0});
  browser = await chromium.launch({headless: true});
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(address);
  await page.getByRole('main').filter({hasText: 'Dependency verification'}).waitFor();
  assert.equal(await page.getByRole('main').innerText(), 'Dependency verification');
  assert.equal(await page.getByRole('main').evaluate((element) => getComputedStyle(element).paddingTop), '16px', 'Tailwind styles did not load');
  assert.deepEqual(pageErrors, [], 'Browser runtime errors occurred');
  const version = browser.version();
  const packageVersion = JSON.parse(readFileSync(path.join(root, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8')).version;
  writeFileSync(path.join(root, '.local', 'browser-setup-check.json'), JSON.stringify({verifiedAt: new Date().toISOString(), playwright: packageVersion, chromium: version, executable: chromium.executablePath(), reactMount: 'passed', compiledStyles: 'passed', pageErrors, fixtureOnly: true, crmWorkflowTested: false}, null, 2) + '\n');
  console.log(`PASS: Playwright ${packageVersion}, Chromium ${version}; compiled React mount and Tailwind styles load without browser errors.`);
} finally {
  await browser?.close();
  await app.close();
}
