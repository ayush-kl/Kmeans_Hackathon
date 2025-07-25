const { inferLastLocations } = require('./utils/inferLastLocation');
const fs = require('fs');

async function debug() {
  const data = JSON.parse(fs.readFileSync('sample_data.json', 'utf8'));
  console.log('Sample data:', JSON.stringify(data, null, 2));
  
  // Check is_defaulter values
  console.log('\nChecking is_defaulter values:');
  data.forEach((record, i) => {
    console.log(`Record ${i}: is_defaulter = ${record.is_defaulter} (type: ${typeof record.is_defaulter})`);
  });
  
  const result = await inferLastLocations(data);
  console.log('\nResult:', JSON.stringify(result, null, 2));
}

debug();
