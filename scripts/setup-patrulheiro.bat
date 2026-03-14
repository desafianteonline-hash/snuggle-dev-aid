@echo off
chcp 65001 >nul
title CODSEG GPS - Instalador de Patrulheiro v2.0
color 0A

echo ╔══════════════════════════════════════════════════════════╗
echo ║       CODSEG GPS - Instalador de Patrulheiro v2.0       ║
echo ║       Configuração Automática via ADB                   ║
echo ║       Device Owner + Rastreio em Segundo Plano          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: ============================================================
:: CONFIGURAÇÕES
:: ============================================================
set "APK_PATH=app-release.apk"
set "PACKAGE_NAME=app.lovable.14ba73db76cd432c9dc666e380d9de5a"
set "ADMIN_RECEIVER=%PACKAGE_NAME%/.AdminReceiver"
set "MAIN_ACTIVITY=%PACKAGE_NAME%/.MainActivity"

:: ============================================================
:: MENU PRINCIPAL
:: ============================================================
echo Selecione o modo de instalação:
echo.
echo   [1] Instalação COMPLETA (permissões + bateria + segundo plano)
echo   [2] Instalação com DEVICE OWNER (impede desinstalação)
echo   [3] Remover Device Owner (liberar dispositivo)
echo   [4] Verificar status do dispositivo
echo   [5] Apenas atualizar APK (manter configs)
echo   [6] Desinstalar app completamente
echo.
set /p "MODO=Digite a opção (1-6): "

:: ============================================================
:: VERIFICAÇÕES INICIAIS
:: ============================================================

where adb >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] ADB não encontrado no PATH.
    echo.
    echo Instale o Android SDK Platform Tools:
    echo https://developer.android.com/tools/releases/platform-tools
    echo.
    echo Ou adicione ao PATH: C:\Users\SeuUsuario\AppData\Local\Android\Sdk\platform-tools
    echo.
    pause
    exit /b 1
)
echo [OK] ADB encontrado.

:: Verificar se APK é necessário
if "%MODO%"=="3" goto :SKIP_APK_CHECK
if "%MODO%"=="4" goto :SKIP_APK_CHECK
if "%MODO%"=="6" goto :SKIP_APK_CHECK

if not exist "%APK_PATH%" (
    echo [ERRO] APK não encontrado: %APK_PATH%
    echo.
    echo Coloque o arquivo APK na mesma pasta deste script.
    echo Ou baixe em: https://snuggle-dev-aid.lovable.app/install
    echo.
    pause
    exit /b 1
)
:SKIP_APK_CHECK

echo [OK] Verificações iniciais concluídas.
echo.
echo Aguardando dispositivo conectado via USB...
echo (Certifique-se de que a Depuração USB está ativada)
adb wait-for-device
echo [OK] Dispositivo conectado.
echo.

:: Informações do dispositivo
echo ── Informações do Dispositivo ──────────────────────────
for /f "tokens=*" %%a in ('adb shell getprop ro.product.model') do set "DEV_MODEL=%%a"
for /f "tokens=*" %%a in ('adb shell getprop ro.product.manufacturer') do set "DEV_MANUF=%%a"
for /f "tokens=*" %%a in ('adb shell getprop ro.build.version.release') do set "DEV_ANDROID=%%a"
for /f "tokens=*" %%a in ('adb shell getprop ro.build.version.sdk') do set "DEV_API=%%a"
for /f "tokens=*" %%a in ('adb shell getprop ro.serialno') do set "DEV_SERIAL=%%a"
echo    Modelo:      %DEV_MODEL%
echo    Fabricante:  %DEV_MANUF%
echo    Android:     %DEV_ANDROID%
echo    API Level:   %DEV_API%
echo    Serial:      %DEV_SERIAL%
echo ─────────────────────────────────────────────────────────
echo.

:: Verificar status atual do Device Owner
echo ── Status Device Owner ─────────────────────────────────
adb shell dpm list-owners 2>nul
echo ─────────────────────────────────────────────────────────
echo.

:: Verificar se o app já está instalado
adb shell pm list packages | findstr /i "%PACKAGE_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] App já instalado no dispositivo.
) else (
    echo [INFO] App NÃO instalado no dispositivo.
)
echo.

if "%MODO%"=="1" goto :MODO_COMPLETO
if "%MODO%"=="2" goto :MODO_DEVICE_OWNER
if "%MODO%"=="3" goto :REMOVER_DEVICE_OWNER
if "%MODO%"=="4" goto :FIM_VERIFICACAO
if "%MODO%"=="5" goto :MODO_ATUALIZAR
if "%MODO%"=="6" goto :MODO_DESINSTALAR

