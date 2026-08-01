#Requires -Version 5.1
<#
.SYNOPSIS
  Point all PRISM development / build caches and outputs at D:.

.DESCRIPTION
  C: is space-constrained. Source this script in any PowerShell session
  before building PRISM so Cargo, npm, pip, Temp, and runtime staging
  write to D: instead of C:.

  Usage:
    . D:\Code_yees\PRISM\scripts\dev-env.ps1

  Optional permanent install (user-level env vars):
    . D:\Code_yees\PRISM\scripts\dev-env.ps1 -Persist
#>
[CmdletBinding()]
param(
  [switch]$Persist
)

$ErrorActionPreference = 'Stop'

$Paths = @{
  CARGO_TARGET_DIR  = 'D:\cargo-target\prism-desktop'
  PRISM_RUNTIME_OUT = 'D:\prism-release-runtime'
  NPM_CONFIG_CACHE  = 'D:\PRISM_Caches\npm'
  PIP_CACHE_DIR     = 'D:\PRISM_Caches\pip'
  # TMP/TEMP are set for the current session only (not -Persist).
  # Changing the user-wide TEMP breaks unrelated Windows apps.
  TMP               = 'D:\PRISM_Caches\temp'
  TEMP              = 'D:\PRISM_Caches\temp'
}

$PersistKeys = @('CARGO_TARGET_DIR', 'PRISM_RUNTIME_OUT', 'NPM_CONFIG_CACHE', 'PIP_CACHE_DIR')

foreach ($key in $Paths.Keys) {
  $dir = $Paths[$key]
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Set-Item -Path "Env:$key" -Value $dir
  Write-Host ("{0}={1}" -f $key, $dir)
  if ($Persist -and ($PersistKeys -contains $key)) {
    [Environment]::SetEnvironmentVariable($key, $dir, 'User')
    Write-Host ("  (persisted to User environment)")
  }
}

Write-Host ''
Write-Host 'PRISM dev env ready. Builds will write artifacts to D:.'
Write-Host 'Note: Cursor agent sandboxes may still override CARGO_TARGET_DIR / TMP;'
Write-Host '      use a normal terminal (or -Persist) for reliable D: builds.'
