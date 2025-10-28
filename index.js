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
          message: 'NVIDIA_API_KEY no configurada en variables de entorno',
          type: 'configuration_error'
        }
      });
    }

    const { messages, model = 'deepseek-ai/deepseek-r1', temperature = 0.6, max_tokens = 2048, stream = false } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: {
          message: 'Se requiere un array de messages',
          type: 'invalid_request_error'
        }
      });
    }

    console.log('Enviando petición a NVIDIA con modelo:', model);
    console.log('Número de mensajes:', messages.length);

    const response = await axios.post(
      `${NVIDIA_BASE_URL}/chat/completions`,
      {
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: max_tokens,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    console.log('Respuesta recibida de NVIDIA');
    console.log('Choices:', response.data.choices?.length);
    console.log('Primer mensaje:', response.data.choices?.[0]?.message?.content?.substring(0, 100));
    
    // Formato compatible con JanitorAI/OpenAI
    const formattedResponse = {
      id: response.data.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: response.data.created || Math.floor(Date.now() / 1000),
      model: model,
      choices: (response.data.choices || []).map((choice, index) => ({
        index: choice.index !== undefined ? choice.index : index,
        message: {
          role: choice.message?.role || 'assistant',
          content: choice.message?.content || ''
        },
        finish_reason: choice.finish_reason || 'stop'
      })),
      usage: response.data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    console.log('Respuesta formateada - Content length:', formattedResponse.choices[0]?.message?.content?.length);
    
    res.json(formattedResponse);
    
  } catch (error) {
    console.error('Error completo:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data));
    }
    res.status(error.response?.status || 500).json({
      error: {
        message: error.response?.data?.error?.message || error.message,
        type: 'nvidia_api_error',
        details: error.response?.data
      }
    });
  }
});

app.get('/v1/models', async (req, res) => {
  res.json({
    object: 'list',
    data: [
      { 
        id: 'deepseek-ai/deepseek-r1', 
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
