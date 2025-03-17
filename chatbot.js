const qrcode = require('qrcode-terminal'); 
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

let reconnectAttempts = 0;
let saudacoesEnviadas = {}; // Armazena as saudações enviadas
let temposPrimeiraSaudacao = {}; // Armazena o tempo da primeira saudação por número

// Caminho para o arquivo JSON
const arquivoJson = path.join(__dirname, 'saudacoes.json');

// Função para limpar o arquivo JSON a cada 20 horas
function limparArquivoJson() {
    setInterval(() => {
        console.log('Limpando o arquivo JSON...');
        saudacoesEnviadas = {}; // Resetar saudações enviadas
        temposPrimeiraSaudacao = {}; // Resetar tempos de primeira saudação
        fs.writeFileSync(arquivoJson, JSON.stringify({ saudacoesEnviadas, temposPrimeiraSaudacao }, null, 2)); // Limpa o arquivo
        console.log('Arquivo JSON limpo!');
    }, 20 * 60 * 60 * 1000); // 20 horas
}

function initializeClient() {
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: "client-one" })
    });

    // Verifica se o arquivo JSON existe, se não cria um
    if (fs.existsSync(arquivoJson)) {
        const dados = JSON.parse(fs.readFileSync(arquivoJson, 'utf-8'));
        saudacoesEnviadas = dados.saudacoesEnviadas || {};
        temposPrimeiraSaudacao = dados.temposPrimeiraSaudacao || {};
    } else {
        fs.writeFileSync(arquivoJson, JSON.stringify({ saudacoesEnviadas, temposPrimeiraSaudacao }, null, 2));
    }

    client.on('qr', qr => qrcode.generate(qr, { small: true }));
    client.on('ready', () => console.log('Tudo certo! WhatsApp conectado.'));
    client.on('authenticated', () => console.log('Autenticação bem-sucedida!'));
    
    client.on('disconnected', (reason) => {
        console.log('Cliente desconectado. Motivo:', reason);
        attemptReconnect(client);
    });

    client.on('auth_failure', (msg) => {
        console.error('Falha na autenticação:', msg);
        attemptReconnect(client);
    });

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    client.on('message', async msg => {
        if (msg.isGroupMsg) return; // Garante que o bot não responda mensagens de grupos

        console.log(`Mensagem recebida de: ${msg.from} - Conteúdo: ${msg.body}`);
        
        const chat = await msg.getChat();
        if (chat.isGroup) return; // Verificação extra para garantir que não interaja com grupos
        
        const contact = await msg.getContact();
        const numero = contact.number;
        const hoje = new Date().toDateString();

        if (!saudacoesEnviadas[numero]) {
            saudacoesEnviadas[numero] = hoje;
            temposPrimeiraSaudacao[numero] = Date.now(); // Registra o tempo da primeira saudação
            const name = contact.pushname.split(" ")[0];
            
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await chat.sendMessage(`Olá! ${name}, que bom você por aqui 😄`);
            await delay(3000);
            await chat.sendMessage('Agora pedir ficou prático!\n\nSó clicar no link e fazer seu pedido, muito mais RÁPIDO e FÁCIL.');
            await delay(3000);
            await chat.sendMessage('Só clicar aqui: https://vovolaurapizzaria.online/');

            setTimeout(async () => {
                await chat.sendMessage(`😊 Aqui estão algumas informações que podem te ajudar:

📅 *Nosso funcionamento:*  
Aberto de segunda a segunda, só fechamos às terças-feiras.

💳 *Formas de pagamento:*  
Aceitamos *PIX, cartão e dinheiro na entrega*.

📍 *Endereço:*  
Sandoval Mesquita, 629 - Santa Lúcia 1, *Bom Despacho-MG*.

🍕 *Cardápio:*  
Confira e realize seu pedido em nosso cardápio completo aqui: (https://vovolaurapizzaria.online/)`);
            }, 120000);

            const timeout = setTimeout(async () => {
                console.log('Tempo de resposta expirado após 10 minutos.');
                await chat.sendMessage('Ei, tem uma pizza deliciosa esperando por você, só clicar no link e ser feliz: https://vovolaurapizzaria.online/, MAS se já pediu voce fez a MELHOR escolha😄');
            }, 600000);

            client.on('message', newMsg => {
                if (newMsg.from === msg.from && newMsg.body) clearTimeout(timeout);
            });
        }

        // Salva os dados no arquivo JSON
        fs.writeFileSync(arquivoJson, JSON.stringify({ saudacoesEnviadas, temposPrimeiraSaudacao }, null, 2));

        const delayedMessages = /\b(vai demorar muito|estou esperando|qual é o tempo de entrega|está demorando|ta chegando|vai demorar muito ainda|faz muito tempo que pedi|o pedido tá atrasado|que atraso|atraso|demorando|meu pedido já saiu|não foi entregue|nao foi entregue|já saiu|ta demorando)\b/i;
        
        if (delayedMessages.test(msg.body)) {
            const tempoDesdeSaudacao = (Date.now() - (temposPrimeiraSaudacao[numero] || 0)) / 60000; // Tempo em minutos
            if (tempoDesdeSaudacao >= 35) {
                await chat.sendStateTyping();
                await delay(3000);
                await chat.sendMessage('Desculpe mesmo, estamos lotados de pedidos, mas seu pedido já saiu para entrega e logo, logo estará aí, espero que compreenda!');
            }
        }

        if (msg.body.toLowerCase() === 'mtxre1') {
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await chat.sendMessage('PEDRO meu legítimo criador!');
        }
    });

    setInterval(() => console.log('Bot ainda está rodando...'), 600000);

    client.initialize();

    process.on('uncaughtException', (err) => {
        console.error('Erro não tratado:', err);
        attemptReconnect(client);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Rejeição não tratada em:', promise, 'Motivo:', reason);
        attemptReconnect(client);
    });
}

function attemptReconnect(client) {
    console.log('Tentando reconectar...');
    client.destroy().then(() => {
        reconnectAttempts++;
        const reconnectDelay = Math.min(15 * reconnectAttempts, 60); // Atraso de 15s por tentativa, até 1 minuto
        console.log(`Tentando reconectar em ${reconnectDelay} segundos...`);
        setTimeout(() => {
            console.log('Reconectando...');
            initializeClient();
        }, reconnectDelay * 1000); // Multiplicamos por 1000 para segundos
    });
}

// Inicia o bot e a limpeza do arquivo JSON
initializeClient();
limparArquivoJson();
