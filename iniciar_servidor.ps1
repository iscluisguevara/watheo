# =============================================================================
# WATHEO - Script de Inicio del Servidor (Windows PowerShell)
# =============================================================================
$raiz = $PSScriptRoot
$archivo = Join-Path $raiz 'backend\config\clave_dispositivo.txt'
$carpeta = Split-Path $archivo -Parent

New-Item -ItemType Directory -Force -Path $carpeta | Out-Null

if (-not (Test-Path $archivo)) {
    $clave = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    Set-Content -Path $archivo -Value $clave -Encoding ascii -NoNewline
    Write-Host 'Se ha generado la clave del dispositivo UNA SOLA VEZ.'
}

$env:WATHEO_API_KEY = (Get-Content -Path $archivo -Raw).Trim()
if ($env:WATHEO_API_KEY.Length -lt 32) {
    throw 'Clave demasiado corta (mínimo 32 caracteres)'
}

Write-Host 'Clave API cargada correctamente.'
Write-Host 'Frontend: http://127.0.0.1:8100/frontend/index.html'
Write-Host 'API Monitoreo: http://127.0.0.1:8100/backend/api/monitoreo.php'
Write-Host 'API Registros: http://127.0.0.1:8100/backend/api/registros.php'
Write-Host 'Endpoint Sensores (POST): http://127.0.0.1:8100/backend/sensores/recibir.php'

php -S 127.0.0.1:8100 -t $raiz
