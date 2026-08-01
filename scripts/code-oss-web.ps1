#Requires -Version 7
<#
.SYNOPSIS
  Build and serve unmodified Code-OSS web from vscode-main (Sprint 4B).

.DESCRIPTION
  Prefers Docker (no local VS C++ toolchain). Falls back to documenting
  native Windows prerequisites if Docker is unavailable.

.NOTES
  Does not patch vscode-main.
#>

param(
  [ValidateSet('docker', 'native', 'auto')]
  [string]$Mode = 'auto',
  [switch]$BuildOnly,
  [int]$Port = 8080,
  # Optional local folder mounted into Code-OSS web (Explorer root).
  [string]$Folder = ''
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$VscodeRoot = Join-Path $RepoRoot 'vscode-main\vscode-main'
$ComposeFile = Join-Path $RepoRoot 'docker\code-oss-web.compose.yml'
$Node24 = Join-Path $RepoRoot '.tools\node24\node-v24.18.0-win-x64\node.exe'

function Initialize-NodeToolchain {
  if (Test-Path $Node24) {
    $script:NodeExe = $Node24
  } else {
    $script:NodeExe = (Get-Command node -ErrorAction Stop).Source
  }
  $script:NodeDir = Split-Path $script:NodeExe -Parent
  $env:Path = "$($script:NodeDir);$env:Path"
  Write-Host "Using node: $($script:NodeExe)"
}

function Invoke-Npm {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$NpmArgs
  )
  Initialize-NodeToolchain | Out-Null
  $npmCmd = Join-Path $script:NodeDir 'npm.cmd'
  if (-not (Test-Path $npmCmd)) {
    $npmCmd = (Get-Command npm.cmd -ErrorAction Stop).Source
  }
  # Must invoke npm.cmd directly — never `node.exe npm.cmd` (npm.cmd is a batch script, not JS).
  & $npmCmd @NpmArgs
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($NpmArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Test-DockerReady {
  try {
    docker info 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Invoke-DockerServe {
  Write-Host '=== Code-OSS web via Docker (upstream sources, zero patches) ===' -ForegroundColor Cyan
  Write-Host "Compose: $ComposeFile"
  Write-Host 'Steps: docker build (npm ci + npm run compile-web) → scripts/code-web.js :8080'
  if ($BuildOnly) {
    docker compose -f $ComposeFile build
    if ($LASTEXITCODE -ne 0) { throw 'Docker build failed' }
    Write-Host 'Build complete. Run without -BuildOnly to serve.' -ForegroundColor Green
    return
  }
  docker compose -f $ComposeFile up --build
}

function Show-NativePrereqs {
  Write-Host @'

Native Windows build prerequisites (upstream vscode wiki):
  1. Node.js major version from vscode-main/vscode-main/.nvmrc (24.x)
  2. Visual Studio 2022 Build Tools + "Desktop development with C++"
     + Spectre-mitigated libs / ATL / MFC components
  3. Python 3.x on PATH

Then:
  cd vscode-main\vscode-main
  npm ci
  npm run compile-web
  .\scripts\code-web.bat --port 8080 --browserType none

PRISM Desktop:
  Default host: /code-oss-host/index.html → http://127.0.0.1:8080/
  Or set VITE_CODE_OSS_URL / VITE_CODE_OSS_WORKBENCH_URL

'@ -ForegroundColor Yellow
}

function Test-NativeDepsComplete {
  <#
    Partial installs often leave a node_modules folder without packages.
    Presence of the directory alone is NOT a success signal.
  #>
  param([string]$Root)
  $required = @(
    (Join-Path $Root 'node_modules\gulp\bin\gulp.js'),
    (Join-Path $Root 'node_modules\.bin\gulp.cmd'),
    (Join-Path $Root 'node_modules\typescript\lib\tsc.js')
  )
  foreach ($path in $required) {
    if (-not (Test-Path $path)) {
      return $false
    }
  }
  return $true
}

function Ensure-NativeNpmDependencies {
  param([string]$Root)
  if (Test-NativeDepsComplete -Root $Root) {
    Write-Host 'Native dependencies look complete (gulp + typescript present).' -ForegroundColor Green
    return
  }

  if (Test-Path (Join-Path $Root 'node_modules')) {
    Write-Host 'node_modules exists but required packages are missing (incomplete install). Re-running npm ci...' -ForegroundColor Yellow
  } else {
    Write-Host 'Running npm ci (requires VS C++ toolchain on Windows)...' -ForegroundColor Cyan
  }
  Invoke-Npm ci

  if (-not (Test-NativeDepsComplete -Root $Root)) {
    throw 'npm ci finished but required deps are still missing (expected node_modules/gulp/bin/gulp.js).'
  }
}

function Invoke-NativeServe {
  if (-not (Test-Path $VscodeRoot)) { throw "Missing $VscodeRoot" }
  Show-NativePrereqs
  Initialize-NodeToolchain
  Push-Location $VscodeRoot
  try {
    # Never skip npm ci solely because node_modules/ exists.
    Ensure-NativeNpmDependencies -Root $VscodeRoot
    Write-Host 'Running npm run compile-web...' -ForegroundColor Cyan
    Invoke-Npm run compile-web
    if ($BuildOnly) {
      Write-Host 'compile-web complete.' -ForegroundColor Green
      return
    }
    Write-Host "Serving code-web on port $Port..." -ForegroundColor Cyan
    $codeWebBat = Join-Path $VscodeRoot 'scripts\code-web.bat'
    if (-not (Test-Path $codeWebBat)) {
      throw "Missing $codeWebBat"
    }
    $codeWebArgs = @('--host', '127.0.0.1', '--port', "$Port", '--browserType', 'none')
    if ($Folder) {
      $resolvedFolder = (Resolve-Path $Folder).Path
      Write-Host "Mounting folder into Code-OSS Explorer: $resolvedFolder" -ForegroundColor Cyan
      # Positional folderMountPath must come before option flags for @vscode/test-web.
      & $codeWebBat $resolvedFolder @codeWebArgs
    } else {
      & $codeWebBat @codeWebArgs
    }
    if ($LASTEXITCODE -ne 0) { throw 'code-web.bat failed' }
  } finally {
    Pop-Location
  }
}

$useDocker = $Mode -eq 'docker' -or ($Mode -eq 'auto' -and (Test-DockerReady))
if ($Mode -eq 'docker' -and -not (Test-DockerReady)) {
  throw 'Docker requested but daemon is not ready. Start Docker Desktop and retry.'
}

if ($useDocker) {
  Invoke-DockerServe
} else {
  if ($Mode -eq 'auto') {
    Write-Host 'Docker not ready — falling back to native Code-OSS web (requires Node 24 + compile-web).' -ForegroundColor Yellow
  }
  Invoke-NativeServe
}
