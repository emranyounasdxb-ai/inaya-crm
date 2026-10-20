import './check-runtime.mjs';
import assert from 'node:assert/strict';
import {mkdir, writeFile, readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

if (process.exitCode) process.exit(process.exitCode);
const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = path.join(root, '.local', 'verification', `migration-${Date.now()}`);
await mkdir(fixture, {recursive: true});
const schema = path.join(fixture, 'schema.ts');
const config = path.join(fixture, 'drizzle.config.ts');
const out = path.join(fixture, 'sql');
await writeFile(schema, 'import {pgTable, integer, text} from "drizzle-orm/pg-core"; export const dependencyProbe = pgTable("dependency_probe", {id: integer("id").primaryKey(), message: text("message").notNull()});\n');
const portable = (value) => value.split(path.sep).join('/');
await writeFile(config, `import {defineConfig} from "drizzle-kit"; export default defineConfig({dialect: "postgresql", schema: ${JSON.stringify(portable(schema))}, out: ${JSON.stringify(portable(out))}});\n`);
const kitRoot = path.join(root, 'node_modules', 'drizzle-kit');
const kit = JSON.parse(await readFile(path.join(kitRoot, 'package.json'), 'utf8'));
const cli = path.join(kitRoot, typeof kit.bin === 'string' ? kit.bin : kit.bin['drizzle-kit']);
try {
  execFileSync(process.execPath, [cli, 'generate', '--config', config], {cwd: root, stdio: 'pipe'});
} catch (error) {
  throw new Error(`Migration generation failed: ${error.stderr?.toString() || error.stdout?.toString() || error.message}`);
}
const files = (await readdir(out)).filter((file) => file.endsWith('.sql'));
assert.ok(files.length, 'No probe migration was generated');
const sql = await readFile(path.join(out, files[0]), 'utf8');
assert.match(sql, /CREATE TABLE "dependency_probe"/);
await writeFile(path.join(root, '.local', 'migration-setup-check.json'), JSON.stringify({verifiedAt: new Date().toISOString(), drizzleKit: kit.version, generation: 'passed', fixture, applicationDatabaseModified: false}, null, 2) + '\n');
console.log(`PASS: Drizzle Kit ${kit.version} generated SQL from TypeScript config/schema; no migration applied to the database.`);
