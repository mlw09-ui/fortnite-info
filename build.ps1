# Build script: fetches the Fortnite API ONCE and writes the local data files the site uses.
# Runs in Windows PowerShell 5.1 (locally) and PowerShell 7 (GitHub Actions: `shell: pwsh`).
#
#   powershell -ExecutionPolicy Bypass -File build.ps1
#
# Writes:
#   data/items.json          compact search index (home page)
#   data/detail/<n>.json     full item details, split into shards (item page)
#   data/prices.json         price history, grows every day from the daily shop (kept in the repo)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$dataDir = Join-Path $root 'data'
$detailDir = Join-Path $dataDir 'detail'
$SHARDS = 128   # must match SHARDS in assets/common.js
$utf8 = New-Object System.Text.UTF8Encoding $false

function Get-Json($url) {
  # The API sometimes hiccups: try up to 3 times, 20 s apart.
  for ($try = 1; ; $try++) {
    Write-Host "GET $url (try $try)"
    try {
      $wc = New-Object System.Net.WebClient
      $wc.Encoding = [System.Text.Encoding]::UTF8
      $wc.Headers.Add('User-Agent', 'fortnite-fansite-build')
      return ($wc.DownloadString($url) | ConvertFrom-Json)
    } catch {
      if ($try -ge 3) { throw }
      Write-Warning "Failed: $($_.Exception.Message) - retrying"
      Start-Sleep -Seconds 20
    }
  }
}

function Save-Json($path, $obj) {
  $json = ConvertTo-Json -InputObject $obj -Depth 12 -Compress
  [System.IO.File]::WriteAllText($path, $json, $utf8)
}

