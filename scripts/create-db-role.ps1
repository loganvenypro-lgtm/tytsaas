# Creates (or resets) the app's Postgres role from DATABASE_URL in .env,
# without knowing the postgres superuser password.
#
# It temporarily lets the "postgres" user log in from this machine without a
# password, runs CREATE/ALTER ROLE, then restores pg_hba.conf and reloads.
#
# Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File scripts\create-db-role.ps1

$ErrorActionPreference = "Stop"

$pgRoot  = "C:\Program Files\PostgreSQL\18"
$pgBin   = Join-Path $pgRoot "bin"
$pgData  = Join-Path $pgRoot "data"
$hbaPath = Join-Path $pgData "pg_hba.conf"
$envPath = Join-Path $PSScriptRoot "..\.env"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Run this script as Administrator." }

# Read the app role's name and password from DATABASE_URL
$line = Get-Content $envPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $line) { throw "DATABASE_URL not found in $envPath" }
$url = [Uri]($line -replace '^DATABASE_URL=', '')
$userInfo = $url.UserInfo.Split(':', 2)
$roleName = [Uri]::UnescapeDataString($userInfo[0])
$password = [Uri]::UnescapeDataString($userInfo[1])
if ($roleName -notmatch '^[a-z_][a-z0-9_]*$') { throw "Unexpected role name '$roleName'" }
$sqlPassword = $password.Replace("'", "''")

# pg_ctl reload can't signal the service process from another account, so restart it
function Reload-Postgres {
  Restart-Service postgresql-x64-18 -Force
  for ($i = 0; $i -lt 30; $i++) {
    & (Join-Path $pgBin "pg_isready.exe") -h 127.0.0.1 -q
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 1
  }
  throw "Postgres did not come back up after restart"
}

$backup = "$hbaPath.bak-$(Get-Date -Format yyyyMMddHHmmss)"
Copy-Item $hbaPath $backup
Write-Host "Backed up pg_hba.conf to $backup"

try {
  # First matching rule wins, so the temporary rules go on top
  $tempRules = @(
    "host    all             postgres        127.0.0.1/32            trust  # TEMP create-db-role.ps1",
    "host    all             postgres        ::1/128                 trust  # TEMP create-db-role.ps1"
  )
  Set-Content -Path $hbaPath -Value ($tempRules + (Get-Content $backup)) -Encoding ascii
  Reload-Postgres
  Write-Host "Temporary local access enabled"

  $sql = @"
DO `$`$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = '$roleName') THEN
    ALTER ROLE $roleName WITH LOGIN CREATEDB PASSWORD '$sqlPassword';
    RAISE NOTICE 'Role % updated', '$roleName';
  ELSE
    CREATE ROLE $roleName WITH LOGIN CREATEDB PASSWORD '$sqlPassword';
    RAISE NOTICE 'Role % created', '$roleName';
  END IF;
END
`$`$;
"@
  # psql prints NOTICEs on stderr, which PowerShell 5.1 turns into errors under "Stop"
  $ErrorActionPreference = "Continue"
  $sql | & (Join-Path $pgBin "psql.exe") -h 127.0.0.1 -U postgres -d postgres -w -v ON_ERROR_STOP=1 -q 2>&1 |
    ForEach-Object { "$_" }
  $psqlExit = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($psqlExit -ne 0) { throw "psql failed creating the role" }
}
finally {
  Copy-Item $backup $hbaPath -Force
  Reload-Postgres
  Write-Host "pg_hba.conf restored"
}

# Check the app can now log in with the password from .env
$env:PGPASSWORD = $password
$check = & (Join-Path $pgBin "psql.exe") -h 127.0.0.1 -U $roleName -d postgres -w -tAc "select current_user"
Remove-Item Env:PGPASSWORD
if ($check -eq $roleName) {
  Write-Host "OK: '$roleName' can log in. Tell Claude to run the migration." -ForegroundColor Green
} else {
  Write-Host "Role was created but the login check failed." -ForegroundColor Red
}