echo [ERRO] Opção inválida.
pause
exit /b 1

:: ============================================================
:: MODO 1: INSTALAÇÃO COMPLETA
:: ============================================================
:MODO_COMPLETO
echo ══════════════════════════════════════════════════════════
echo  MODO COMPLETO - Instalação + Permissões + Background
echo ══════════════════════════════════════════════════════════
echo.

echo [1/5] Instalando o APK...
adb install -r -g "%APK_PATH%"
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar o APK.
    echo Tentando desinstalar versão anterior e reinstalar...
    adb uninstall %PACKAGE_NAME% 2>nul
    adb install -g "%APK_PATH%"
    if %errorlevel% neq 0 (
        echo [ERRO] Falha definitiva ao instalar o APK.
        pause
        exit /b 1
    )
)
echo [OK] APK instalado.
echo.

call :CONCEDER_PERMISSOES
call :CONFIGURAR_BATERIA
call :CONFIGURAR_BACKGROUND
call :CONFIG_FABRICANTE
goto :FIM_SUCESSO

:: ============================================================
:: MODO 2: DEVICE OWNER (ANTI-DESINSTALAÇÃO)
:: ============================================================
:MODO_DEVICE_OWNER
echo ══════════════════════════════════════════════════════════
echo  MODO DEVICE OWNER - Impede desinstalação
echo ══════════════════════════════════════════════════════════
echo.
echo  ╔════════════════════════════════════════════════════╗
echo  ║  REQUISITOS OBRIGATÓRIOS:                         ║
echo  ║                                                    ║
echo  ║  1. Dispositivo com factory reset recente          ║
echo  ║     OU apenas 1 conta Google configurada           ║
echo  ║                                                    ║
echo  ║  2. Nenhum outro Device Owner definido             ║
echo  ║                                                    ║
echo  ║  3. AdminReceiver compilado no APK                 ║
echo  ║     (ver guia de build nativo)                     ║
echo  ╚════════════════════════════════════════════════════╝
echo.
set /p "CONFIRMA=Deseja continuar? (S/N): "
if /i not "%CONFIRMA%"=="S" (
    echo Operação cancelada.
    pause
    exit /b 0
)

:: Verificar contas Google
echo.
echo Verificando contas Google no dispositivo...
adb shell pm list accounts 2>nul
echo.

:: Etapa 1: Instalar APK
echo [1/7] Instalando o APK...
adb install -r -g "%APK_PATH%"
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar o APK.
    echo Tentando desinstalar versão anterior e reinstalar...
    adb uninstall %PACKAGE_NAME% 2>nul
    adb install -g "%APK_PATH%"
    if %errorlevel% neq 0 (
        echo [ERRO] Falha definitiva ao instalar o APK.
        pause
        exit /b 1
    )
)
echo [OK] APK instalado.
echo.

:: Etapa 2: Conceder permissões
call :CONCEDER_PERMISSOES

:: Etapa 3: Configurar bateria
call :CONFIGURAR_BATERIA

:: Etapa 4: Configurar background
call :CONFIGURAR_BACKGROUND

:: Etapa 5: Definir como Device Owner
echo [5/7] Definindo como Device Owner...
echo.
adb shell dpm set-device-owner %ADMIN_RECEIVER% 2>nul
if %errorlevel% neq 0 (
    echo [AVISO] Falha ao definir Device Owner.
    echo.
    echo Possíveis causas:
    echo   - Já existe um Device Owner definido
    echo   - Há múltiplas contas Google no dispositivo
    echo   - O dispositivo não foi resetado de fábrica
    echo   - O AdminReceiver não está declarado no AndroidManifest
    echo   - O APK não foi compilado com o AdminReceiver nativo
    echo.
    echo Tentando definir como Device Admin (parcial)...
    adb shell dpm set-active-admin %ADMIN_RECEIVER% 2>nul
    if %errorlevel% neq 0 (
        echo [AVISO] Admin ativo também falhou.
        echo Continuando sem Device Owner...
    ) else (
        echo [OK] Definido como Device Admin (parcial).
    )
) else (
    echo [OK] Device Owner definido com sucesso!
)
echo.

