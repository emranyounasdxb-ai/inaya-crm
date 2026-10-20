$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'activate-dev.ps1')
& (Join-Path $PSScriptRoot 'start-db.ps1')
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
Write-Output 'Inaya development tools are active in this PowerShell session.'
node --version
pnpm.cmd --version
git --version
psql --version
