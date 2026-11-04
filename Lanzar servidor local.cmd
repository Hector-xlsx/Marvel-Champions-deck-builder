@echo off
setlocal
cd /d "%~dp0" || exit /b 1

powershell.exe -NoLogo -NoProfile -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$server = $null;" ^
  "try {" ^
  "  $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source;" ^
  "  if (-not $node) {" ^
  "    $node = Join-Path $env:ProgramFiles 'nodejs\node.exe';" ^
  "    if (-not (Test-Path -LiteralPath $node)) {" ^
  "      $node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe';" ^
  "    }" ^
  "  }" ^
  "  if (-not (Test-Path -LiteralPath $node)) { throw 'Se requiere Node.js 22 o posterior. Instala Node.js y vuelve a abrir el lanzador.' }" ^
  "  $index = Get-Content -LiteralPath 'dist\index.html' -Raw -Encoding UTF8;" ^
  "  $env:PORT = '4187';" ^
  "  $url = 'http://127.0.0.1:4187/';" ^
  "  $ready = {" ^
  "    try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1 } catch { return $false }" ^
  "    if ($response.Content -cne $index) { throw 'El puerto 4187 esta ocupado por otra aplicacion.' }" ^
  "    return $true;" ^
  "  };" ^
  "  if (-not (& $ready)) {" ^
  "    $server = Start-Process -FilePath $node -ArgumentList 'scripts/servir-gestor.mjs' -NoNewWindow -PassThru;" ^
  "    for ($attempt = 0; $attempt -lt 30; $attempt++) {" ^
  "      if (& $ready) { break }" ^
  "      if ($server.HasExited) { throw 'El servidor se cerro al iniciar.' }" ^
  "      Start-Sleep -Milliseconds 200;" ^
  "    }" ^
  "    if ($attempt -eq 30) { throw 'El servidor no respondio a tiempo.' }" ^
  "  }" ^
  "  Start-Process $url;" ^
  "  if ($server -and -not $server.HasExited) {" ^
  "    Write-Host 'Cierra esta ventana para detener el servidor.';" ^
  "    $server.WaitForExit();" ^
  "  }" ^
  "} catch {" ^
  "  Write-Host $_.Exception.Message -ForegroundColor Red;" ^
  "  exit 1;" ^
  "} finally {" ^
  "  if ($server -and -not $server.HasExited) { $server.Kill() }" ^
  "}"

if errorlevel 1 pause
