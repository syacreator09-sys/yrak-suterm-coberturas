#!/usr/bin/env node
// scripts/gmail-oauth.mjs — corre en la Mac, NO en Workers. Uso:
//   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-oauth.mjs
import http from 'node:http';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) { console.error('Faltan GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET'); process.exit(2); }
const redirectUri = 'http://localhost:8790/oauth/callback';

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
  scope: 'https://www.googleapis.com/auth/gmail.send',
  access_type: 'offline', prompt: 'consent',
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8790');
  if (url.pathname !== '/oauth/callback') { res.writeHead(404).end(); return; }
  const code = url.searchParams.get('code');
  if (!code) { res.writeHead(400).end('Sin code'); return; }
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const json = await tokenResponse.json();
  if (!json.refresh_token) { res.writeHead(500).end('Sin refresh_token — reintenta con prompt=consent'); console.error(json); process.exit(1); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<h1>Listo</h1>Puedes cerrar esta ventana.');
  console.log('GMAIL_REFRESH_TOKEN=' + json.refresh_token);
  server.close(); process.exit(0);
});
server.listen(8790, () => console.log('Abre esta URL en tu navegador y aprueba con la cuenta Gmail:\n\n' + authUrl + '\n'));
