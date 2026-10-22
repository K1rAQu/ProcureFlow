# PowerShell скрипт зупинки PostgreSQL
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$pgBin = "C:\Users\user\pgsql\bin"
$pgData = "C:\Users\user\pgsql\data"

Write-Host "Зупинка сервера PostgreSQL..." -ForegroundColor Yellow
& "$pgBin\pg_ctl.exe" -D $pgData stop
Write-Host "Сервер PostgreSQL зупинено." -ForegroundColor Green
