# HEXpostcards Donation Leaderboard Setup Guide

## Overview
The donation leaderboard tracks ETH and stablecoin (USDC, USDT, DAI) donations to the HEXpostcards project and displays them in a ranked leaderboard format.

## Current Status ✅
- ✅ Leaderboard service integrated into main server
- ✅ MongoDB connection and schemas configured
- ✅ Socket.IO real-time updates working
- ✅ Beautiful leaderboard HTML page created
- ✅ API endpoint `/api/leaderboard` functional
- ✅ ETH price caching system (3453 historical prices loaded)
- ✅ Stablecoin support (USDC, USDT, DAI)

## Required: Etherscan API Key

To fetch actual donation transactions, you need a free Etherscan API key:

1. Go to https://etherscan.io/apis
2. Create a free account
3. Generate an API key
4. Update `config.json`:

```json
{
  "etherscan": {
    "apikey": "YOUR_ACTUAL_API_KEY_HERE"
  }
}
```

## Features Implemented

### 1. ETH Donations
- Tracks native ETH donations to configured addresses
- Calculates USD value using historical ETH prices
- Caches 3453+ historical ETH prices from existing database

### 2. Stablecoin Donations
- **USDC** (0xA0b86a33E6441386C0890659E98E6156e0c7fB14) - 6 decimals
- **USDT** (0xdAC17F958D2ee523a2206206994597C13D831ec7) - 6 decimals  
- **DAI** (0x6B175474E89094C44Da98b954EedeAC495271d0F) - 18 decimals
- All valued at $1.00 USD (stable)

### 3. Real-time Updates
- Leaderboard updates every 15 minutes
- Socket.IO pushes updates to connected browsers
- API fallback if Socket.IO fails

### 4. Beautiful UI
- Responsive design with Tailwind CSS
- Top 3 donors get special highlighting (gold, silver, bronze)
- Statistics summary (total donated, total donors, total transactions)
- Mobile-friendly address display
- Loading states and error handling

## Donation Addresses Monitored

Currently configured for:
- **Main Address**: `0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668`
- **Historical Address**: `0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668`

## URLs

- **Leaderboard Page**: `http://localhost:3000/leaderboard`
- **API Endpoint**: `http://localhost:3000/api/leaderboard`

## Next Steps

1. **Get Etherscan API Key** (required for live data)
2. **Optional**: Run historical price backfill script for more price data
3. **Optional**: Add manual donation entries for known contributors
4. **Optional**: Implement PLS donations (requires PulseX subgraph)

## Database Collections

- **`donations`** - Individual donation records
- **`ethprices`** - Historical ETH price cache
- **`plsprices`** - Historical PLS price cache (future)

## Scheduled Tasks

- **Every 15 minutes**: Update leaderboard data
- **Daily at midnight UTC**: Fetch current ETH price
- **Daily at midnight UTC**: Process new donations

## Logs

The server provides detailed logging:
- Service initialization
- Price fetching and caching
- Donation processing
- Leaderboard generation
- Socket.IO connections

## Testing

With valid API key, you can test by:
1. Making a small ETH or stablecoin donation to the configured address
2. Waiting up to 15 minutes for next leaderboard update
3. Checking the leaderboard page for the new entry

## Error Handling

- Graceful fallbacks for API failures
- Empty state handling when no donations exist
- Retry logic for network issues
- Detailed error logging for debugging
