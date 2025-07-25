const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testAPI() {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream('sample_data.json'));
    
    const response = await axios.post('http://localhost:5000/api/upload', form, {
      headers: {
        ...form.getHeaders(),
      },
    });
    
    console.log('API Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAPI();
