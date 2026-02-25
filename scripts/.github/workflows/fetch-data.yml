name: Fetch CoinGecko Data

on:
  schedule:
    # Runs every day at 02:00 UTC
    - cron: '0 2 * * *'
  workflow_dispatch: # Allow manual trigger from GitHub UI

permissions:
  contents: write  # Needed to commit data.json back to the repo

jobs:
  fetch:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install node-fetch

      - name: Run fetch script
        env:
          COINGECKO_API_KEY: ${{ secrets.COINGECKO_API_KEY }}
        run: node scripts/fetch-data.js

      - name: Commit & push data.json
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/data.json
          git diff --cached --quiet || git commit -m "chore: update stablecoin data [$(date -u +%Y-%m-%dT%H:%M:%SZ)]"
          git push
