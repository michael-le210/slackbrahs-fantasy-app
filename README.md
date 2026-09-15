# Slackbrahs Fantasy Tool

A small Yahoo Fantasy Basketball dashboard for comparing weekly category performance across your league.

## Setup

1. Copy `.env.example` to `.env`.
2. Add your Yahoo app credentials and local settings:

   ```text
   YAHOO_CLIENT_ID=your-client-id
   YAHOO_CLIENT_SECRET=your-client-secret
   YAHOO_REDIRECT_URI=https://localhost:3000/auth/callback
   PORT=3000
   ```

   Your Yahoo developer app needs the **Fantasy Sports Read** permission and the redirect URI above.

3. Start the app:

   ```bash
   ./run-app.sh
   ```

4. Open <https://localhost:3000> and sign in with Yahoo.

For Namecheap cPanel Node.js hosting, use `server.cjs` as the application startup file.

## Tests

```bash
npm test
```