:: Etapa 6: Bloquear desinstalação
echo [6/7] Bloqueando desinstalação do app...
adb shell dpm set-uninstall-blocked %ADMIN_RECEIVER% %PACKAGE_NAME% true 2>nul
if %errorlevel% neq 0 (
    echo [AVISO] Não foi possível bloquear desinstalação via DPM.
)

:: Impedir que o usuário desative o app nas configurações
adb shell pm disable-user --user 0 com.android.packageinstaller 2>nul
echo [OK] Proteção contra desinstalação configurada.
echo.

:: Etapa 7: Políticas adicionais de dispositivo
echo [7/7] Aplicando políticas de dispositivo...

:: Impedir reset de fábrica
adb shell dpm set-factory-reset-protection-policy %ADMIN_RECEIVER% 2>nul

:: Desativar fontes desconhecidas
adb shell settings put secure install_non_market_apps 0 2>nul

:: Manter tela ligada enquanto carrega
adb shell settings put global stay_on_while_plugged_in 3 2>nul

:: Impedir desativar GPS
adb shell settings put secure location_mode 3 2>nul

:: Forçar GPS sempre ligado
adb shell settings put secure location_providers_allowed +gps 2>nul
adb shell settings put secure location_providers_allowed +network 2>nul

echo [OK] Políticas de dispositivo aplicadas.
echo.

call :CONFIG_FABRICANTE
goto :FIM_SUCESSO_DEVICE_OWNER

:: ============================================================
:: MODO 3: REMOVER DEVICE OWNER
:: ============================================================
:REMOVER_DEVICE_OWNER
echo ══════════════════════════════════════════════════════════
echo  REMOVER DEVICE OWNER
echo ══════════════════════════════════════════════════════════
echo.
echo  ATENÇÃO: Isso vai liberar o dispositivo e permitir
echo  a desinstalação do app pelo patrulheiro.
echo.
set /p "CONFIRMA=Tem certeza? (S/N): "
if /i not "%CONFIRMA%"=="S" (
    echo Operação cancelada.
    pause
    exit /b 0
)

echo.
echo Removendo bloqueio de desinstalação...
adb shell dpm set-uninstall-blocked %ADMIN_RECEIVER% %PACKAGE_NAME% false 2>nul

echo Removendo Device Owner...
adb shell dpm remove-active-admin %ADMIN_RECEIVER% 2>nul

:: Reativar package installer
adb shell pm enable com.android.packageinstaller 2>nul

:: Restaurar fontes desconhecidas
adb shell settings put secure install_non_market_apps 1 2>nul

echo.
echo [OK] Device Owner removido. O dispositivo está liberado.
echo.
pause
exit /b 0

:: ============================================================
:: MODO 4: VERIFICAÇÃO
:: ============================================================
:FIM_VERIFICACAO
echo ══════════════════════════════════════════════════════════
echo  VERIFICAÇÃO COMPLETA
echo ══════════════════════════════════════════════════════════
echo.

:: Verificar permissões concedidas
echo ── Permissões do App ───────────────────────────────────
adb shell dumpsys package %PACKAGE_NAME% | findstr /i "permission" 2>nul
echo ─────────────────────────────────────────────────────────
echo.

:: Verificar whitelist de bateria
echo ── Whitelist de Bateria ────────────────────────────────
adb shell dumpsys deviceidle whitelist | findstr /i "%PACKAGE_NAME%" 2>nul
if %errorlevel% equ 0 (
    echo    [OK] App na whitelist de bateria
) else (
    echo    [AVISO] App NÃO está na whitelist de bateria
)
echo ─────────────────────────────────────────────────────────
echo.

:: Verificar se serviço de foreground está ativo
echo ── Serviços Ativos ─────────────────────────────────────
adb shell dumpsys activity services %PACKAGE_NAME% 2>nul | findstr /i "ServiceRecord" 2>nul
echo ─────────────────────────────────────────────────────────
echo.

:: Verificar GPS
echo ── Status GPS ──────────────────────────────────────────
for /f "tokens=*" %%a in ('adb shell settings get secure location_mode') do echo    Modo de localização: %%a (3=alta precisão)
for /f "tokens=*" %%a in ('adb shell settings get secure location_providers_allowed') do echo    Provedores: %%a
echo ─────────────────────────────────────────────────────────
echo.

pause
exit /b 0

:: ============================================================
:: MODO 5: ATUALIZAR APK
:: ============================================================
:MODO_ATUALIZAR
echo ══════════════════════════════════════════════════════════
echo  ATUALIZAÇÃO DE APK (mantém configurações)
echo ══════════════════════════════════════════════════════════
echo.

