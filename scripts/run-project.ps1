param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TaskArguments
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'activate-dev.ps1')
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not $TaskArguments) { $TaskArguments = @('run') }
& (Join-Path $taskTools.pnpmDirectory 'pnpm.cmd') @TaskArguments
exit $LASTEXITCODE
