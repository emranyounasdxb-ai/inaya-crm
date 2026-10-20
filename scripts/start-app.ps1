$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'activate-dev.ps1')
. (Join-Path $PSScriptRoot 'start-db.ps1')
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
& pnpm.cmd db:migrate
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. Existing data has not been reset.' }
& pnpm.cmd build
if ($LASTEXITCODE -ne 0) { throw 'Application build failed.' }
& pnpm.cmd start
if ($LASTEXITCODE -ne 0) { throw 'Application stopped with an error. Check whether port 4310 is already in use.' }
