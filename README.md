# Yahoo Fantasy Basketball Weekly Categories

A small local web app for comparing weekly Yahoo Fantasy Basketball category totals.

## Setup

1. Node.js is installed locally for this project at `.tools/node`.
2. Create a Yahoo developer app at `https://developer.yahoo.com/apps/`.
3. Set the redirect URI in Yahoo to:

   ```text
   https://localhost:3000/auth/callback
   ```

4. Copy `.env.example` to `.env` and fill in:

   ```text
   YAHOO_CLIENT_ID=...
   YAHOO_CLIENT_SECRET=...
   YAHOO_REDIRECT_URI=https://localhost:3000/auth/callback
   SESSION_SECRET=any-long-random-string
   PORT=3000
   ```

5. Start the app:

   ```bash
   ./run-app.sh
   ```

6. Open `https://localhost:3000`, sign in with Yahoo, select a league, choose a week, and load the category totals.

## Project structure

The server uses an MVC-style, service-oriented layout while keeping the browser assets dependency-free:

```text
.
├── public/                     # Browser entry point, UI modules, and CSS
│   ├── client.js               # Browser state, events, and data loading
│   └── client/                 # API, DOM helpers, and view renderers
├── src/
│   ├── config/                 # Environment and application configuration
│   ├── controllers/            # HTTP request/response handlers
│   ├── middleware/             # Session lifecycle
│   ├── models/                 # Yahoo response normalization and domain models
│   ├── routes/                 # URL-to-controller routing
│   ├── services/               # Yahoo API/OAuth and league use cases
│   ├── utils/                  # HTTP and async helpers
│   ├── views/                  # HTML views
│   ├── app.js                  # Dependency wiring and request pipeline
│   └── server.js               # HTTP/HTTPS server startup
└── test/models/                # Model fixtures and unit tests
```

Yahoo Fantasy access is currently read-only, so the application exposes the read portion of a CRUD design. New create,
update, or delete features can be added as route/controller/service methods without putting API logic in the views.

## Notes

- The app keeps Yahoo OAuth tokens only in memory, so signing out or restarting the server clears the local session.
- League and matchup data comes from Yahoo Fantasy Sports API JSON responses.
- League loading first retrieves the signed-in user's historical NBA game keys, then retrieves leagues for each season
  and displays head-to-head leagues newest-first. This works during the NBA fantasy offseason.
- The server fetches league `settings` once per session to map scoreboard stat IDs to the league's category names.
- Weekly views compare the signed-in user's team against every team in the selected league, even when those teams are not
  that week's head-to-head opponent. The comparison includes category ranks, category-by-category wins/losses, and the
  resulting category score.
- Yahoo API calls have bounded timeouts and retries so an upstream stalled response cannot leave the interface loading
  forever. These can be tuned with `YAHOO_REQUEST_TIMEOUT_MS` and `YAHOO_REQUEST_RETRIES`.
- Yahoo's fragmented JSON resources are normalized into league, scoreboard, matchup, team, and stat models using the
  same general approach documented by [`yfpy`](https://github.com/uberfastman/yfpy), without adding a Python runtime.
- This first version focuses on head-to-head category scoreboard totals for NBA fantasy leagues.

## Tests

Run the response-normalization and model tests with:

```bash
export PATH="$PWD/.tools/node/bin:$PATH"
npm test
```
