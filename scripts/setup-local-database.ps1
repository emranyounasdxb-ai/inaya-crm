$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskTools = Get-Content -LiteralPath (Join-Path $taskProjectRoot '.local\tooling.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskStateRoot = Split-Path -Parent $taskTools.postgresData
$taskSecretRoot = Join-Path $taskStateRoot 'private'
New-Item -ItemType Directory -Path $taskSecretRoot -Force | Out-Null
$taskIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $taskSecretRoot '/inheritance:r' '/grant:r' ($taskIdentity + ':(OI)(CI)F') 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the local credential directory.' }
$taskCredentialFile = Join-Path $taskSecretRoot 'credentials.dpapi.json'

function New-TaskPassword {
    $taskBytes = New-Object byte[] 32
    $taskRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $taskRandom.GetBytes($taskBytes) } finally { $taskRandom.Dispose() }
    [Convert]::ToBase64String($taskBytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

if (Test-Path -LiteralPath $taskCredentialFile) {
    $taskCredentials = Get-Content -LiteralPath $taskCredentialFile -Raw | ConvertFrom-Json
    $taskAdminSecure = ConvertTo-SecureString $taskCredentials.admin
    $taskAppSecure = ConvertTo-SecureString $taskCredentials.app
    $taskAdminPassword = [Net.NetworkCredential]::new('', $taskAdminSecure).Password
    $taskAppPassword = [Net.NetworkCredential]::new('', $taskAppSecure).Password
} else {
    if (Test-Path -LiteralPath (Join-Path $taskTools.postgresData 'PG_VERSION')) {
        throw 'An existing cluster has no matching saved credentials. It will not be reset.'
    }
    $taskAdminPassword = New-TaskPassword
    $taskAppPassword = New-TaskPassword
    $taskCredentials = @{
        admin = (ConvertTo-SecureString $taskAdminPassword -AsPlainText -Force | ConvertFrom-SecureString)
        app = (ConvertTo-SecureString $taskAppPassword -AsPlainText -Force | ConvertFrom-SecureString)
    }
    $taskCredentials | ConvertTo-Json | Set-Content -LiteralPath $taskCredentialFile -Encoding utf8
}

if (-not (Test-Path -LiteralPath (Join-Path $taskTools.postgresData 'PG_VERSION'))) {
    $taskPasswordFile = Join-Path $taskSecretRoot 'initdb-password.tmp'
    [IO.File]::WriteAllText($taskPasswordFile, $taskAdminPassword + "`n", [Text.UTF8Encoding]::new($false))
    try {
        & (Join-Path $taskTools.postgresBin 'initdb.exe') -D $taskTools.postgresData -U inaya_admin -A scram-sha-256 --encoding=UTF8 --locale=C ('--pwfile=' + $taskPasswordFile)
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL cluster initialization failed.' }
    } finally {
        if (Test-Path -LiteralPath $taskPasswordFile) { Remove-Item -LiteralPath $taskPasswordFile -Force }
    }
    $taskDatabaseConfig = @"

# Inaya local development only
listen_addresses = '127.0.0.1'
port = $($taskTools.postgresPort)
password_encryption = 'scram-sha-256'
timezone = 'Asia/Dubai'
log_timezone = 'Asia/Dubai'
"@
    Add-Content -LiteralPath (Join-Path $taskTools.postgresData 'postgresql.conf') -Value $taskDatabaseConfig -Encoding utf8
}

& (Join-Path $PSScriptRoot 'start-db.ps1')
$taskPreviousPassword = $env:PGPASSWORD
$taskPreviousUser = $env:PGUSER
$taskPreviousDatabase = $env:PGDATABASE
$taskPreviousHost = $env:PGHOST
$taskPreviousPort = $env:PGPORT
$taskPsql = Join-Path $taskTools.postgresBin 'psql.exe'
try {
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = [string]$taskTools.postgresPort
    $env:PGUSER = 'inaya_admin'
    $env:PGDATABASE = 'postgres'
    $env:PGPASSWORD = $taskAdminPassword
    $taskRoleExists = & $taskPsql -X -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_roles WHERE rolname = 'inaya_app';"
    if ($LASTEXITCODE -ne 0) { throw 'Could not connect to the initialized PostgreSQL cluster.' }
    if ($taskRoleExists.Trim() -eq '0') {
        "CREATE ROLE inaya_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '$taskAppPassword';" | & $taskPsql -X -v ON_ERROR_STOP=1
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the local application role.' }
    }
    $taskDatabaseExists = & $taskPsql -X -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_database WHERE datname = 'inaya_crm';"
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect local databases.' }
    if ($taskDatabaseExists.Trim() -eq '0') {
        'CREATE DATABASE inaya_crm OWNER inaya_app ENCODING ''UTF8'';' | & $taskPsql -X -v ON_ERROR_STOP=1
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the local CRM database.' }
    }
} finally {
    $env:PGPASSWORD = $taskPreviousPassword
    $env:PGUSER = $taskPreviousUser
    $env:PGDATABASE = $taskPreviousDatabase
    $env:PGHOST = $taskPreviousHost
    $env:PGPORT = $taskPreviousPort
}

$taskPgpassValue = "127.0.0.1:$($taskTools.postgresPort):inaya_crm:inaya_app:$taskAppPassword`n"
[IO.File]::WriteAllText($taskTools.pgpassFile, $taskPgpassValue, [Text.UTF8Encoding]::new($false))
$taskEnvFile = Join-Path $taskProjectRoot '.env.local'
if (-not (Test-Path -LiteralPath $taskEnvFile)) {
    $taskDatabaseUrl = "postgresql://inaya_app:$taskAppPassword@127.0.0.1:$($taskTools.postgresPort)/inaya_crm"
    [IO.File]::WriteAllText($taskEnvFile, "DATABASE_URL=$taskDatabaseUrl`n", [Text.UTF8Encoding]::new($false))
    & icacls.exe $taskEnvFile '/inheritance:r' '/grant:r' ($taskIdentity + ':F') 'SYSTEM:F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the local environment file.' }
}

Write-Output 'Local CRM database and restricted application role are ready. Credentials were saved privately and were not printed.'
