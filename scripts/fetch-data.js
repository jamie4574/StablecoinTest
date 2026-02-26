// fetch-data.js
// Runs daily via GitHub Actions.
// Writes: data/data.json
// Strategy: 1 call for all market data, 50 calls for metadata (cached after first run)

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const META_CACHE_FILE = path.join(DATA_DIR, 'meta-cache.json');

const API_KEY = process.env.COINGECKO_API_KEY;
const BASE = 'https://api.coingecko.com/api/v3';

// ─── COIN LIST ────────────────────────────────────────────────────────────────
// Add or remove coins here. Key = CoinGecko ID, value = display config.
const COINS = {
  // Payments
  'tether':               { useCase: 'payments' },
  'usd-coin':             { useCase: 'payments' },
  'paypal-usd':           { useCase: 'payments' },
  'euro-coin':            { useCase: 'payments' },
  'first-digital-usd':   { useCase: 'payments' },  // FDUSD
  'ripple-usd':           { useCase: 'payments' },  // RLUSD
  'usd1':                 { useCase: 'payments' },  // USD1 (World Liberty Fi)
  'xsgd':                 { useCase: 'payments' },  // XSGD
  'stasis-eurs':          { useCase: 'payments' },  // EURS
  'brz':                  { useCase: 'payments' },  // BRZ

  // DeFi
  'dai':                  { useCase: 'defi' },
  'frax':                 { useCase: 'defi' },
  'liquity-usd':          { useCase: 'defi' },
  'usds':                 { useCase: 'defi' },
  'crvusd':               { useCase: 'defi' },
  'gho':                  { useCase: 'defi' },      // GHO (Aave)
  'magic-internet-money': { useCase: 'defi' },      // MIM
  'dola-usd':             { useCase: 'defi' },      // DOLA
  'alchemix-usd':         { useCase: 'defi' },      // alUSD
  'bold':                 { useCase: 'defi' },      // BOLD (Liquity v2)

  // Treasury
  'mountain-protocol-usdm':    { useCase: 'treasury' },
  'ethena-usde':               { useCase: 'treasury' },
  'ethena-usdtb':              { useCase: 'treasury' }, // USDTB
  'gemini-dollar':             { useCase: 'treasury' }, // GUSD
  'paxos-standard':            { useCase: 'treasury' }, // USDP
  'figure-markets-yield-token': { useCase: 'treasury' }, // YLDS
  'ondo-us-dollar-yield':      { useCase: 'treasury' },
  'usual-usd':                 { useCase: 'treasury' },
  'blackrock-usd-institutional-digital-liquidity-fund': { useCase: 'treasury' },

  // Remittance
  'celo-dollar':          { useCase: 'remittance' },
  'tether-eurt':          { useCase: 'remittance' },
  'glo-dollar':           { useCase: 'remittance' }, // USDGLO

  // Yield
  'savings-dai':          { useCase: 'yield' },
  'staked-frax-ether':    { useCase: 'yield' },
  'aave-usdc':            { useCase: 'yield' },
  'resolv-usr':           { useCase: 'yield' },     // USR
  'usdb':                 { useCase: 'yield' },     // USDB (Blast)
  'usd-plus':             { useCase: 'yield' },     // USD+
  'avusd':                { useCase: 'yield' },     // avUSD (Avalon)
  'defidollar':           { useCase: 'yield' },     // DUSD
  'falcon-finance-usd':   { useCase: 'yield' },     // USDF
};

const COIN_IDS = Object.keys(COINS);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function headers() {
  return API_KEY
    ? { 'x-cg-demo-api-key': API_KEY }
    : {};
}

async function cgFetch(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`CoinGecko error ${res.status} — ${url}`);
  return res.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── STEP 1: MARKET DATA (1 call) ────────────────────────────────────────────

async function fetchMarketData() {
  console.log('📡 Fetching market data for all coins...');
  const ids = COIN_IDS.join(',');
  const url = `${BASE}/coins/markets?vs_currency=usd&ids=${ids}&per_page=100&sparkline=false`;
  const data = await cgFetch(url);
  console.log(`  ✅ Got market data for ${data.length} coins`);
  return data;
}

