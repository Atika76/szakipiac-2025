param(
  [int]$Port = 4174
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
Set-Location $project

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
}

$env:PORT = "$Port"
$env:HOST = '0.0.0.0'
$env:NODE_ENV = 'production'

npm install
npm run build
npm start
