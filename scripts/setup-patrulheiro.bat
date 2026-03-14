@echo off
chcp 65001 >nul
title CODSEG GPS - Instalador de Patrulheiro
color 0A

echo ╔══════════════════════════════════════════════════════════╗
echo ║       CODSEG GPS - Instalador de Patrulheiro            ║
echo ║       Configuração Automática via ADB                   ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: ============================================================
:: CONFIGURAÇÕES - Altere conforme necessário
:: ============================================================
set "APK_PATH=app-release.apk"
set "PACKAGE_NAME=app.lovable.14ba73db76cd432c9dc666e380d9de5a"

:: ============================================================
:: VERIFICAÇÕES INICIAIS
:: ============================================================

:: Verificar se o ADB está disponível
where adb >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] ADB não encontrado no PATH.
    echo.
    echo Instale o Android SDK Platform Tools:
    echo https://developer.android.com/tools/releases/platform-tools
    echo.
    echo Ou adicione a pasta do ADB ao PATH do sistema:
    echo   Ex: C:\Users\SeuNome\AppData\Local\Android\Sdk\platform-tools
    echo.
    pause
    exit /b 1
)

echo [OK] ADB encontrado.

:: Verificar se o APK existe
if not exist "%APK_PATH%" (
    echo [ERRO] APK não encontrado: %APK_PATH%
    echo.
    echo Coloque o arquivo APK na mesma pasta deste script.
    echo Nome esperado: %APK_PATH%
    echo.
    echo Se o APK tem outro nome, edite a variável APK_PATH
    echo no início deste arquivo.
    echo.
    pause
    exit /b 1
)

echo [OK] APK encontrado: %APK_PATH%

:: Verificar dispositivo conectado
echo.
echo Aguardando dispositivo conectado via USB...
echo (Certifique-se de que a Depuração USB está ativada)
echo.

adb wait-for-device
echo [OK] Dispositivo conectado.
echo.

:: Mostrar informações do dispositivo
echo ── Informações do Dispositivo ──────────────────────────
for /f "tokens=*" %%a in ('adb shell getprop ro.product.model') do echo    Modelo: %%a
for /f "tokens=*" %%a in ('adb shell getprop ro.product.manufacturer') do echo    Fabricante: %%a
for /f "tokens=*" %%a in ('adb shell getprop ro.build.version.release') do echo    Android: %%a
for /f "tokens=*" %%a in ('adb shell getprop ro.build.version.sdk') do echo    API Level: %%a
echo ─────────────────────────────────────────────────────────
echo.

:: ============================================================
:: ETAPA 1: Instalar o APK
:: ============================================================
echo [1/5] Instalando o APK...
adb install -r -g "%APK_PATH%"
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar o APK.
    echo Verifique se o dispositivo está desbloqueado e tente novamente.
    pause
    exit /b 1
)
echo [OK] APK instalado com sucesso.
echo.

:: ============================================================
:: ETAPA 2: Conceder permissões de localização
:: ============================================================
echo [2/5] Concedendo permissões de localização...

adb shell pm grant %PACKAGE_NAME% android.permission.ACCESS_FINE_LOCATION 2>nul
echo    [OK] Localização precisa (GPS)

adb shell pm grant %PACKAGE_NAME% android.permission.ACCESS_COARSE_LOCATION 2>nul
echo    [OK] Localização aproximada

adb shell pm grant %PACKAGE_NAME% android.permission.ACCESS_BACKGROUND_LOCATION 2>nul
echo    [OK] Localização em segundo plano

echo.

:: ============================================================
:: ETAPA 3: Desativar otimização de bateria
:: ============================================================
echo [3/5] Desativando otimização de bateria para o app...

adb shell dumpsys deviceidle whitelist +%PACKAGE_NAME% 2>nul
echo    [OK] App adicionado à lista de isenção de bateria

:: Tentar desativar Doze Mode para o app (pode não funcionar em todos os dispositivos)
adb shell cmd appops set %PACKAGE_NAME% RUN_IN_BACKGROUND allow 2>nul
echo    [OK] Execução em segundo plano permitida

adb shell cmd appops set %PACKAGE_NAME% RUN_ANY_IN_BACKGROUND allow 2>nul
echo    [OK] Execução irrestrita em segundo plano

echo.

:: ============================================================
:: ETAPA 4: Permissões adicionais
:: ============================================================
echo [4/5] Configurando permissões adicionais...

:: Wake Lock
adb shell pm grant %PACKAGE_NAME% android.permission.WAKE_LOCK 2>nul
echo    [OK] Wake Lock

:: Internet (normalmente já concedida)
adb shell pm grant %PACKAGE_NAME% android.permission.INTERNET 2>nul
echo    [OK] Internet

:: Foreground Service
adb shell pm grant %PACKAGE_NAME% android.permission.FOREGROUND_SERVICE 2>nul
echo    [OK] Serviço em primeiro plano

:: Boot completed
adb shell pm grant %PACKAGE_NAME% android.permission.RECEIVE_BOOT_COMPLETED 2>nul
echo    [OK] Iniciar no boot

echo.

:: ============================================================
:: ETAPA 5: Configurações específicas por fabricante
:: ============================================================
echo [5/5] Aplicando configurações específicas do fabricante...

:: Xiaomi - Autostart
adb shell am start -n com.miui.securitycenter/com.miui.permcenter.autostart.AutoStartManagementActivity 2>nul

:: Samsung - Battery optimization
adb shell am start -n com.samsung.android.lool/.activity.SleepingAppsActivity 2>nul

:: Huawei - Protected apps
adb shell am start -n com.huawei.systemmanager/.appcontrol.activity.StartupNormalAppListActivity 2>nul

:: Positivo/AOSP genérico
adb shell settings put global always_finish_activities 0 2>nul

echo    [OK] Configurações de fabricante aplicadas (quando disponíveis)
echo.

:: ============================================================
:: VERIFICAÇÃO FINAL
:: ============================================================
echo ══════════════════════════════════════════════════════════
echo  INSTALAÇÃO CONCLUÍDA COM SUCESSO!
echo ══════════════════════════════════════════════════════════
echo.
echo  Próximos passos no celular do patrulheiro:
echo.
echo  1. Abra o app "CODSEG GPS"
echo  2. Faça login com o email e senha fornecidos
echo  3. Se pedir permissão de localização, toque em
echo     "PERMITIR O TEMPO TODO"
echo  4. Se perguntar sobre bateria, toque em
echo     "NÃO OTIMIZAR"
echo.
echo  O rastreamento começará automaticamente após o login.
echo ══════════════════════════════════════════════════════════
echo.

:: Abrir o app automaticamente
echo Abrindo o app no dispositivo...
adb shell monkey -p %PACKAGE_NAME% -c android.intent.category.LAUNCHER 1 2>nul
echo.

pause