// ─── STEP 2: METADATA (cached, ~50 calls on first run, 0 after) ──────────────

async function fetchMetadata() {
  let cache = {};

  if (fs.existsSync(META_CACHE_FILE)) {
    cache = JSON.parse(fs.readFileSync(META_CACHE_FILE, 'utf8'));
    console.log(`📦 Loaded metadata cache (${Object.keys(cache).length} coins)`);
  }

  const missing = COIN_IDS.filter(id => !cache[id]);

  if (missing.length === 0) {
    console.log('  ✅ All metadata already cached — skipping API calls');
    return cache;
  }

  console.log(`📡 Fetching metadata for ${missing.length} uncached coins...`);

  for (const id of missing) {
    try {
      const url = `${BASE}/coins/${id}?tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`;
      const coin = await cgFetch(url);

      cache[id] = {
        genesis_date: coin.genesis_date ?? null,
        platforms: coin.platforms ? Object.keys(coin.platforms) : [],
        categories: coin.categories ?? [],
      };

      console.log(`  ✅ ${id}`);
    } catch (err) {
      console.warn(`  ⚠️  Failed to fetch metadata for ${id}: ${err.message}`);
      cache[id] = { genesis_date: null, platforms: [], categories: [] };
    }

    // Respect rate limits — 30 calls/min on Demo plan
    await sleep(2200);
  }

  fs.writeFileSync(META_CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`  💾 Metadata cache saved`);
  return cache;
}

// ─── STEP 3: GLOBAL STATS (3 calls) ──────────────────────────────────────────

async function fetchGlobalStats() {
  console.log('📡 Fetching global stats...');

  const [globalData, defiData, categoriesData] = await Promise.all([
    cgFetch(`${BASE}/global`),
    cgFetch(`${BASE}/global/decentralized_finance_defi`),
    cgFetch(`${BASE}/coins/categories?order=market_cap_desc`),
  ]);

  const stablecoinCategory = categoriesData.find(c =>
    c.id === 'stablecoins' || c.name?.toLowerCase().includes('stablecoin')
  );

  return {
    total_market_cap_usd: globalData.data.total_market_cap?.usd ?? null,
    stablecoin_market_cap: stablecoinCategory?.market_cap ?? null,
    defi_market_cap: parseFloat(defiData.data.defi_market_cap) ?? null,
  };
}

// ─── STEP 4: CALCULATE AGE ────────────────────────────────────────────────────

function calcAge(genesisDate) {
  if (!genesisDate) return null;
  const ms = Date.now() - new Date(genesisDate).getTime();
  return parseFloat((ms / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1));
}

// ─── ASSEMBLE & WRITE ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Starting CoinGecko fetch...\n');
  ensureDir(DATA_DIR);

  const [marketData, metadata, global] = await Promise.all([
    fetchMarketData(),
    fetchMetadata(),      // metadata has its own internal rate-limiting
    fetchGlobalStats(),
  ]);

  // Build coin map
  const coins = {};
  for (const m of marketData) {
    const meta = metadata[m.id] ?? {};
    coins[m.id] = {
      name: m.name,
      symbol: m.symbol?.toUpperCase(),
      image: m.image,
      market_cap: m.market_cap,
      market_cap_rank: m.market_cap_rank,
      current_price: m.current_price,
      price_change_percentage_24h: m.price_change_percentage_24h,
      total_volume: m.total_volume,
      circulating_supply: m.circulating_supply,
      genesis_date: meta.genesis_date ?? null,
      age_years: calcAge(meta.genesis_date),
      platforms: meta.platforms ?? [],
      use_case: COINS[m.id]?.useCase ?? null,
    };
  }

  const output = {
    updated_at: new Date().toISOString(),
    global,
    coins,
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2));

  console.log(`\n✅ data.json written — ${Object.keys(coins).length} coins, updated_at: ${output.updated_at}`);
  console.log(`   Total market calls: ~4 (+ ${Object.keys(metadata).length} cached metadata)\n`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
