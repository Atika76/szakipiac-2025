# SzakiPiac -> Építési Napló import function deploy
# Ezt a szakipiac-2025 repo gyökérmappájából futtasd PowerShellben.

Write-Host "SzakiPiac import function deploy indul..." -ForegroundColor Cyan
Write-Host "Projekt: bxtpnotswnwrbycvfypz" -ForegroundColor Yellow

npx --yes supabase@latest functions deploy send-quote-to-epitesnaplo --project-ref bxtpnotswnwrbycvfypz --debug

Write-Host "Kész. Ha hiba volt, a fenti piros szöveget másold be ChatGPT-be." -ForegroundColor Green
Read-Host "Nyomj Entert a bezáráshoz"
