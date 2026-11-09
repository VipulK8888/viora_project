import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Viora Bills API Server`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  console.log(`🌐 Listening on: http://localhost:${env.PORT}`);
  console.log(`🩺 Health check: http://localhost:${env.PORT}/api/health`);
  console.log(`📄 Invoices API: http://localhost:${env.PORT}/api/v1/invoices`);
  console.log(`===============================================`);
});

// Graceful shutdown handling
const handleShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Gracefully closing HTTP server...`);
  server.close(() => {
    console.log('✅ HTTP server closed. Process exiting.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
