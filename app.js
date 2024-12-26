const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const axios = require('axios');

const DIRECT_LINE_SECRET = 'Bearer Ho4kmkcvszc.rESAsx5Iqv1Mqx3D26EQF85HzGL2SsfI27zVmanjl38';
// Create HTTPS server with the correct certificate and key configurations
const server = https.createServer({
    cert: fs.readFileSync('.\\Files\\unfydssl_2024.pem'),
    key: fs.readFileSync('.\\Files\\privateKey.key'),
    passphrase: 'Smartyz@6541'
});

/// WebSocket server attached to the HTTPS server
const wss = new WebSocket.Server({ server });

// Listen for connections on the WebSocket server
wss.on('connection', (clientSocket) => {
    console.log('Client connected to WebSocket server');
    // Message handling logic here...
    clientSocket.on('message', async (message) => {
        try {
            const { API_Key, Client_Secret } = JSON.parse(message);
            console.log('Received static parameters:', 'API_Key =>', API_Key, ', Client_Secret =>', Client_Secret);
            clientSocket.send(`Server received static parameters: ${message}`);

            try {
                const token = await getDirectLineToken();
                const conversationId = await getConversationId(token);

                // const botFrameworkUrl = `wss://centralindia.directline.botframework.com/v3/directline/conversations/${conversationId}/stream?t=${token}`;
                const botFrameworkUrl = `wss://directline.botframework.com/v3/directline/conversations/${conversationId}/stream?watermark=-&t=${token}`;
                const botSocket = new WebSocket(botFrameworkUrl);

                botSocket.on('open', () => {
                    console.log('Connected to Azure Bot Framework');
                    const dynamicMessage = { API_Key, Client_Secret };
                    botSocket.send(JSON.stringify(dynamicMessage));
                });

                botSocket.on('message', (data) => {
                    clientSocket.send(data.toString());
                });

                clientSocket.on('close', () => botSocket.close());
                botSocket.on('close', () => clientSocket.close());

                botSocket.on('error', (error) => {
                    console.log.error('Azure WebSocket error:', error);
                    clientSocket.send(JSON.stringify({ error: 'Failed to connect to Azure Bot Framework' }));
                    clientSocket.close();
                });
            } catch (error) {
                console.log.error('Error establishing Azure Bot connection:', error);
                clientSocket.send(JSON.stringify({ error: 'Failed to connect to Azure Bot Framework' }));
                clientSocket.close();
            }
        } catch (err) {
            console.log.error('Invalid JSON format in received message:', message);
            clientSocket.send(JSON.stringify({ error: 'Invalid message format' }));
        }
    });

    clientSocket.on('error', (error) => {
        console.log.error('WebSocket server error:', error);
    });
});

// Start the server and WebSocket server on port 443 dd
// const PORT = 443;
const PORT = process.env.PORT || 443;
server.listen(PORT, () => {
    console.log(`WebSocket server running on wss://localhost:${PORT}`);
});

// Helper functions
async function getDirectLineToken() {
    const response = await axios.post('https://directline.botframework.com/v3/directline/tokens/generate', {}, {
        // headers: { 'Authorization': `Bearer ${DIRECT_LINE_SECRET}` } // Replace with actual Direct Line secret
        headers: { 'Authorization': `${DIRECT_LINE_SECRET}` } // Replace with actual Direct Line secret
    });
    return response.data.token;
}

async function getConversationId(token) {
    const response = await axios.post('https://directline.botframework.com/v3/directline/conversations', {}, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data.conversationId;
}

// Client WebSocket code for testing
const socket = new WebSocket('wss://localhost:443', {
    rejectUnauthorized: false // Allow self-signed certificates for testing
});
socket.on('open', () => {
    console.log('Connected to WebSocket server');
    socket.send(JSON.stringify({ API_Key: 'param1', Client_Secret: 'param2' }));
});
socket.on('message', (data) => {
    console.log('Message from server:', data.toString());
});
socket.on('error', (error) => {
    console.log.error('WebSocket client error:', error);
});
socket.on('close', () => {
    console.log('Client connection closed');
});
