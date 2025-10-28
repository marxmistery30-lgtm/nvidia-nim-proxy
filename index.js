const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, model = 'nvidia/deepseek-r1', temperature = 0.7, max_tokens = 2048 } = req.body;

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
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: {
        message: error.response?.data?.error?.message || error.message,
        type: 'nvidia_api_error'
      }
    });
  }
});

app.get('/v1/models', async (req, res) => {
  res.json({
    data: [
      { id: 'nvidia/deepseek-r1', object: 'model', owned_by: 'nvidia' }
    ]
  });
});

app.get('/', (req, res) => {
  res.send('NVIDIA NIM Proxy is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});

module.exports = app;
