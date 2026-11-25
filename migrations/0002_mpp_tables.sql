-- PostgreSQL schema for persistent HTTP 402 MPP challenges, atomic anti-replay, and shared rate limits

CREATE TABLE IF NOT EXISTS mpp_challenges (
  challenge_id TEXT PRIMARY KEY,
  memo TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  mandate_id TEXT NOT NULL,
  mandate_book TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount TEXT NOT NULL,
  expected_spender TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mpp_challenges_expires_at
  ON mpp_challenges (expires_at);

CREATE TABLE IF NOT EXISTS mpp_redeemed_transactions (
  tx_hash TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL UNIQUE,
  mandate_id TEXT NOT NULL,
  block_number TEXT NOT NULL,
  spender TEXT NOT NULL,
  amount TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mpp_payment_receipts (
  id BIGSERIAL PRIMARY KEY,
  challenge_id TEXT NOT NULL UNIQUE,
  tx_hash TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  mandate_id TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount TEXT NOT NULL,
  block_number TEXT NOT NULL,
  explorer_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mpp_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start BIGINT NOT NULL,
  hit_count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mpp_rate_limits_window_start
  ON mpp_rate_limits (window_start);