echo [1/2] Atualizando o APK...
adb install -r -g "%APK_PATH%"
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao atualizar o APK.
    pause
    exit /b 1
)
echo [OK] APK atualizado.
echo.

echo [2/2] Iniciando o app...
adb shell monkey -p %PACKAGE_NAME% -c android.intent.category.LAUNCHER 1 2>nul
echo [OK] App iniciado.
echo.
pause
exit /b 0

:: ============================================================
:: MODO 6: DESINSTALAR
:: ============================================================
:MODO_DESINSTALAR
echo ══════════════════════════════════════════════════════════
echo  DESINSTALAR APP COMPLETAMENTE
echo ══════════════════════════════════════════════════════════
echo.
echo  ATENÇÃO: Isso vai remover o app e todas as suas
echo  configurações do dispositivo.
echo.
set /p "CONFIRMA=Tem certeza? (S/N): "
if /i not "%CONFIRMA%"=="S" (
    echo Operação cancelada.
    pause
    exit /b 0
)

echo.
:: Remover Device Owner se existir
echo Removendo Device Owner (se existir)...
adb shell dpm set-uninstall-blocked %ADMIN_RECEIVER% %PACKAGE_NAME% false 2>nul
adb shell dpm remove-active-admin %ADMIN_RECEIVER% 2>nul
adb shell pm enable com.android.packageinstaller 2>nul

:: Remover da whitelist de bateria
echo Removendo da whitelist de bateria...
adb shell dumpsys deviceidle whitelist -%PACKAGE_NAME% 2>nul

:: Desinstalar
echo Desinstalando o app...
adb uninstall %PACKAGE_NAME%
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao desinstalar.
    echo O app pode estar protegido por Device Owner.
    echo Use a opção 3 primeiro para remover Device Owner.
    pause
    exit /b 1
)

echo.
echo [OK] App desinstalado com sucesso.
echo.
pause
exit /b 0

:: ============================================================
:: FUNÇÕES REUTILIZÁVEIS
:: ============================================================

:CONCEDER_PERMISSOES
echo [2/7] Concedendo permissões...
adb shell pm grant %PACKAGE_NAME% android.permission.ACCESS_FINE_LOCATION 2>nul
echo    [OK] Localização precisa (GPS)
adb shell pm grant %PACKAGE_NAME% android.permission.ACCESS_COARSE_LOCATION 2>nul
echo    [OK] Localização aproximada
adb shell pm grant %PACKAGE_NAME% android.permission.ACCESS_BACKGROUND_LOCATION 2>nul
echo    [OK] Localização em segundo plano
adb shell pm grant %PACKAGE_NAME% android.permission.WAKE_LOCK 2>nul
echo    [OK] Wake Lock
adb shell pm grant %PACKAGE_NAME% android.permission.FOREGROUND_SERVICE 2>nul
echo    [OK] Serviço em primeiro plano
adb shell pm grant %PACKAGE_NAME% android.permission.FOREGROUND_SERVICE_LOCATION 2>nul
echo    [OK] Foreground Service Location
adb shell pm grant %PACKAGE_NAME% android.permission.RECEIVE_BOOT_COMPLETED 2>nul
echo    [OK] Iniciar no boot
adb shell pm grant %PACKAGE_NAME% android.permission.POST_NOTIFICATIONS 2>nul
echo    [OK] Notificações (Android 13+)
adb shell pm grant %PACKAGE_NAME% android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS 2>nul
echo    [OK] Ignorar otimização de bateria
echo.
goto :eof

:CONFIGURAR_BATERIA
echo [3/7] Desativando otimização de bateria...
adb shell dumpsys deviceidle whitelist +%PACKAGE_NAME% 2>nul
echo    [OK] Isenção de Doze mode
adb shell cmd appops set %PACKAGE_NAME% RUN_IN_BACKGROUND allow 2>nul
echo    [OK] Execução em segundo plano
adb shell cmd appops set %PACKAGE_NAME% RUN_ANY_IN_BACKGROUND allow 2>nul
echo    [OK] Execução irrestrita
adb shell cmd appops set %PACKAGE_NAME% START_FOREGROUND allow 2>nul
echo    [OK] Iniciar foreground service
echo.
goto :eof

:CONFIGURAR_BACKGROUND
echo [4/7] Configurando rastreio em segundo plano...

:: Garantir que o GPS está ligado e no modo alta precisão
adb shell settings put secure location_mode 3 2>nul
echo    [OK] GPS modo alta precisão

