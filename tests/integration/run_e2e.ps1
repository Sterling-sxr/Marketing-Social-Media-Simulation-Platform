Param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$Email = "teacher@ad.unsw.edu.au",
  [string]$Password = "P@ssw0rd-ChangeMe",
  [string]$Code = "1234",
  [switch]$Build,
  [switch]$DownAfter
)

$ErrorActionPreference = 'Stop'

function Invoke-ComposeUp {
  if ($Build) {
    docker compose up -d --build | Out-Null
  } else {
    docker compose up -d | Out-Null
  }
}

function Wait-Health {
  param([string]$Url, [int]$Seconds=60)
  Write-Host "Waiting for backend health at $Url ..."
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    try {
      $resp = Invoke-RestMethod -Method GET -Uri "$Url/api/health" -TimeoutSec 5
      if ($resp.ok -eq $true) { Write-Host "Backend healthy"; return }
    } catch { Start-Sleep -Milliseconds 800 }
  } while ((Get-Date) -lt $deadline)
  throw "Backend not healthy within ${Seconds}s"
}

function New-JsonBody { param([hashtable]$Map) return ($Map | ConvertTo-Json -Depth 6) }

function Step($name, [scriptblock]$action) {
  Write-Host "==> $name"
  & $action
}

Invoke-ComposeUp
Wait-Health -Url $BaseUrl -Seconds 90

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Auth: send code (ignore if already registered)
Step "Auth: send verification code" {
  try {
    $body = New-JsonBody @{ email = $Email }
    Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/auth/send-code/" -ContentType 'application/json' -Body $body -WebSession $session | Out-Null
  } catch {
    Write-Host "(warn) send-code: $($_.Exception.Message)"
  }
}

# Auth: verify code
Step "Auth: verify code" {
  try {
    $body = New-JsonBody @{ email = $Email; code = $Code }
    Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/auth/verify-code/" -ContentType 'application/json' -Body $body -WebSession $session | Out-Null
  } catch {
    Write-Host "(warn) verify-code: $($_.Exception.Message)"
  }
}

# Auth: set password (complete)
Step "Auth: complete registration" {
  try {
    $body = New-JsonBody @{ email = $Email; password = $Password }
    Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/auth/set-password/" -ContentType 'application/json' -Body $body -WebSession $session | Out-Null
  } catch {
    Write-Host "(warn) set-password: $($_.Exception.Message)"
  }
}

# Auth: login
Step "Auth: login" {
  $body = New-JsonBody @{ email = $Email; password = $Password }
  $resp = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/auth/login/" -ContentType 'application/json' -Body $body -WebSession $session
  Write-Host ("Logged in as: {0}" -f ($resp.user.email))
}

# Profile: submit minimal
Step "Profile: submit" {
  $body = New-JsonBody @{
    gender = 'female'; city = 'Sydney'; age_group='18-24'; education_level='Undergraduate'; income_level='<30k';
    social_value=5; interests=@('tech'); sociability=6; openness=7; shopping_frequency='monthly'; buying_behavior='value';
    decision_factor='price'; shopping_preference='online'; digital_time='2-4h'; content_preference='video'; interaction_style='commenter'; influencer_type='micro'
  }
  Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/profile/submit/" -ContentType 'application/json' -Body $body -WebSession $session | Out-Null
}

# Demo: create message
Step "Demo: create message" {
  $body = New-JsonBody @{ content = "Hello database $(Get-Date -Format s)" }
  $msg = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/messages/" -ContentType 'application/json' -Body $body -WebSession $session
  Write-Host ("Created message id={0}" -f $msg.id)
}

# Demo: upload sample file
Step "Demo: upload file" {
  $filePath = Join-Path $PSScriptRoot 'assets\sample-upload.png'
  if (-not (Test-Path $filePath)) { throw "Missing file: $filePath" }
  $form = @{
    file = Get-Item -LiteralPath $filePath
  }
  $upload = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/messages/files/" -Form $form -WebSession $session
  Write-Host ("Uploaded file id={0}, name={1}" -f $upload.id, $upload.original_name)
}

# Demo: notifications simulate + list
Step "Demo: simulate notification" {
  $body = New-JsonBody @{ actor='bob'; recipient='alice'; action='replied'; subject='bob replied to your post'; body='Thanks!'; metadata=@{ post_id='post-42' } }
  Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/messages/notifications/simulate" -ContentType 'application/json' -Body $body -WebSession $session | Out-Null
}

Step "Demo: list notifications" {
  $notif = Invoke-RestMethod -Method GET -Uri "$BaseUrl/api/messages/notifications/?user=alice" -WebSession $session
  Write-Host ("Notifications total={0}, unread={1}" -f ($notif.items | Measure-Object | Select -ExpandProperty Count), $notif.unread)
}

Write-Host "All basic E2E steps completed."

if ($DownAfter) {
  Write-Host "Bringing stack down ..."
  docker compose down -v | Out-Null
}

