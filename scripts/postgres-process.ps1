function Get-InayaPostgresStatus {
    param(
        [Parameter(Mandatory = $true)][string]$PgCtlPath,
        [Parameter(Mandatory = $true)][string]$DataDirectory
    )
    $taskStatusInfo = New-Object System.Diagnostics.ProcessStartInfo
    $taskStatusInfo.FileName = $PgCtlPath
    $taskStatusInfo.Arguments = 'status -D "' + $DataDirectory + '"'
    $taskStatusInfo.UseShellExecute = $false
    $taskStatusInfo.CreateNoWindow = $true
    $taskStatusInfo.RedirectStandardOutput = $true
    $taskStatusInfo.RedirectStandardError = $true
    $taskStatusInfo.WorkingDirectory = Split-Path -Parent $DataDirectory
    $taskStatusProcess = New-Object System.Diagnostics.Process
    $taskStatusProcess.StartInfo = $taskStatusInfo
    try {
        [void]$taskStatusProcess.Start()
        $taskStatusOutput = $taskStatusProcess.StandardOutput.ReadToEndAsync()
        $taskStatusError = $taskStatusProcess.StandardError.ReadToEndAsync()
        if (-not $taskStatusProcess.WaitForExit(10000)) {
            $taskStatusProcess.Kill()
            throw 'PostgreSQL status check timed out.'
        }
        [pscustomobject]@{
            ExitCode = $taskStatusProcess.ExitCode
            Output = $taskStatusOutput.GetAwaiter().GetResult()
            ErrorText = $taskStatusError.GetAwaiter().GetResult()
        }
    } finally {
        $taskStatusProcess.Dispose()
    }
}
