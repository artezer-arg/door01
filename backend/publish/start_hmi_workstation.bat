@echo off
cd /d "%~dp0"

if not exist "%~dp0wwwroot" (
    echo.
    echo ==========================================================
    echo ERROR: DEBES EXTRAER EL ARCHIVO ZIP ANTES DE EJECUTAR
    echo ==========================================================
    echo No puedes abrir el HMI directamente desde adentro del ZIP.
    echo.
    echo 1. Haz click derecho en el archivo .zip
    echo 2. Selecciona "Extraer todo..." y elige una carpeta.
    echo 3. Abre la carpeta descomprimida y ejecuta este archivo .bat.
    echo ==========================================================
    echo.
    pause
    exit /b
)

title Ensamble Door HMI - Servidor Workstation
echo ===================================================
echo   Iniciando Servidor HMI Ensamble Door (Puerto 5121)
echo ===================================================
echo.
echo Abriendo la pantalla del HMI en el navegador...
start "" http://localhost:5121
echo.
backend.exe
pause
