// scripts/health-check.js
// Basic health check script for deployment validation

const http = require('http');
const { execSync } = require('child_process');

const APP_URL = process.env.HEALTHCHECK_URL || 'http://localhost:3000';

function checkHttp() {
  return new Promise((resolve, reject) => {
    http.get(APP_URL, (res) => {
      if (res.statusCode === 200) {
        resolve('HTTP OK');
      } else {
        reject(`HTTP status: ${res.statusCode}`);
      }
    }).on('error', (err) => {
      reject(`HTTP error: ${err.message}`);
    });
  });
}

function checkDb() {
  try {
    execSync('npx prisma db pull', { stdio: 'ignore' });
    return 'DB OK';
  } catch (err) {
    throw new Error('DB error');
  }
}

(async () => {
  try {
    const httpResult = await checkHttp();
    const dbResult = checkDb();
    console.log('Health checks passed:', httpResult, dbResult);
    process.exit(0);
  } catch (err) {
    console.error('Health check failed:', err.message);
    process.exit(1);
  }
})();
