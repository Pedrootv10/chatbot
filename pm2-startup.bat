@echo off
:loop
:: Verifica se o PM2 está rodando
pm2 resurrect
if %errorlevel% neq 0 (
    echo "Erro ao tentar iniciar o PM2. Tentando novamente em 5 segundos..."
    timeout /t 5 /nobreak
    goto loop
)

:: Verifica se o chatbot.js está rodando, caso contrário, reinicia
pm2 list | findstr /C:"whatsapp-bot" > nul
if %errorlevel% neq 0 (
    echo "Bot não está rodando. Reiniciando..."
    pm2 start chatbot.js --name "whatsapp-bot"
    timeout /t 5 /nobreak
)

:: Continua o loop após iniciar ou verificar o PM2
goto loop
