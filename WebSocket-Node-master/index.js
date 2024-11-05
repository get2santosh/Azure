const WebSocket = require('ws');
const axios = require('axios');

// Create a WebSocket server on port 443 (or any port you prefer)
const PORT = 443;
const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (clientSocket) => {
    console.log('Client connected to WebSocket server');

    clientSocket.on('message', async (message) => {
        // Parse the incoming message from audio connector
        try {
            const { API_Key, Client_Secret } = JSON.parse(message);
            console.log('Received static parameters:', 'API_Key =>', API_Key, ', Client_Secret =>', Client_Secret);
            clientSocket.send(`Server received static parameters: ${message}`);

            try {
                // Generate Direct Line token and conversation ID for Bot Framework only once
                const token = await getDirectLineToken();
                const conversationId = await getConversationId(token);

                // Construct Bot Framework WebSocket URL
                const botFrameworkUrl = `wss://centralindia.directline.botframework.com/v3/directline/conversations/${conversationId}/stream?t=${token}`;

                // Connect to Azure Bot Framework
                const botSocket = new WebSocket(botFrameworkUrl);

                botSocket.on('open', () => {
                    console.log('Connected to Azure Bot Framework');

                    // Send the static parameters as dynamic parameters to Azure
                    const dynamicMessage = {
                        API_Key,
                        Client_Secret
                    };
                    botSocket.send(JSON.stringify(dynamicMessage));
                });

                botSocket.on('message', (data) => {
                    clientSocket.send(data.toString());  // Forward messages from Azure to audio connector
                });

                // Close connections if either side closes
                clientSocket.on('close', () => {
                    console.log('Client disconnected');
                    botSocket.close();
                });

                botSocket.on('close', () => {
                    console.log('Bot Framework connection closed');
                    clientSocket.close();
                });

                // Handle botSocket errors
                botSocket.on('error', (error) => {
                    console.error('Azure WebSocket error:', error);
                    clientSocket.send(JSON.stringify({ error: 'Failed to connect to Azure Bot Framework' }));
                    clientSocket.close();
                });
            } catch (error) {
                console.error('Error establishing Azure Bot connection:', error);
                clientSocket.send(JSON.stringify({ error: 'Failed to connect to Azure Bot Framework' }));
                clientSocket.close();
            }
        } catch (err) {
            console.error('Invalid JSON format in received message:', message);
            clientSocket.send(JSON.stringify({ error: 'Invalid message format' }));
        }
    });

    clientSocket.on('error', (error) => {
        console.error('WebSocket server error:', error);
    });
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);

// Helper functions for token and conversation ID
async function getDirectLineToken() {
    const response = await axios.post('https://directline.botframework.com/v3/directline/tokens/generate', {}, {
        headers: { 'Authorization': `Bearer YOUR_DIRECTLINE_SECRET` } // Replace with actual Direct Line secret
    });
    return response.data.token;
}

async function getConversationId(token) {
    const response = await axios.post('https://directline.botframework.com/v3/directline/conversations', {}, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data.conversationId;
}

// Client code to initiate a WebSocket connection to the local server
const socket = new WebSocket(`ws://localhost:${PORT}`);
socket.on('open', () => {
    console.log('Connected to WebSocket server');
    socket.send(JSON.stringify({ API_Key: 'param1', Client_Secret: 'param2' }));
});

socket.on('message', (data) => {
    console.log('Message from server:', data.toString());
});

socket.on('error', (error) => {
    console.error('WebSocket client error:', error);
});

socket.on('close', () => {
    console.log('Client connection closed');
});
