import {readFile} from 'node:fs/promises';

const lock = JSON.parse(await readFile(new URL('../toolchain.lock.json', import.meta.url), 'utf8'));
const failures = [];
let checked = 0;

async function getJson(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(30_000)});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

for (let index = 0; index < lock.packages.length; index += 6) {
  await Promise.all(lock.packages.slice(index, index + 6).map(async (entry) => {
    try {
      const latest = await getJson(`https://registry.npmjs.org/${encodeURIComponent(entry.name)}/latest`);
      if (!/^\d+\.\d+\.\d+$/.test(latest.version)) {
        failures.push(`${entry.name}: latest tag is a prerelease or unrecognized version (${latest.version})`);
      } else if (latest.version !== entry.version) {
        failures.push(`${entry.name}: locked ${entry.version}, current latest ${latest.version}; review and update the baseline`);
      }
      if (latest.deprecated) failures.push(`${entry.name}: ${latest.deprecated}`);
      if (latest.version === entry.version && latest.dist?.integrity !== entry.integrity) {
        failures.push(`${entry.name}: registry integrity differs from recorded evidence`);
      }
      checked += 1;
    } catch (error) {
      failures.push(`${entry.name}: could not verify (${error.message})`);
    }
  }));
}

try {
  const releases = await getJson(lock.runtime.node.source);
  const latest = releases.find((release) => /^v\d+\.\d+\.\d+$/.test(release.version));
  if (latest?.version !== `v${lock.runtime.node.version}`) {
    failures.push(`Node.js: locked ${lock.runtime.node.version}, latest ${latest?.version ?? 'unknown'}`);
  }
  const target = releases.find((release) => release.version === `v${lock.runtime.node.version}`);
  console.log(`Node.js target ${lock.runtime.node.version}: ${target?.lts ? `LTS ${target.lts}` : 'Current, not LTS'}`);
  if (process.argv.includes('--production') && !target?.lts) {
    failures.push('Production policy requires a supported LTS Node.js runtime; the selected latest Current release is not LTS');
  }
  if (process.argv.includes('--runtime') && process.version !== `v${lock.runtime.node.version}`) {
    failures.push(`Installed Node.js ${process.version} does not match v${lock.runtime.node.version}`);
  }
} catch (error) {
  failures.push(`Node.js: could not verify (${error.message})`);
}

if (lock.deploymentCli) {
  try {
    const release = await getJson(lock.deploymentCli.source);
    if (release.version !== lock.deploymentCli.version) {
      failures.push(`Google Cloud CLI: locked ${lock.deploymentCli.version}, current channel ${release.version}`);
    }
  } catch (error) {
    failures.push(`Google Cloud CLI: could not verify (${error.message})`);
  }
}

try {
  const response = await fetch(lock.database.source, {signal: AbortSignal.timeout(30_000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const row = /<tr[^>]*>\s*<td[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>\s*(\d+\.\d+)\s*<\/td>\s*<td[^>]*>\s*Yes\s*<\/td>/i.exec(html);
  if (!row) throw new Error('Could not read the current supported release table; inspect the official page');
  if (row[2] !== lock.database.version) {
    failures.push(`PostgreSQL: locked ${lock.database.version}, current supported stable ${row[2]}`);
  }
} catch (error) {
  failures.push(`PostgreSQL: could not verify (${error.message})`);
}

console.log(`Verified ${checked}/${lock.packages.length} npm packages against live latest tags.`);
console.log(`Installed runtime: ${process.version}. Installation, build and transitive dependencies are not checked by this command.`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS: the documented versions still match the official live sources. No files were changed.');
}
