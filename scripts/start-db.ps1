$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskTools = Get-Content -LiteralPath (Join-Path $taskProjectRoot '.local\tooling.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskPgCtl = Join-Path $taskTools.postgresBin 'pg_ctl.exe'
if (-not (Test-Path -LiteralPath $taskPgCtl -PathType Leaf)) { throw "PostgreSQL control executable is missing: $taskPgCtl" }
if (-not (Test-Path -LiteralPath $taskTools.postgresData -PathType Container)) {
    throw "The configured PostgreSQL data folder is missing: $($taskTools.postgresData). Existing data will not be reset. Run scripts/setup-local-database.ps1 only to initialize a new local cluster or repair the local configuration first."
}
if (-not (Test-Path -LiteralPath (Join-Path $taskTools.postgresData 'PG_VERSION') -PathType Leaf)) {
    throw "The configured folder is not an initialized PostgreSQL cluster: $($taskTools.postgresData). It will not be overwritten."
}
$taskTools.postgresData = (Resolve-Path -LiteralPath $taskTools.postgresData).ProviderPath
. (Join-Path $PSScriptRoot 'postgres-process.ps1')
$taskStatus = Get-InayaPostgresStatus -PgCtlPath $taskPgCtl -DataDirectory $taskTools.postgresData
if ($taskStatus.ExitCode -eq 0) {
    Write-Output 'Inaya local PostgreSQL is already running.'
    return
}
if ($taskStatus.ExitCode -ne 3) { throw "PostgreSQL status check failed: $($taskStatus.ErrorText.Trim())" }
$taskStartArgs = @('start', '-D', ('"' + $taskTools.postgresData + '"'), '-l', ('"' + $taskTools.postgresLog + '"'), '-w', '-t', '30')
$taskStart = Start-Process -FilePath $taskPgCtl -ArgumentList $taskStartArgs -WindowStyle Hidden -PassThru
if (-not $taskStart.WaitForExit(45000)) { throw 'PostgreSQL startup command did not finish within 45 seconds.' }
if ($taskStart.ExitCode -ne 0) { throw "PostgreSQL failed to start. Inspect $($taskTools.postgresLog)." }
$taskReady = Get-InayaPostgresStatus -PgCtlPath $taskPgCtl -DataDirectory $taskTools.postgresData
if ($taskReady.ExitCode -ne 0) { throw 'PostgreSQL did not remain running after startup. Inspect the database log.' }
Write-Output "Inaya local PostgreSQL is ready on 127.0.0.1:$($taskTools.postgresPort)."
