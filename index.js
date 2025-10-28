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

// Manejar múltiples rutas posibles
app.post(['/v1/chat/completions', '/chat/completions', '/v1', '/'], async (req, res) => {
  try {
    if (!NVIDIA_API_KEY) {
      return res.status(500).json({
        error: {
          message: 'NVIDIA_API_KEY no configurada en variables de entorno',
          type: 'configuration_error'
        }
      });
    }

    const { messages, model = 'deepseek-ai/deepseek-r1', temperature = 0.6, max_tokens = 2048 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: {
          message: 'Se requiere un array de messages',
          type: 'invalid_request_error'
        }
      });
    }

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
        timeout: 120000 // 2 minutos de timeout
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error completo:', error.response?.data || error.message);
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
    data: [
      { id: 'deepseek-ai/deepseek-r1', object: 'model', owned_by: 'deepseek-ai' }
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
