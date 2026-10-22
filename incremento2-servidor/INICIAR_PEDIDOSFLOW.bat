@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PedidosFlow - Incremento 2

echo ============================================
echo   PedidosFlow - Incremento 2
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro Node.js.
  echo Instala Node.js 20 o superior y vuelve a ejecutar este archivo.
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro npm. Revisa la instalacion de Node.js.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
  echo ERROR: No se pudo determinar la version de Node.js.
  pause
  exit /b 1
)
if %NODE_MAJOR% LSS 20 (
  echo ERROR: PedidosFlow requiere Node.js 20 o superior.
  node --version
  echo Instala una version LTS desde https://nodejs.org/
  pause
  exit /b 1
)

if not exist "package.json" (
  echo ERROR: No se encontro package.json en esta carpeta.
  echo Este archivo debe estar junto a la carpeta src.
  echo No lo ejecutes desde prototipo-figma ni desde la carpeta exterior.
  echo.
  pause
  exit /b 1
)

if not exist "src\index.ts" (
  echo ERROR: No se encontro src\index.ts.
  echo Descomprime el ZIP completo y ejecuta el .bat desde la raiz de PedidosFlow.
  echo.
  pause
  exit /b 1
)

rem Revisar archivos de dependencias, no solo la existencia de sus carpetas.
rem Esto repara instalaciones previas incompletas que antes pasaban la comprobacion.
if not exist "node_modules\.package-lock.json" goto instalar_dependencias
if not exist "node_modules\tsx\dist\cli.mjs" goto instalar_dependencias
if not exist "node_modules\express\index.js" goto instalar_dependencias
if not exist "node_modules\typescript\bin\tsc" goto instalar_dependencias
if not exist "node_modules\@types\node\index.d.ts" goto instalar_dependencias
if not exist "node_modules\@types\express\index.d.ts" goto instalar_dependencias
goto iniciar_servidor

:instalar_dependencias
echo.
echo No se encontraron todas las dependencias o la instalacion esta incompleta.
echo Instalando desde package-lock.json. Esta operacion requiere Internet...
echo.
call npm ci --no-audit --no-fund
if errorlevel 1 goto error

rem Validar que la instalacion termino y que el comando principal esta disponible.
if not exist "node_modules\tsx\dist\cli.mjs" goto error
if not exist "node_modules\express\index.js" goto error

:iniciar_servidor
echo.
echo Iniciando servidor...
echo Cuando aparezca que el servidor esta listo, abre http://localhost:3001
echo Para detenerlo, vuelve aqui y presiona Ctrl+C.
echo.
call npm start
set "APP_EXIT=%ERRORLEVEL%"
if not "%APP_EXIT%"=="0" goto error
exit /b 0

:error
echo.
echo No se pudo completar el inicio de PedidosFlow.
echo Copia el error que aparece arriba: puede ser la instalacion de dependencias o el servidor.
echo Comprueba que tienes Internet la primera vez y Node.js 20 o superior.
echo.
pause
exit /b 1
