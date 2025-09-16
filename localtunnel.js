const lt = require('localtunnel');

(async () => {
  const tunnel = await lt({ port: 3000, subdomain: 'dealscale' });
  console.log(`Public URL: ${tunnel.url}`);
  console.log(`Webhook URL: ${tunnel.url}/api/notion-webhook`);
  
  tunnel.on('error', (err) => {
    console.error('Localtunnel error:', err);
    process.exit(1);
  });
})();
