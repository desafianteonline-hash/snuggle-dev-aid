@echo off
chcp 65001 >nul
title CODSEG GPS - Instalador de Patrulheiro
color 0A

echo ╔══════════════════════════════════════════════════════════╗
echo ║       CODSEG GPS - Instalador de Patrulheiro            ║
echo ║       Configuração Automática via ADB                   ║
echo ║       Com Modo Device Owner (Anti-Desinstalação)        ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: ============================================================
:: CONFIGURAÇÕES
:: ============================================================
set "APK_PATH=app-release.apk"
set "PACKAGE_NAME=app.lovable.14ba73db76cd432c9dc666e380d9de5a"
set "ADMIN_RECEIVER=%PACKAGE_NAME%/.AdminReceiver"

:: ============================================================
:: MENU PRINCIPAL
:: ============================================================
echo Selecione o modo de instalação:
echo.
echo   [1] Instalação PADRÃO (permissões + bateria)
echo   [2] Instalação com DEVICE OWNER (impede desinstalação)
echo   [3] Remover Device Owner (liberar dispositivo)
echo   [4] Apenas verificar status do dispositivo
echo.
set /p "MODO=Digite a opção (1/2/3/4): "

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
    pause
    exit /b 1
)
echo [OK] ADB encontrado.

if not exist "%APK_PATH%" (
    if "%MODO%"=="3" goto :SKIP_APK_CHECK
    if "%MODO%"=="4" goto :SKIP_APK_CHECK
    echo [ERRO] APK não encontrado: %APK_PATH%
    echo Coloque o arquivo APK na mesma pasta deste script.
    pause
    exit /b 1
)
:SKIP_APK_CHECK

echo [OK] Verificações iniciais concluídas.
echo.
echo Aguardando dispositivo conectado via USB...
adb wait-for-device
echo [OK] Dispositivo conectado.
echo.

:: Informações do dispositivo
echo ── Informações do Dispositivo ──────────────────────────
for /f "tokens=*" %%a in ('adb shell getprop ro.product.model') do echo    Modelo: %%a
for /f "tokens=*" %%a in ('adb shell getprop ro.product.manufacturer') do echo    Fabricante: %%a
for /f "tokens=*" %%a in ('adb shell getprop ro.build.version.release') do echo    Android: %%a
for /f "tokens=*" %%a in ('adb shell getprop ro.build.version.sdk') do echo    API Level: %%a
echo ─────────────────────────────────────────────────────────
echo.

:: Verificar status atual do Device Owner
echo ── Status Device Owner ─────────────────────────────────
adb shell dpm list-owners 2>nul
echo ─────────────────────────────────────────────────────────
echo.

if "%MODO%"=="1" goto :MODO_PADRAO
if "%MODO%"=="2" goto :MODO_DEVICE_OWNER
if "%MODO%"=="3" goto :REMOVER_DEVICE_OWNER
if "%MODO%"=="4" goto :FIM_VERIFICACAO

echo [ERRO] Opção inválida.
pause
exit /b 1

:: ============================================================
:: MODO 1: INSTALAÇÃO PADRÃO
:: ============================================================
:MODO_PADRAO
echo ══════════════════════════════════════════════════════════
echo  MODO PADRÃO - Instalação com permissões
echo ══════════════════════════════════════════════════════════
echo.

echo [1/4] Instalando o APK...
adb install -r -g "%APK_PATH%"
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar o APK.
    pause
    exit /b 1
)
echo [OK] APK instalado.
echo.

call :CONCEDER_PERMISSOES
call :CONFIGURAR_BATERIA
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
echo  ATENÇÃO: O Device Owner requer que o dispositivo tenha
echo  APENAS UMA CONTA Google configurada (ou nenhuma).
echo.
echo  Se houver múltiplas contas, remova todas exceto uma
echo  antes de continuar.
echo.
echo  IMPORTANTE: Para definir Device Owner, o dispositivo
echo  deve estar em um dos seguintes estados:
echo    - Factory reset recente (sem contas configuradas)
echo    - Apenas 1 conta Google configurada
echo.
set /p "CONFIRMA=Deseja continuar? (S/N): "
if /i not "%CONFIRMA%"=="S" (
    echo Operação cancelada.
    pause
    exit /b 0
)

