// Reproducible official-registry snapshot for the now-authorized file import feature.
import { readFileSync, writeFileSync } from "node:fs";
import "./check-runtime.mjs";
const selected = [
  ["read-excel-file", "9.3.12", "runtime", "Read XLSX rows in an isolated browser worker for manager import preview."],
  ["papaparse", "5.7.0", "runtime", "Parse quoted CSV files in the import worker and generate Excel-compatible CSV exports with formula escaping."],
  ["@types/papaparse", "5.5.2", "development", "Type-check CSV parser/export calls; no runtime bundle."],
];
const baseline = JSON.parse(readFileSync("toolchain.lock.json", "utf8"));
for (const [name, version, kind, purpose] of selected) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Registry failed: ${name}`);
  const data = await res.json();
  const info = data.versions[version];
  if (data["dist-tags"].latest !== version || !info || info.deprecated) throw new Error(`Release review required: ${name}`);
  const entry = { name, version, kind, purpose, plannedUse: "src/web/features/import-worker.ts and src/server/services/import-export.ts",
    installWhen: "Now: requested spreadsheet import/export completion", publishedAt: data.time[version],
    verifiedTag: "latest", registrySource: `https://registry.npmjs.org/${name}/${version}`,
    integrity: info.dist.integrity, license: info.license, repository: info.repository?.url,
    engines: info.engines ?? {}, peerDependencies: info.peerDependencies ?? {}, peerDependenciesMeta: info.peerDependenciesMeta ?? {},
    dependencies: info.dependencies ?? {}, latestVerifiedAt: new Date().toISOString(),
    codexUsage: purpose, installationScope: "Project only, exact version, installed for file import/export",
    featureStage: "File import/export implementation" };
  baseline.packages = baseline.packages.filter((item) => item.name !== name);
  baseline.packages.push(entry);
}
// Previously excluded file-processing packages now have an implemented, authorized use.
for (const key of Object.keys(baseline)) {
  if (key !== "packages" && Array.isArray(baseline[key]))
    baseline[key] = baseline[key].filter((item) => !selected.some(([name]) => item.name === name));
}
writeFileSync("toolchain.lock.json", `${JSON.stringify(baseline, null, 2)}\n`);
console.log("Selected three exact file-import dependencies from official current stable releases.");
