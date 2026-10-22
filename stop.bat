@echo off
chcp 65001 >nul
set PG_BIN=C:\Users\user\pgsql\bin
set PG_DATA=C:\Users\user\pgsql\data

echo Зупинка сервера PostgreSQL...
"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" stop
echo Сервер PostgreSQL зупинено.