:: Permitir localização em background
adb shell settings put secure location_providers_allowed +gps 2>nul
adb shell settings put secure location_providers_allowed +network 2>nul
echo    [OK] Provedores GPS+Network ativos

:: Impedir que o sistema mate o app
adb shell cmd appops set %PACKAGE_NAME% BOOT_COMPLETED allow 2>nul
echo    [OK] Auto-iniciar no boot

:: Desabilitar App Standby para o app
adb shell am set-inactive %PACKAGE_NAME% false 2>nul
echo    [OK] App Standby desativado

:: Configurar alarmes exatos (Android 12+)
adb shell cmd appops set %PACKAGE_NAME% SCHEDULE_EXACT_ALARM allow 2>nul
echo    [OK] Alarmes exatos permitidos

:: Impedir restrict background data
adb shell cmd netpolicy set restrict-background-blacklist %PACKAGE_NAME% false 2>nul
echo    [OK] Dados em background permitidos

:: Impedir restrict background usage
adb shell cmd appops set %PACKAGE_NAME% LEGACY_STORAGE allow 2>nul

echo.
goto :eof

:CONFIG_FABRICANTE
echo Aplicando configurações específicas de fabricante (%DEV_MANUF%)...

:: Xiaomi / MIUI
adb shell am start -n com.miui.securitycenter/com.miui.permcenter.autostart.AutoStartManagementActivity 2>nul

:: Samsung
adb shell am start -n com.samsung.android.lool/.activity.SleepingAppsActivity 2>nul

:: Huawei / Honor
adb shell am start -n com.huawei.systemmanager/.appcontrol.activity.StartupNormalAppListActivity 2>nul

:: Oppo / Realme / OnePlus (ColorOS)
adb shell am start -n com.coloros.safecenter/.startupapp.StartupAppListActivity 2>nul

:: Vivo
adb shell am start -n com.vivo.permissionmanager/.activity.BgStartUpManagerActivity 2>nul

:: Positivo / AOSP genérico
adb shell settings put global always_finish_activities 0 2>nul

:: Impedir que o sistema otimize o app (genérico)
adb shell cmd appops set %PACKAGE_NAME% SYSTEM_ALERT_WINDOW allow 2>nul

echo    [OK] Configurações de fabricante aplicadas
echo.
goto :eof

:: ============================================================
:: FINALIZAÇÕES
:: ============================================================
:FIM_SUCESSO
echo ══════════════════════════════════════════════════════════
echo  INSTALAÇÃO COMPLETA CONCLUÍDA!
echo ══════════════════════════════════════════════════════════
echo.
echo  Dispositivo: %DEV_MODEL% (%DEV_MANUF%)
echo  Android: %DEV_ANDROID% (API %DEV_API%)
echo  Serial: %DEV_SERIAL%
echo.
echo  Próximos passos:
echo  1. Abra o app "CODSEG GPS" no dispositivo
echo  2. Faça login com email e senha fornecidos
echo  3. Permita localização "O TEMPO TODO" se solicitado
echo  4. O rastreio em segundo plano já está configurado
echo.
adb shell monkey -p %PACKAGE_NAME% -c android.intent.category.LAUNCHER 1 2>nul
echo.
pause
exit /b 0

:FIM_SUCESSO_DEVICE_OWNER
echo ══════════════════════════════════════════════════════════
echo  INSTALAÇÃO COM DEVICE OWNER CONCLUÍDA!
echo ══════════════════════════════════════════════════════════
echo.
echo  Dispositivo: %DEV_MODEL% (%DEV_MANUF%)
echo  Android: %DEV_ANDROID% (API %DEV_API%)
echo  Serial: %DEV_SERIAL%
echo.
echo  ✓ App instalado e configurado
echo  ✓ Rastreio em segundo plano ativo
echo  ✓ Otimização de bateria desativada
echo  ✓ Device Owner definido
echo  ✓ Desinstalação BLOQUEADA
echo.
echo  Para liberar o dispositivo no futuro, execute este
echo  script novamente e escolha a opção 3.
echo.
echo  Próximos passos:
echo  1. Abra o app "CODSEG GPS"
echo  2. Faça login com email e senha fornecidos
echo  3. Permita localização "O TEMPO TODO" se solicitado
echo.
adb shell monkey -p %PACKAGE_NAME% -c android.intent.category.LAUNCHER 1 2>nul
echo.
pause
exit /b 0
