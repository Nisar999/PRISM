#Requires -Version 7
<#
.SYNOPSIS
  Recover a Git working tree for vscode-main without discarding local customizations.

.DESCRIPTION
  ENV-5: The nested Code-OSS tree under vscode-main/vscode-main was obtained without
  a .git directory (typical ZIP/copy of microsoft/vscode). Upstream postinstall requires
  a real Git repo (`git config pull.rebase merges`).

  Preferred strategy (in-place, zero file loss):
    1. Identify matching upstream commit (package.json version + distro hash)
    2. git init + fetch that commit + git reset --mixed (HEAD/index only; working tree untouched)
    3. Emit added/modified/deleted vs that commit
    4. Optionally sync a fresh clone for side-by-side inventory

  Fallback (-FreshCloneSwap): shallow-clone at -Ref, overlay local-only/modified files, swap trees.

  Does NOT patch postinstall, disable Spectre, or modify PRISM Desktop / vscode app source.

.NOTES
  Architecture impact: ZERO (infrastructure recovery only).
#>

param(
  # Exact match for this workspace's package.json (1.131.0 + distro d0fd3324...)
  [string]$Ref = '1e27930ef9c9f14e1beb8fb2a629b966333deeaf',
  [string]$UpstreamUrl = 'https://github.com/microsoft/vscode.git',
  # If set, clone to a sibling folder, overlay diffs, and swap (slower; keeps timestamped backup)
  [switch]$FreshCloneSwap,
  [switch]$SkipSwap,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$Outer = Join-Path $RepoRoot 'vscode-main'
$Current = Join-Path $Outer 'vscode-main'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ReportDir = Join-Path $RepoRoot 'docs'
$DiffReport = Join-Path $ReportDir "VSCODE_GIT_RECOVERY_DIFF_$Stamp.md"
$Manifest = Join-Path $Outer "recovery-manifest-$Stamp.txt"

$ExcludeNames = @(
  'node_modules', '.git', 'out', 'out-build', 'out-vscode', 'out-vscode-web',
  '.build', 'build\.build', '.vscode-test', 'coverage', '.cache'
)

function Test-IsExcludedRelative([string]$Rel) {
  $norm = $Rel -replace '/', '\'
  foreach ($ex in $ExcludeNames) {
    $exN = $ex -replace '/', '\'
    if ($norm -eq $exN -or $norm.StartsWith("$exN\")) { return $true }
  }
  return $false
}

function Get-FileInventory([string]$Root) {
  $map = @{}
  Get-ChildItem -LiteralPath $Root -Recurse -File -Force | ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length).TrimStart('\')
    if (Test-IsExcludedRelative $rel) { return }
    $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    $map[$rel.Replace('\', '/')] = @{ Path = $_.FullName; Hash = $hash; Length = $_.Length }
  }
  return $map
}

function Write-DiffReport {
  param(
    [string]$Path,
    [string]$Mode,
    [string]$Head,
    [string[]]$Added,
    [string[]]$Modified,
    [string[]]$Deleted
  )
  $report = @"
# VS Code Git Recovery Diff

Generated: $(Get-Date -Format o)
Mode: ``$Mode``
Current workspace: ``$Current``
Upstream: ``$UpstreamUrl`` @ ``$Ref`` (``$Head``)

## Summary

| Category | Count |
| --- | ---: |
| Added (local-only) | $($Added.Count) |
| Modified vs upstream | $($Modified.Count) |
| Deleted vs upstream | $($Deleted.Count) |

## Added files (present locally, absent upstream)

$(($Added | ForEach-Object { "- ``$_``" }) -join "`n")

## Modified files

$(($Modified | ForEach-Object { "- ``$_``" }) -join "`n")

## Deleted files (upstream has, local missing)

$(($Deleted | ForEach-Object { "- ``$_``" }) -join "`n")

"@
  Set-Content -LiteralPath $Path -Value $report -Encoding UTF8
}

Write-Host '=== ENV-5 vscode-main Git recovery ===' -ForegroundColor Cyan
Write-Host "Current: $Current"
Write-Host "Target ref: $Ref"

if (-not (Test-Path $Current)) { throw "Missing current workspace: $Current" }

$gitDir = Join-Path $Current '.git'
if ((Test-Path $gitDir) -and -not $Force) {
  Write-Host 'Current tree already has .git — nothing to recover. Use -Force to re-run.' -ForegroundColor Green
  Push-Location $Current
  git status -sb
  git rev-parse --show-toplevel
  Pop-Location
  return
}

# --------------------------------------------------------------------------
# Mode A: in-place attach (default) — preserve every local byte
# --------------------------------------------------------------------------
if (-not $FreshCloneSwap) {
  Write-Host 'Mode: in-place git attach (working tree preserved)' -ForegroundColor Cyan

  if (Test-Path $gitDir) {
    Write-Host 'Removing existing .git for -Force re-attach...' -ForegroundColor Yellow
    Remove-Item -LiteralPath $gitDir -Recurse -Force
  }

  Push-Location $Current
  try {
    git init
    if ($LASTEXITCODE -ne 0) { throw 'git init failed' }

    git remote add origin $UpstreamUrl
    if ($LASTEXITCODE -ne 0) { throw 'git remote add failed' }

    Write-Host "Fetching $Ref (depth 1)..." -ForegroundColor Cyan
    # Prefer commit SHA fetch; falls back to branch/tag name
    git fetch --depth 1 origin $Ref
    if ($LASTEXITCODE -ne 0) {
      throw "git fetch failed for ref $Ref. Verify the commit/tag exists on microsoft/vscode."
    }

    $head = (git rev-parse FETCH_HEAD).Trim()
    Write-Host "FETCH_HEAD: $head"

    # Point HEAD + index at upstream; do NOT touch working tree files
    git reset --mixed FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'git reset --mixed failed' }

    # Optional: set upstream tracking for future pulls (non-fatal)
    git branch -M main 2>$null
    git branch --set-upstream-to=origin/main main 2>$null

    Write-Host 'Collecting git status vs attached commit...' -ForegroundColor Cyan
    $statusPorcelain = git status --porcelain=v1 -uall
    $added = [System.Collections.Generic.List[string]]::new()
    $modified = [System.Collections.Generic.List[string]]::new()
    $deleted = [System.Collections.Generic.List[string]]::new()

    foreach ($line in ($statusPorcelain -split "`n")) {
      if ([string]::IsNullOrWhiteSpace($line)) { continue }
      $code = $line.Substring(0, 2)
      $path = $line.Substring(3).Trim() -replace '\\', '/'
      # Skip heavy build artifacts from the report (still present on disk)
      if (Test-IsExcludedRelative $path) { continue }
      # XY status: ?? untracked, M modified, D deleted, A added, R rename, etc.
      if ($code -eq '??') { $added.Add($path); continue }
      if ($code.Contains('D')) { $deleted.Add($path); continue }
      if ($code.Contains('M') -or $code.Contains('A') -or $code.Contains('R') -or $code.Contains('C') -or $code.Contains('T') -or $code.Contains('U')) {
        $modified.Add($path)
        continue
      }
      # Fallback: treat other staged/unstaged as modified
      $modified.Add($path)
    }

    $addedArr = @($added | Sort-Object -Unique)
    $modifiedArr = @($modified | Sort-Object -Unique)
    $deletedArr = @($deleted | Sort-Object -Unique)

    Write-DiffReport -Path $DiffReport -Mode 'in-place-attach' -Head $head `
      -Added $addedArr -Modified $modifiedArr -Deleted $deletedArr

    $manifestLines = @(
      "stamp=$Stamp",
      "mode=in-place-attach",
      "ref=$Ref",
      "head=$head",
      "added=$($addedArr.Count)",
      "modified=$($modifiedArr.Count)",
      "deleted=$($deletedArr.Count)"
    )
    Set-Content -LiteralPath $Manifest -Value ($manifestLines -join "`n") -Encoding UTF8

    Write-Host "Diff report: $DiffReport"
    Write-Host "Added=$($addedArr.Count) Modified=$($modifiedArr.Count) Deleted=$($deletedArr.Count)"
    Write-Host '=== git status (recovered) ===' -ForegroundColor Green
    git status -sb
    Write-Host "toplevel: $((git rev-parse --show-toplevel).Trim())"
    Write-Host "HEAD: $((git rev-parse HEAD).Trim())"
  }
  finally {
    Pop-Location
  }

  Write-Host @"

In-place recovery complete.
  Workspace:   $Current
  Diff report: $DiffReport
  Manifest:    $Manifest

Next (ENV-5 validation):
  `$env:VCToolsVersion = '<Spectre-capable VCToolsVersion>'
  cd $Current
  npm ci
  npm run compile-web

"@ -ForegroundColor Cyan
  return
}

# --------------------------------------------------------------------------
# Mode B: fresh clone + overlay + swap
# --------------------------------------------------------------------------
$Fresh = Join-Path $Outer "vscode-fresh-$Stamp"
$Backup = Join-Path $Outer "vscode-main.backup-$Stamp"

Write-Host 'Mode: fresh clone + overlay + swap' -ForegroundColor Cyan
Write-Host "Cloning $UpstreamUrl @ $Ref..." -ForegroundColor Cyan

git clone --filter=blob:none --no-checkout $UpstreamUrl $Fresh
if ($LASTEXITCODE -ne 0) { throw 'git clone failed' }

Push-Location $Fresh
try {
  git fetch --depth 1 origin $Ref
  if ($LASTEXITCODE -ne 0) { throw "git fetch failed for $Ref" }
  git checkout FETCH_HEAD
  if ($LASTEXITCODE -ne 0) { throw 'git checkout failed' }
  $freshHead = (git rev-parse HEAD).Trim()
}
finally {
  Pop-Location
}
Write-Host "Fresh HEAD: $freshHead"

Write-Host 'Building file inventories (excludes node_modules / out / .git)...' -ForegroundColor Cyan
$curMap = Get-FileInventory $Current
$freshMap = Get-FileInventory $Fresh

$added = @()
$deleted = @()
$modified = @()
foreach ($k in $curMap.Keys) {
  if (-not $freshMap.ContainsKey($k)) { $added += $k }
  elseif ($curMap[$k].Hash -ne $freshMap[$k].Hash) { $modified += $k }
}
foreach ($k in $freshMap.Keys) {
  if (-not $curMap.ContainsKey($k)) { $deleted += $k }
}
$added = @($added | Sort-Object)
$deleted = @($deleted | Sort-Object)
$modified = @($modified | Sort-Object)

Write-DiffReport -Path $DiffReport -Mode 'fresh-clone-swap' -Head $freshHead `
  -Added $added -Modified $modified -Deleted $deleted
Write-Host "Diff report: $DiffReport"
Write-Host "Added=$($added.Count) Modified=$($modified.Count) Deleted=$($deleted.Count)"

$overlay = @($added + $modified) | Select-Object -Unique
Write-Host "Overlaying $($overlay.Count) local file(s) onto fresh clone..." -ForegroundColor Cyan
$manifestLines = @("stamp=$Stamp", "mode=fresh-clone-swap", "ref=$Ref", "freshHead=$freshHead", "overlayCount=$($overlay.Count)")
foreach ($rel in $overlay) {
  $src = Join-Path $Current ($rel -replace '/', '\')
  $dst = Join-Path $Fresh ($rel -replace '/', '\')
  $dstDir = Split-Path $dst -Parent
  if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
  Copy-Item -LiteralPath $src -Destination $dst -Force
  $manifestLines += "overlay:$rel"
}
Set-Content -LiteralPath $Manifest -Value ($manifestLines -join "`n") -Encoding UTF8

if ($SkipSwap) {
  Write-Host 'SkipSwap set — fresh clone left at:' $Fresh -ForegroundColor Yellow
  return
}

Write-Host "Backing up current tree to: $Backup" -ForegroundColor Cyan
Rename-Item -LiteralPath $Current -NewName (Split-Path $Backup -Leaf)
Rename-Item -LiteralPath $Fresh -NewName 'vscode-main'

$NewRoot = Join-Path $Outer 'vscode-main'
Push-Location $NewRoot
Write-Host '=== git status (recovered) ===' -ForegroundColor Green
git status -sb
git rev-parse --show-toplevel
Pop-Location

Write-Host @"

Recovery swap complete.
  New workspace: $NewRoot
  Backup:        $Backup
  Diff report:   $DiffReport

"@ -ForegroundColor Cyan
