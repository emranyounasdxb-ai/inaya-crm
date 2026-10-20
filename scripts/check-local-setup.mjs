import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const baseline = JSON.parse(await readFile(new URL('../toolchain.lock.json', import.meta.url), 'utf8'));
assert.equal(process.version, `v${baseline.runtime.node.version}`, 'Activate the project development tools first');
const expected = new Map(baseline.packages.map((entry) => [entry.name, entry.version]));
const direct = {...manifest.dependencies, ...manifest.devDependencies};
for (const [name, version] of Object.entries(direct)) {
  assert.equal(version, expected.get(name), `${name} differs from the selected baseline`);
  const installed = JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
  assert.equal(installed.version, version, `${name} is not installed at its pinned version`);
}
console.log(`PASS: Node ${process.version} and ${Object.keys(direct).length} exact project dependencies.`);

const [{default: Fastify}, {default: helmet}, {default: rateLimit}, {default: staticFiles}, {z}, {parsePhoneNumberFromString}, {createInstance}, translation] = await Promise.all([
  import('fastify'), import('@fastify/helmet'), import('@fastify/rate-limit'), import('@fastify/static'), import('zod'), import('libphonenumber-js'), import('i18next'), import('@google-cloud/translate'),
]);
await Promise.all([import('better-auth'), import('better-auth/adapters/drizzle'), import('drizzle-orm/node-postgres'), import('react-router'), import('@tanstack/react-query'), import('radix-ui'), import('lucide-react'), import('react-i18next')]);
assert.equal(typeof translation.v3.TranslationServiceClient, 'function');
const leadSchema = z.object({name: z.string().min(1), phone: z.string().min(1), source: z.string().min(1), requirement: z.string().min(1)});
assert.equal(leadSchema.safeParse({name: 'Setup', phone: '+971501234567', source: 'Manual', requirement: 'Verification'}).success, true);
assert.equal(parsePhoneNumberFromString('+971501234567')?.number, '+971501234567');
const locale = createInstance();
await locale.init({lng: 'en', fallbackLng: 'en', resources: {en: {translation: {leads: 'Leads'}}, ar: {translation: {leads: 'العملاء المحتملون'}}}});
assert.equal(locale.t('leads'), 'Leads');
await locale.changeLanguage('ar');
assert.equal(locale.t('leads'), 'العملاء المحتملون');
console.log('PASS: backend, auth adapter, interface-language and translation SDK modules load. No cloud API was called.');

const fixture = path.join(root, '.local', 'verification');
await mkdir(fixture, {recursive: true});
await writeFile(path.join(fixture, 'index.html'), '<!doctype html><html lang="en" dir="ltr"><head><meta charset="UTF-8"><title>Dependency verification</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(fixture, 'main.tsx'), 'import {createRoot} from "react-dom/client"; import "./style.css"; const root = document.getElementById("root"); if (root) createRoot(root).render(<main className="p-4 text-sm">Dependency verification</main>);');
await writeFile(path.join(fixture, 'style.css'), '@import "tailwindcss";');
const app = Fastify({logger: false});
try {
  await app.register(helmet);
  await app.register(rateLimit, {max: 20, timeWindow: '1 minute'});
  await app.register(staticFiles, {root: fixture});
  app.post('/api/setup-check', {schema: {body: z.toJSONSchema(leadSchema, {target: 'draft-7'})}}, async () => ({ok: true}));
  const valid = await app.inject({method: 'POST', url: '/api/setup-check', payload: {name: 'Setup', phone: '+971501234567', source: 'Manual', requirement: 'Verification'}});
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.json().ok, true);
  assert.equal(valid.headers['x-content-type-options'], 'nosniff');
  const invalid = await app.inject({method: 'POST', url: '/api/setup-check', payload: {name: ''}});
  assert.equal(invalid.statusCode, 400);
  const asset = await app.inject({method: 'GET', url: '/index.html'});
  assert.equal(asset.statusCode, 200);
  console.log('PASS: Fastify accepts valid input, rejects invalid input and serves assets with the selected plugins.');
} finally {
  await app.close();
}

assert.ok(process.env.DATABASE_URL, 'The private .env.local database configuration is missing');
const {Client} = await import('pg');
const client = new Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000});
let database;
try {
  await client.connect();
  const result = await client.query("SELECT current_database() AS database, current_user AS role, current_setting('server_version') AS version, current_setting('TimeZone') AS timezone, rolsuper FROM pg_roles WHERE rolname = current_user");
  database = result.rows[0];
  assert.equal(database.database, 'inaya_crm');
  assert.equal(database.role, 'inaya_app');
  assert.equal(database.version, baseline.database.version);
  assert.equal(database.timezone, 'Asia/Dubai');
  assert.equal(database.rolsuper, false);
  await client.query('BEGIN');
  await client.query('CREATE TEMP TABLE inaya_setup_probe (value text NOT NULL) ON COMMIT DROP');
  const text = 'English العربية';
  await client.query('INSERT INTO inaya_setup_probe(value) VALUES ($1)', [text]);
  const saved = await client.query('SELECT value FROM inaya_setup_probe');
  assert.equal(saved.rows[0].value, text);
  await client.query('ROLLBACK');
  console.log(`PASS: PostgreSQL ${database.version}, restricted app login and English/Arabic round-trip on the local database.`);
} finally {
  await client.end();
}

const [{build}, {default: react}, {default: tailwind}] = await Promise.all([import('vite'), import('@vitejs/plugin-react'), import('@tailwindcss/vite')]);
await build({root: fixture, configFile: false, plugins: [react(), tailwind()], logLevel: 'warn', build: {outDir: path.join(fixture, 'dist'), emptyOutDir: false}});
console.log('PASS: React + Vite + Tailwind production dependency smoke build. This is not the CRM application build.');

const compiler = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
try {
  execFileSync(process.execPath, [compiler, '--ignoreConfig', '--noEmit', '--strict', '--jsx', 'react-jsx', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--target', 'ES2023', '--lib', 'ES2023,DOM', '--types', 'vite/client', '--skipLibCheck', path.join(fixture, 'main.tsx')], {cwd: root, stdio: 'pipe'});
} catch (error) {
  throw new Error(`TypeScript smoke check failed: ${error.stdout?.toString() ?? error.message}`);
}
console.log('PASS: pinned TypeScript compiler accepts the React fixture.');

const report = {verifiedAt: new Date().toISOString(),node: process.version,directProjectPackages: Object.keys(direct).length,database,checks: {exactVersions: 'passed',moduleImports: 'passed',fastify: 'passed',databaseRoundTrip: 'passed',viteReactTailwindSmokeBuild: 'passed',typescriptSmokeCheck: 'passed'},cloudApiCalls: 'not performed',scope: 'Dependency smoke checks only; application workflow evidence is recorded separately in docs/implementation.md'};
await writeFile(path.join(root, '.local', 'setup-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Local setup verification passed. Report saved without credentials.');
