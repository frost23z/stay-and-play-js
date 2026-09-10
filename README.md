# Stay and Play — Assignment | JS, TS & Node.js

A property-listing page (Eagle Creek Golf Club) served by an Express.js
HTTP server, with a photo gallery, a date-range/guests booking picker,
and a Nearby Properties section backed by the Google Maps JavaScript
API.

## Requirements

- Node.js 20.10+ (the server uses `import ... with { type: 'json' }`
  JSON module attributes)
- A [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key)
  with the **Maps JavaScript API** enabled and billing set up

## Setup

1. Clone the repository:

    ```bash
    git clone https://github.com/frost23z/stay-and-play-js.git
    cd stay-and-play-js
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Create your local env file:

    ```bash
    cp .env.example .env
    ```

4. Open `.env` and set `GOOGLE_MAPS_API_KEY` to your key. `.env` is
   gitignored — never commit real keys.

## Running

```bash
npm run dev     # starts the server with --watch (auto-restarts on file changes)
npm start       # starts the server without --watch
```

The site is served at [http://localhost:3000](http://localhost:3000)
(or `$PORT` if set).

## Project structure

```
public/
├── assets/
│   └── images/
│       └── gallery/        # 10 property images
└── ...                     # HTML, CSS, client-side JS

src/
├── app.js                  # Express app and route registration
├── routes/
│   ├── get-property.js     # Property API
│   ├── images.js           # Gallery images API
│   ├── env.js              # Environment configuration
│   └── health.js           # Health check
└── data/
    ├── most_popular.json
    ├── highest_price.json
    └── lowest_price.json

```

## API

- `GET /get-property?most-popular=true|highest-price=true|lowest-price=true&limit=<n>`
  — returns the matching dataset, optionally trimmed to `limit` items.
- `GET /images` — returns an array of 10 gallery image paths.
- `GET /health` — basic liveness check.

## Scripts

- `npm run format` / `npm run format:check` — Prettier
