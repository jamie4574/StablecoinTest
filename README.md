Stablecoin Use Case Map — Data Pipeline
Auto-fetches live stablecoin data from CoinGecko daily via GitHub Actions and publishes it to GitHub Pages as data/data.json.

Repo Structure
/
├── .github/
│   └── workflows/
│       └── fetch-data.yml      ← GitHub Actions cron job
├── scripts/
│   └── fetch-data.js           ← The fetch script
├── data/
│   ├── data.json               ← OUTPUT: live data (auto-committed daily)
│   └── meta-cache.json         ← Metadata cache (committed once, rarely changes)
├── package.json
└── index.html                  ← Your Stablecoin Use Case Map page

Setup (5 steps)
1. Create the GitHub repo
Create a new repo (e.g. stablecoin-map) and push these files to it.
2. Add your CoinGecko API key as a secret

Go to your repo → Settings → Secrets and variables → Actions
Click New repository secret
Name: COINGECKO_API_KEY
Value: your CoinGecko Demo API key (get one free at https://www.coingecko.com/en/api)


Note: The script works without an API key (public rate limits apply) but adding the key gives you 30 calls/min on the Demo plan.

3. Enable GitHub Pages

Go to Settings → Pages
Source: Deploy from a branch
Branch: main / folder: / (root)
Save

Your data/data.json will be live at:
https://<your-username>.github.io/<repo-name>/data/data.json
4. Run the workflow manually (first time)

Go to Actions → Fetch CoinGecko Data
Click Run workflow

This fetches all data including the ~50 metadata calls. After this first run, meta-cache.json is committed and future daily runs only make 4 API calls.
5. Point your HTML to the live data.json URL
In your stablecoin-usecase-map.html, fetch data from:
jsconst DATA_URL = 'https://<your-username>.github.io/<repo-name>/data/data.json';

How It Works
WhatHowScheduleDaily at 02:00 UTC (configurable in fetch-data.yml)Market data1 API call — all coins' price, market cap, volume, imageMetadata~50 calls on first run, then cached forever in meta-cache.jsonGlobal stats3 API calls — total market cap, stablecoin mcap, DeFi mcapDaily total~4 calls after day 1 (well within 10,000/month Demo limit)Outputdata/data.json auto-committed and served via GitHub Pages

Adding / Removing Coins
Edit the COINS object at the top of scripts/fetch-data.js:
jsconst COINS = {
  'tether':    { useCase: 'payments' },
  'usd-coin':  { useCase: 'payments' },
  // add more...
};
The key must be the exact CoinGecko coin ID (find it in the URL: coingecko.com/en/coins/tether).
After adding a new coin, delete its entry from data/meta-cache.json (or delete the whole file) so the next run fetches its metadata fresh.

data.json Shape
json{
  "updated_at": "2026-02-25T02:00:00Z",
  "global": {
    "total_market_cap_usd": 3100000000000,
    "stablecoin_market_cap": 232000000000,
    "defi_market_cap": 98000000000
  },
  "coins": {
    "tether": {
      "name": "Tether",
      "symbol": "USDT",
      "image": "https://assets.coingecko.com/...",
      "market_cap": 143000000000,
      "market_cap_rank": 3,
      "current_price": 1.00,
      "price_change_percentage_24h": 0.02,
      "total_volume": 98000000000,
      "circulating_supply": 143000000000,
      "genesis_date": "2014-11-20",
      "age_years": 11.3,
      "platforms": ["ethereum", "tron", "solana"],
      "use_case": "payments"
    }
  }
}

Troubleshooting
Workflow fails with 429 (rate limit)
→ Add your COINGECKO_API_KEY secret (see step 2). The sleep(2200ms) between metadata calls handles rate limiting automatically.
data.json not updating
→ Check Actions tab for errors. The workflow needs contents: write permission (already set in fetch-data.yml).
GitHub Pages returns 404
→ Wait ~2 minutes after enabling Pages for the first deployment to complete.
