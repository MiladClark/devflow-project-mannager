# DevFlow auto-update apply script (reference copy).
# The running app generates an equivalent script in %TEMP% at update time.
param(
  [Parameter(Mandatory = $true)][string]$ZipPath,
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$ExeName,
  [Parameter(Mandatory = $true)][int]$ParentPid
)

$ErrorActionPreference = 'Stop'
$staging = Join-Path $env:TEMP "devflow-update-staging"

for ($i = 0; $i -lt 120; $i++) {
  if (-not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 500
}

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $staging -Force

$inner = Get-ChildItem $staging
if ($inner.Count -eq 1 -and $inner[0].PSIsContainer) { $staging = $inner[0].FullName }

robocopy $staging $InstallDir /MIR /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { exit 1 }

Start-Process -FilePath (Join-Path $InstallDir $ExeName)
Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
