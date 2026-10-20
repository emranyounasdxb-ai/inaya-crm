param([string]$Manifest)
$ErrorActionPreference = 'Stop'
# pnpm may inherit PowerShell 7 module paths; load the matching Windows PowerShell module explicitly.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
. (Join-Path $PSScriptRoot 'activate-dev.ps1')
$taskTools = Get-Content -LiteralPath (Join-Path $taskRoot '.local\tooling.json') -Raw | ConvertFrom-Json
$taskStatus = Get-Content -LiteralPath (Join-Path $taskRoot '.local\backup-status.json') -Raw | ConvertFrom-Json
if (-not $Manifest) { $Manifest = $taskStatus.latestManifest }
$taskBackupRoot = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.inaya-crm\backups'))
$taskManifestPath = [IO.Path]::GetFullPath($Manifest)
if (-not $taskManifestPath.StartsWith($taskBackupRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest must be in the private backup directory.' }
$taskManifestData = Get-Content -LiteralPath $taskManifestPath -Raw | ConvertFrom-Json
if ($taskManifestData.dump -notmatch '^inaya-[\w-]+\.dump$') { throw 'Invalid backup filename.' }
$taskDump = Join-Path $taskBackupRoot $taskManifestData.dump
$taskHasher = [Security.Cryptography.SHA256]::Create()
$taskStream = [IO.File]::OpenRead($taskDump)
try { $taskHash = [BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-', '').ToLowerInvariant() }
finally { $taskStream.Dispose(); $taskHasher.Dispose() }
if ($taskHash -ne $taskManifestData.sha256) { throw 'Backup checksum mismatch.' }
$taskCredentialsPath = Join-Path (Split-Path -Parent $taskTools.postgresData) 'private\credentials.dpapi.json'
$taskCredentials = Get-Content -LiteralPath $taskCredentialsPath -Raw | ConvertFrom-Json
$taskSecure = ConvertTo-SecureString $taskCredentials.admin
$taskPrevious = @{}
foreach ($taskKey in @('PGPASSWORD','PGHOST','PGPORT','PGUSER','PGDATABASE')) { $taskPrevious[$taskKey] = [Environment]::GetEnvironmentVariable($taskKey, 'Process') }
$taskTestDatabase = 'inaya_restore_test_' + [Guid]::NewGuid().ToString('N')
$taskCreated = $false
try {
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = [string]$taskTools.postgresPort
    $env:PGUSER = 'inaya_admin'
    $env:PGPASSWORD = [Net.NetworkCredential]::new('', $taskSecure).Password
    $env:PGDATABASE = 'postgres'
    & (Join-Path $taskTools.postgresBin 'createdb.exe') --template=template0 --encoding=UTF8 $taskTestDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated restore database.' }
    $taskCreated = $true
    # Clean only the freshly-created, validated disposable database (template0 has an empty public schema).
    if ($taskTestDatabase -notmatch '^inaya_restore_test_[a-f0-9]{32}$') { throw 'Unsafe restore target.' }
    & (Join-Path $taskTools.postgresBin 'pg_restore.exe') --clean --if-exists --exit-on-error --no-owner --no-privileges --dbname=$taskTestDatabase $taskDump
    if ($LASTEXITCODE -ne 0) { throw 'Restore failed in the disposable database; real CRM is untouched.' }
    & node (Join-Path $PSScriptRoot 'verify-restore.mjs') $taskManifestPath $taskTestDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Restore verification failed.' }
} finally {
    if ($taskCreated -and $taskTestDatabase -match '^inaya_restore_test_[a-f0-9]{32}$') {
        & (Join-Path $taskTools.postgresBin 'dropdb.exe') --force $taskTestDatabase
        if ($LASTEXITCODE -ne 0) { Write-Warning 'The disposable restore-test database needs cleanup.' }
    }
    foreach ($taskKey in $taskPrevious.Keys) { [Environment]::SetEnvironmentVariable($taskKey, $taskPrevious[$taskKey], 'Process') }
}
