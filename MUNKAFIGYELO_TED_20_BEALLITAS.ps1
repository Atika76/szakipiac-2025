# SzakiPiac Munkafigyelő - TED közbeszerzések 20 darabos lekérése
# Futtatás PowerShellben a projekt mappából:
# .\MUNKAFIGYELO_TED_20_BEALLITAS.ps1

$ProjectRef = "bxtpnotswnwrbycvfypz"

$sources = @(
  @{
    key = "ted-hu-kozbeszerzesek"
    type = "ted"
    url = "https://api.ted.europa.eu/v3/notices/search"
    method = "POST"
    headers = @{
      "Content-Type" = "application/json"
    }
    body = @{
      query = "buyer-country = HUN"
      fields = @(
        "publication-number",
        "notice-title",
        "publication-date",
        "buyer-name",
        "business-country",
        "classification-cpv",
        "links"
      )
      limit = 20
    }
    itemPath = "notices"
    defaults = @{
      megye = "Országos"
      telepules = "Magyarország"
      szakma = "Egyéb szakember"
      surgosseg = "normal"
    }
  }
) | ConvertTo-Json -Depth 20 -Compress

Write-Host "MUNKAFIGYELO_SOURCES_JSON frissítése 20 TED találatra..." -ForegroundColor Cyan
supabase secrets set "MUNKAFIGYELO_SOURCES_JSON=$sources" --project-ref $ProjectRef

Write-Host "Kész. Most futtasd újra a collectort, hogy betöltse a 20 találatot." -ForegroundColor Green
Write-Host '$collectorUrl = "https://bxtpnotswnwrbycvfypz.supabase.co/functions/v1/munkafigyelo-collector"'
Write-Host '$headers = @{ "Content-Type" = "application/json"; "x-collector-secret" = "szakipiac-munkafigyelo-2026-titkos-frissites" }'
Write-Host '$body = @{ trigger = "manual-test" } | ConvertTo-Json'
Write-Host '$resp = Invoke-RestMethod -Method POST -Uri $collectorUrl -Headers $headers -Body $body'
Write-Host '$resp | ConvertTo-Json -Depth 20'
