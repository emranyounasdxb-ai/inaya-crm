$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskTools = Get-Content -LiteralPath (Join-Path $taskProjectRoot '.local\tooling.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskPgCtl = Join-Path $taskTools.postgresBin 'pg_ctl.exe'
if (-not (Test-Path -LiteralPath $taskTools.postgresData -PathType Container)) {
    throw "The configured PostgreSQL data folder is missing: $($taskTools.postgresData). No database was stopped or changed."
}
. (Join-Path $PSScriptRoot 'postgres-process.ps1')
$taskStatus = Get-InayaPostgresStatus -PgCtlPath $taskPgCtl -DataDirectory $taskTools.postgresData
if ($taskStatus.ExitCode -eq 3) {
    Write-Output 'Inaya local PostgreSQL is already stopped.'
    return
}
if ($taskStatus.ExitCode -ne 0) { throw "PostgreSQL status check failed: $($taskStatus.ErrorText.Trim())" }
$taskStopArgs = @('stop', '-D', ('"' + $taskTools.postgresData + '"'), '-m', 'fast', '-w', '-t', '30')
$taskStop = Start-Process -FilePath $taskPgCtl -ArgumentList $taskStopArgs -WindowStyle Hidden -PassThru
if (-not $taskStop.WaitForExit(45000)) { throw 'PostgreSQL shutdown command did not finish within 45 seconds.' }
if ($taskStop.ExitCode -ne 0) { throw 'PostgreSQL did not stop cleanly.' }
Write-Output 'Inaya local PostgreSQL stopped cleanly.'
