import app from './app.js';
import { testConnection } from './config/database.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  await testConnection();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);