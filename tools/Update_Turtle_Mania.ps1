# Turtle Mania story updater (Windows, no install needed). Put next to the game exe.
$Url  = "https://tmnt-story.YOUR-SUBDOMAIN.workers.dev"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$VFile = Join-Path $Root "tm_story_version.txt"
$since = 0
if (Test-Path $VFile) { try { $since = [int](Get-Content $VFile -Raw).Trim() } catch {} }
try {
  $pack = Invoke-RestMethod -Uri "$Url/pack?since=$since" -TimeoutSec 20 -UserAgent "tmnt-last-ronin-updater"
} catch { Write-Host "Could not reach the story server. The game keeps its built-in story."; exit 0 }
$n = 0
foreach ($p in $pack.files.PSObject.Properties) {
  $rel = $p.Name
  if (-not $rel.StartsWith("data/cutscenes/tm/pools/") -or $rel.Contains("..") -or -not $rel.EndsWith(".txt")) { continue }
  $dst = Join-Path $Root ($rel -replace "/", "\")
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  [IO.File]::WriteAllText($dst, ($p.Value -replace "`r`n", "`n"), (New-Object Text.UTF8Encoding $false))
  $n++
}
Set-Content -Path $VFile -Value $pack.version
Write-Host "Turtle Mania story updated: $n scene pools refreshed (version $($pack.version))."
