const express = require('express');
const axios = require('axios');

const app = express();

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

app.post(['/v1/chat/completions', '/chat/completions', '/v1', '/'], async (req, res) => {
  try {
    if (!NVIDIA_API_KEY) {
      console.error('ERROR: NVIDIA_API_KEY no configurada');
      return res.status(500).json({
        error: {
          message: 'NVIDIA_API_KEY no configurada',
          type: 'configuration_error'
        }
      });
    }

    const { 
      messages, 
      model = 'deepseek-ai/deepseek-v3', 
      temperature = 0.7, 
      max_tokens = 2048,
      stream = false 
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: {
          message: 'Se requiere un array de messages',
          type: 'invalid_request_error'
        }
      });
    }

    console.log('REQUEST - Model:', model, 'Messages:', messages.length, 'Stream:', stream);

    // Si pide streaming, primero obtenemos la respuesta completa de NVIDIA
    const nvidiaResponse = await axios.post(
      `${NVIDIA_BASE_URL}/chat/completions`,
      {
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: max_tokens,
        stream: false // NVIDIA siempre sin stream
      },
      {
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    const content = nvidiaResponse.data.choices?.[0]?.message?.content || '';
    console.log('NVIDIA RESPONSE - Length:', content.length);

    // Si JanitorAI pidió streaming, simulamos el stream
    if (stream) {
      console.log('ENVIANDO RESPUESTA EN MODO STREAMING');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const chatId = `chatcmpl-${Date.now()}`;
      const timestamp = Math.floor(Date.now() / 1000);

      // Dividir el contenido en chunks
      const chunkSize = 50;
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.substring(i, i + chunkSize);
        const streamData = {
          id: chatId,
          object: 'chat.completion.chunk',
          created: timestamp,
          model: model,
          choices: [{
            index: 0,
            delta: {
              content: chunk
            },
            finish_reason: null
          }]
        };
        
        res.write(`data: ${JSON.stringify(streamData)}\n\n`);
      }

      // Enviar mensaje final
      const finalData = {
        id: chatId,
        object: 'chat.completion.chunk',
        created: timestamp,
        model: model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      };
      
      res.write(`data: ${JSON.stringify(finalData)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      
      console.log('STREAMING COMPLETADO');
      
    } else {
      // Respuesta normal sin streaming
      console.log('ENVIANDO RESPUESTA NORMAL (SIN STREAMING)');
      
      const openaiResponse = {
        id: nvidiaResponse.data.id || `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: content
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: nvidiaResponse.data.usage?.prompt_tokens || 100,
          completion_tokens: nvidiaResponse.data.usage?.completion_tokens || content.length,
          total_tokens: nvidiaResponse.data.usage?.total_tokens || (100 + content.length)
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(openaiResponse);
    }
    
  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.response) {
      console.error('ERROR RESPONSE:', error.response.status, error.response.data);
    }
    
    if (!res.headersSent) {
      res.status(error.response?.status || 500).json({
        error: {
          message: error.response?.data?.error?.message || error.message,
          type: 'api_error'
        }
      });
    }
  }
});

app.get('/v1/models', async (req, res) => {
  res.json({
    object: 'list',
    data: [
      { 
        id: 'deepseek-ai/deepseek-v3', 
        object: 'model', 
        created: 1234567890,
        owned_by: 'deepseek-ai' 
      }
    ]
  });
});

app.get('/', (req, res) => {
  res.send('NVIDIA NIM Proxy is running! ✅');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});

module.exports = app;
```

**Pasos:**

1. Ve a GitHub → tu repositorio → `index.js`
2. Click en editar (lápiz)
3. **Borra todo el contenido**
4. **Copia y pega este código completo**
5. Click en "Commit changes"
6. Espera el redeploy en Vercel (1-2 minutos)

**No necesitas cambiar nada en JanitorAI** - automáticamente usará DeepSeek V3.

Si quieres verificar que está usando V3, mira los logs de Vercel después de enviar un mensaje, debería decir:
```
REQUEST - Model: deepseek-ai/deepseek-v3 Messages: X Stream: true