# PowerShell 7 turns ISO date strings into DateTime; 5.1 keeps strings. Normalise to 'yyyy-MM-dd' (UTC).
function To-Day($v) {
  if ($null -eq $v) { return $null }
  if ($v -is [DateTime]) {
    # '...Z' strings come back as Utc, date-only strings as Unspecified: only shift real local times.
    if ($v.Kind -eq [DateTimeKind]::Local) { $v = $v.ToUniversalTime() }
    return $v.ToString('yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
  }
  $s = [string]$v
  if ($s.Length -ge 10) { return $s.Substring(0, 10) }
  return $null
}

# Same function in assets/common.js (shardOf).
function Get-Shard([string]$id) {
  $sum = 0
  foreach ($c in $id.ToCharArray()) { $sum += [int]$c }
  return $sum % $SHARDS
}

New-Item -ItemType Directory -Force -Path $detailDir | Out-Null

# ---------- seasons ----------
$seasons = @((Get-Content -Raw -Encoding UTF8 (Join-Path $root 'seasons.json') | ConvertFrom-Json).seasons)
$seasonStarts = @($seasons | ForEach-Object { To-Day $_.start })

# Last season whose start <= date. Returns index or -1.
function Get-SeasonIndex([string]$day) {
  if (-not $day) { return -1 }
  $idx = -1
  for ($i = 0; $i -lt $seasonStarts.Count; $i++) {
    if ([string]::CompareOrdinal($seasonStarts[$i], $day) -le 0) { $idx = $i }
  }
  return $idx
}

# The API's introduction.backendValue counts seasons in the same order as seasons.json (1 = C1S1).
# Use it when the chapter matches; otherwise fall back to matching chapter + season text.
function Get-IntroIndex($intro) {
  if (-not $intro) { return -1 }
  $bv = [int]$intro.backendValue
  if ($bv -ge 1 -and $bv -le $seasons.Count -and [string]$seasons[$bv - 1].chapter -eq [string]$intro.chapter) {
    return $bv - 1
  }
  for ($i = 0; $i -lt $seasons.Count; $i++) {
    if ([string]$seasons[$i].chapter -eq [string]$intro.chapter -and [string]$seasons[$i].season -eq [string]$intro.season) { return $i }
  }
  Write-Warning "Unknown introduction season: chapter $($intro.chapter) season $($intro.season) ($bv) - add it to seasons.json"
  return -1
}

$KEEP = @('outfit', 'pickaxe', 'glider', 'backpack')
$typeOrder = @{ outfit = 0; pickaxe = 1; glider = 2; backpack = 3 }

# ---------- cosmetics ----------
# responseFlags=4 adds shopHistory to every item.
$all = (Get-Json 'https://fortnite-api.com/v2/cosmetics/br?language=en&responseFlags=4').data
$items = @($all | Where-Object { $KEEP -contains $_.type.value })
Write-Host "Kept $($items.Count) of $(@($all).Count) cosmetics"
# Safety net: a broken API answer must not replace the live site with an empty one.
if ($items.Count -lt 5000) { throw "Only $($items.Count) items from the API - refusing to build" }
if (@($items | Where-Object { $_.shopHistory }).Count -lt 1000) { throw 'API returned (almost) no shopHistory - refusing to build' }

$index = New-Object System.Collections.ArrayList
$shardMap = @{}
for ($i = 0; $i -lt $SHARDS; $i++) { $shardMap[$i] = [ordered]@{} }
$byId = @{}        # id -> index card (used for sets and the shop page)
$setGroups = @{}   # set name -> cards in that set

foreach ($it in $items) {
  $history = @($it.shopHistory | ForEach-Object { To-Day $_ } | Where-Object { $_ } | Sort-Object -Unique)
  $intro = Get-IntroIndex $it.introduction
  # No introduction in the API: use the season of the first shop appearance.
  if ($intro -lt 0 -and $history.Count -gt 0) { $intro = Get-SeasonIndex $history[0] }

  $series = $null
  if ($it.series) {
    $series = [ordered]@{ name = $it.series.value; colors = @($it.series.colors); image = $it.series.image }
  }

  $img = $it.images.smallIcon
  if (-not $img) { $img = $it.images.icon }

  [void]$index.Add([ordered]@{
    id = $it.id
    n  = $it.name
    t  = $it.type.value
    r  = $it.rarity.value
    rd = $it.rarity.displayValue
    sc = $(if ($series) { $series.colors[0] } else { $null })
    si = $intro
    d  = $(if ($history.Count) { $history[0] } else { $null })
    l  = $(if ($history.Count) { $history[$history.Count - 1] } else { $null })
    i  = $img
  })
  $card = $index[$index.Count - 1]
  $byId[$it.id] = $card
  if ($it.set -and $it.set.value) {
    if (-not $setGroups.ContainsKey($it.set.value)) { $setGroups[$it.set.value] = New-Object System.Collections.ArrayList }
    [void]$setGroups[$it.set.value].Add($card)
  }

  $variants = @()
  foreach ($ch in @($it.variants)) {
    if (-not $ch) { continue }
    $variants += [ordered]@{
      channel = $(if ($ch.type) { $ch.type } else { $ch.channel })
      options = @($ch.options | ForEach-Object { [ordered]@{ name = $_.name; image = $_.image } })
    }
  }

  $shardMap[(Get-Shard $it.id)][$it.id] = [ordered]@{
    id          = $it.id
    name        = $it.name
    description = $it.description
    type        = $it.type.value
    typeName    = $it.type.displayValue
    rarity      = $it.rarity.value
    rarityName  = $it.rarity.displayValue
    series      = $series
    set         = $(if ($it.set) { $it.set.value } else { $null })
    image       = $(if ($it.images.featured) { $it.images.featured } else { $it.images.icon })
    icon        = $it.images.icon
    intro       = $intro
    shopHistory = $history
    variants    = $variants
    # YouTube video ID of the in-game showcase (only kept if it looks like a real ID)
    video       = $(if ([string]$it.showcaseVideo -match '^[A-Za-z0-9_-]{11}$') { [string]$it.showcaseVideo } else { $null })
  }
}

# "Uit dezelfde set": every item gets the cards of the other items in its set.
foreach ($shard in $shardMap.Values) {
  foreach ($d in $shard.Values) {
    $others = @()
    if ($d.set -and $setGroups.ContainsKey($d.set)) {
      $others = @($setGroups[$d.set] | Where-Object { $_.id -ne $d.id } | Sort-Object { $typeOrder[$_.t] }, { $_.n })
    }
    $d.setItems = $others
  }
}

Save-Json (Join-Path $dataDir 'items.json') $index
Get-ChildItem $detailDir -Filter '*.json' | Remove-Item -Force
for ($i = 0; $i -lt $SHARDS; $i++) { Save-Json (Join-Path $detailDir "$i.json") $shardMap[$i] }
Write-Host "Wrote data/items.json and $SHARDS detail shards"

# ---------- prices (section 3c) ----------
# Prices only exist in the daily shop, so every build adds today's prices to data/prices.json.
$pricesPath = Join-Path $dataDir 'prices.json'
$prices = @{}
if (Test-Path $pricesPath) {
  $old = Get-Content -Raw -Encoding UTF8 $pricesPath | ConvertFrom-Json
  foreach ($p in $old.PSObject.Properties) {
    $prices[$p.Name] = New-Object System.Collections.ArrayList
    foreach ($e in @($p.Value)) {
      [void]$prices[$p.Name].Add([ordered]@{ date = To-Day $e.date; price = $e.price; regular = $e.regular; bundle = [bool]$e.bundle; bundleName = $e.bundleName })
    }
  }
}

try {
  $shop = (Get-Json 'https://fortnite-api.com/v2/shop?language=en').data
} catch {
  # Item data is already written, so the site can still be deployed; only today's prices are missing.
  Write-Warning "Could not load the shop, prices not updated: $($_.Exception.Message)"
  if ($env:GITHUB_ACTIONS) { Write-Host "::warning::Shop could not be loaded - today's prices were not saved" }
  return
}
$shopDay = To-Day $shop.date
$today = @{}   # id -> record; a separately sold offer beats a bundle, then the lowest price wins
foreach ($entry in @($shop.entries)) {
  $br = @($entry.brItems | Where-Object { $_ -and $KEEP -contains $_.type.value })
  if ($br.Count -eq 0) { continue }
  $offerItems = @($entry.brItems | Where-Object { $_ })
  for ($k = 0; $k -lt $br.Count; $k++) {
    $isBundle = $false; $bundleName = $null
    if ($entry.bundle) { $isBundle = $true; $bundleName = $entry.bundle.name }
    elseif ($offerItems.Count -gt 1 -and $br[$k].id -ne $offerItems[0].id) {
      # e.g. a back bling included with a skin: not sold separately here
      $isBundle = $true; $bundleName = $offerItems[0].name
    }
    $rec = [ordered]@{ date = $shopDay; price = [int]$entry.finalPrice; regular = [int]$entry.regularPrice; bundle = $isBundle; bundleName = $bundleName }
    $cur = $today[$br[$k].id]
    if (-not $cur -or ($cur.bundle -and -not $isBundle) -or ($cur.bundle -eq $isBundle -and $rec.price -lt $cur.price)) {
      $today[$br[$k].id] = $rec
    }
  }
}
foreach ($id in $today.Keys) {
  if (-not $prices.ContainsKey($id)) { $prices[$id] = New-Object System.Collections.ArrayList }
  $list = $prices[$id]
  for ($k = $list.Count - 1; $k -ge 0; $k--) { if ($list[$k].date -eq $shopDay) { $list.RemoveAt($k) } }
  [void]$list.Add($today[$id])
}
# ---------- "Vandaag in de shop" ----------
$shopItems = New-Object System.Collections.ArrayList
foreach ($entry in @($shop.entries)) {
  foreach ($b in @($entry.brItems | Where-Object { $_ -and $KEEP -contains $_.type.value })) {
    if (@($shopItems | Where-Object { $_.id -eq $b.id }).Count) { continue }
    $card = $byId[$b.id]
    if (-not $card) {
      # Brand-new item that the cosmetics list doesn't have yet: use the shop's own data.
      $card = @{ id = $b.id; n = $b.name; t = $b.type.value; r = $b.rarity.value; rd = $b.rarity.displayValue
                 sc = $(if ($b.series) { $b.series.colors[0] } else { $null }); si = Get-SeasonIndex $shopDay
                 d = $shopDay; l = $shopDay; i = $(if ($b.images.smallIcon) { $b.images.smallIcon } else { $b.images.icon }) }
    }
    $rec = $today[$b.id]
    $o = [ordered]@{}
    foreach ($k in @('id', 'n', 't', 'r', 'rd', 'sc', 'si', 'i')) { $o[$k] = $card[$k] }
    $o.price = $rec.price; $o.regular = $rec.regular; $o.bundle = $rec.bundle; $o.bundleName = $rec.bundleName
    [void]$shopItems.Add($o)
  }
}
$shopSorted = @($shopItems | Sort-Object { $typeOrder[$_.t] }, { -$_.price }, { $_.n })
Save-Json (Join-Path $dataDir 'shop.json') ([ordered]@{ date = $shopDay; items = $shopSorted })
Write-Host "Wrote data/shop.json: $($shopSorted.Count) items in the shop of $shopDay"

$sorted = [ordered]@{}
foreach ($id in ($prices.Keys | Sort-Object)) { $sorted[$id] = @($prices[$id] | Sort-Object { $_.date }) }
$json = ConvertTo-Json -InputObject $sorted -Depth 6 -Compress
[System.IO.File]::WriteAllText($pricesPath, $json, $utf8)
Write-Host "Shop of $shopDay - recorded prices for $($today.Count) items ($($sorted.Count) items with price history)"
