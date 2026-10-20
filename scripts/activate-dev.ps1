$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskConfigPath = Join-Path $taskProjectRoot '.local\tooling.json'
if (-not (Test-Path -LiteralPath $taskConfigPath)) {
    throw 'Local tooling configuration is missing. Complete the Windows tool setup first.'
}
$taskTools = Get-Content -LiteralPath $taskConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$taskBins = @($taskTools.nodeDirectory, $taskTools.pnpmDirectory, $taskTools.gitDirectory, $taskTools.postgresBin)
foreach ($taskBin in $taskBins) {
    if (-not (Test-Path -LiteralPath $taskBin -PathType Container)) { throw "Tool directory is missing: $taskBin" }
}
$env:Path = (($taskBins + ($env:Path -split ';') | Select-Object -Unique) -join ';')
$env:PGHOST = '127.0.0.1'
$env:PGPORT = [string]$taskTools.postgresPort
$env:PGDATABASE = 'inaya_crm'
$env:PGUSER = 'inaya_app'
$env:PGPASSFILE = $taskTools.pgpassFile
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $env:USERPROFILE '.inaya-crm\browsers'
& (Join-Path $taskTools.nodeDirectory 'node.exe') (Join-Path $PSScriptRoot 'check-runtime.mjs') --quiet
if ($LASTEXITCODE -ne 0) { throw 'The configured project runtime does not match the version contract.' }
