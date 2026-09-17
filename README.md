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

## Optional activity logging

To record sign-ins and useful app activity, create a MySQL database and user, then add these variables to the cPanel Node.js application:

```text
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=your_database_name
MYSQL_USER=your_database_user
MYSQL_PASSWORD=your_database_password
MYSQL_CONNECTION_LIMIT=5
```

The app creates an `activity_logs` table automatically when it starts. The table records the event, Yahoo user ID, display name, route, status, optional week, and timestamp. It does not store OAuth tokens, Yahoo email addresses, or secrets. If the database is unavailable, the app continues to work and logs a warning.

To view recent activity in phpMyAdmin:

```sql
SELECT created_at, event_name, display_name, route, status_code, metadata
FROM activity_logs
ORDER BY created_at DESC
LIMIT 100;
```

## Tests

```bash
npm test
```