:: Etapa 1: Instalar APK
echo.
echo [1/6] Instalando o APK...
adb install -r -g "%APK_PATH%"
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar o APK.
    pause
    exit /b 1
)
echo [OK] APK instalado.
echo.

:: Etapa 2: Conceder permissões
call :CONCEDER_PERMISSOES

:: Etapa 3: Configurar bateria
call :CONFIGURAR_BATERIA

:: Etapa 4: Definir como Device Owner
echo [4/6] Definindo como Device Owner...
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
    echo.
    echo Tentando método alternativo via Device Policy...
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

:: Etapa 5: Bloquear desinstalação
echo [5/6] Bloqueando desinstalação do app...
adb shell dpm set-uninstall-blocked %ADMIN_RECEIVER% %PACKAGE_NAME% true 2>nul
if %errorlevel% neq 0 (
    echo [AVISO] Não foi possível bloquear desinstalação via DPM.
    echo Tentando via Package Manager...
)

:: Impedir que o usuário desative o app
adb shell pm disable-user --user 0 com.android.packageinstaller 2>nul
echo [OK] Proteção contra desinstalação configurada.
echo.

:: Etapa 6: Configurações adicionais de Device Owner
echo [6/6] Aplicando políticas de dispositivo...

:: Impedir reset de fábrica (opcional)
adb shell dpm set-factory-reset-protection-policy %ADMIN_RECEIVER% 2>nul

:: Desativar fontes desconhecidas (evitar instalar outros apps)
adb shell settings put secure install_non_market_apps 0 2>nul

:: Manter tela ligada enquanto carrega (útil para verificação)
adb shell settings put global stay_on_while_plugged_in 3 2>nul

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
echo  VERIFICAÇÃO CONCLUÍDA
echo ══════════════════════════════════════════════════════════
echo.
echo Verifique as informações acima sobre o dispositivo.
echo.
pause
exit /b 0

:: ============================================================
:: FUNÇÕES REUTILIZÁVEIS
:: ============================================================

:CONCEDER_PERMISSOES
echo [2/6] Concedendo permissões de localização...
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
adb shell pm grant %PACKAGE_NAME% android.permission.RECEIVE_BOOT_COMPLETED 2>nul
echo    [OK] Iniciar no boot
echo.
goto :eof

:CONFIGURAR_BATERIA
echo [3/6] Desativando otimização de bateria...
adb shell dumpsys deviceidle whitelist +%PACKAGE_NAME% 2>nul
echo    [OK] Isenção de bateria
adb shell cmd appops set %PACKAGE_NAME% RUN_IN_BACKGROUND allow 2>nul
echo    [OK] Execução em segundo plano
adb shell cmd appops set %PACKAGE_NAME% RUN_ANY_IN_BACKGROUND allow 2>nul
echo    [OK] Execução irrestrita
echo.
goto :eof

:CONFIG_FABRICANTE
echo Aplicando configurações de fabricante...
adb shell am start -n com.miui.securitycenter/com.miui.permcenter.autostart.AutoStartManagementActivity 2>nul
adb shell am start -n com.samsung.android.lool/.activity.SleepingAppsActivity 2>nul
adb shell am start -n com.huawei.systemmanager/.appcontrol.activity.StartupNormalAppListActivity 2>nul
adb shell settings put global always_finish_activities 0 2>nul
echo    [OK] Configurações de fabricante aplicadas
echo.
goto :eof

:: ============================================================
:: FINALIZAÇÕES
:: ============================================================
:FIM_SUCESSO
echo ══════════════════════════════════════════════════════════
echo  INSTALAÇÃO PADRÃO CONCLUÍDA!
echo ══════════════════════════════════════════════════════════
echo.
echo  1. Abra o app "CODSEG GPS"
echo  2. Faça login com email e senha fornecidos
echo  3. Permita localização "O TEMPO TODO"
echo  4. Desative otimização de bateria se solicitado
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
echo  O app NÃO pode ser desinstalado pelo patrulheiro.
echo.
echo  Para liberar o dispositivo no futuro, execute este
echo  script novamente e escolha a opção 3.
echo.
echo  Próximos passos:
echo  1. Abra o app "CODSEG GPS"
echo  2. Faça login com email e senha fornecidos
echo  3. Permita localização "O TEMPO TODO"
echo.
adb shell monkey -p %PACKAGE_NAME% -c android.intent.category.LAUNCHER 1 2>nul
echo.
pause
exit /b 0
