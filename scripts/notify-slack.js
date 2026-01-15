// scripts/notify-slack.js
// Send a deployment notification to Slack via webhook

const https = require('https');

const webhookUrl = process.env.SLACK_WEBHOOK_URL;
const message = process.env.SLACK_MESSAGE || 'Deployment complete!';

if (!webhookUrl) {
  console.error('Missing SLACK_WEBHOOK_URL');
  process.exit(1);
}

const payload = JSON.stringify({ text: message });

const url = new URL(webhookUrl);
const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('Slack notification sent.');
    process.exit(0);
  } else {
    console.error('Slack notification failed:', res.statusCode);
    process.exit(1);
  }
});

req.on('error', (e) => {
  console.error('Slack notification error:', e.message);
  process.exit(1);
});

req.write(payload);
req.end();
