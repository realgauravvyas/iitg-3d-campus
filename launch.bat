@echo off
rem IIT Guwahati 3D campus game.
rem With Node.js installed this starts a tiny local server (tools\serve.mjs) and opens the game from it,
rem so the films on the auditorium / Conference Centre screens play, and the Computer Centre PCs
rem (IITG OS) can browse real websites and search and play YouTube.
rem Keep the small "IITG 3D server" window open while you play (close it to stop the server).
rem Without Node.js the game opens straight from the file: everything else still works.
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  start "IITG 3D server - close to stop" /min node "%~dp0tools\serve.mjs" --open
) else (
  echo Node.js was not found, so the game opens without its web features:
  echo the films in the halls, YouTube and websites on the Computer Centre PCs need Node.js.
  echo Install it from https://nodejs.org and run this file again for the full game.
  start "" "%~dp0dist\IITG_Campus_3D.html"
  timeout /t 12
)
