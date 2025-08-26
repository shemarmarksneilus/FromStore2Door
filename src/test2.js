const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function tests2() {
  console.log('Complete Tests - Warehouse & Logistics\n');

  try {
    // 1. Create warehouse
    console.log('1. Creating warehouse...');
    const warehouse = await axios.post(`${API_URL}/api/warehouses`, {
      name: 'Kingston Main Warehouse',
      type: 'local',
      address: { street: '123 Harbour St', city: 'Kingston', country: 'Jamaica' },
      timezone: 'America/Jamaica'
    });
    console.log('Warehouse:', warehouse.data.name);

    // 2. Create manifest
    console.log('\n2. Creating manifest...');
    const manifest = await axios.post(`${API_URL}/api/manifests`, {
      warehouseId: warehouse.data.id,
      origin: { city: 'Miami', country: 'USA' },
      destination: { city: 'Kingston', country: 'Jamaica' },
      eta: '2025-09-01',
      flightNo: 'AA1234'
    });
    console.log('Manifest:', manifest.data.id);

    // 3. Create pre-alert
    console.log('\n3. Creating pre-alert...');
    const preAlert = await axios.post(`${API_URL}/api/pre-alerts`, {
      customerId: 'test-customer-id',
      trackingNo: 'PRE123',
      senderName: 'Amazon USA',
      senderAddr: { street: '456 Amazon Way', city: 'Seattle', country: 'USA' },
      description: 'Electronics package',
      expectedDate: '2025-08-30'
    });
    console.log('Pre-alert:', preAlert.data.tracking_no);

    // 4. Receive package
    console.log('\n4. Receiving package...');
    const package = await axios.post(`${API_URL}/api/packages/receive`, {
      trackingNo: 'PKG123456',
      warehouseId: warehouse.data.id,
      customerId: 'test-customer-id',
      weight: 2.5,
      dimensions: { length: 30, width: 20, height: 15 },
      declaredValue: 150.00,
      contents: 'Wireless Headphones'
    });
    console.log('Package received:', package.data.tracking_no);

    // 5. List all entities
    console.log('\n5. Listing all entities...');
    const [warehouses, packages, manifests, preAlerts] = await Promise.all([
      axios.get(`${API_URL}/api/warehouses`),
      axios.get(`${API_URL}/api/packages`),
      axios.get(`${API_URL}/api/manifests`),
      axios.get(`${API_URL}/api/pre-alerts`)
    ]);

    console.log(`Summary:`);
    console.log(`   Warehouses: ${warehouses.data.length}`);
    console.log(`   Packages: ${packages.data.length}`);
    console.log(`   Manifests: ${manifests.data.length}`);
    console.log(`   Pre-alerts: ${preAlerts.data.length}`);

    console.log('\n All tests have been passed');

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

tests2();