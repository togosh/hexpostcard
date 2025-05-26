# 🏆 HEXpostcards Donation Leaderboard

A real-time donation tracking system that monitors ETH and stablecoin donations to HEXpostcards addresses and displays them in a beautiful leaderboard format.

## ✨ Features

- **Real-time tracking** of ETH donations with historical USD pricing
- **Stablecoin support** for USDC, USDT, and DAI tokens
- **Beautiful responsive UI** with top donor highlighting
- **Live updates** via Socket.IO every 15 minutes  
- **REST API** for integration with other services
- **Historical price caching** for accurate USD calculations
- **Mobile-friendly** design with Tailwind CSS

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Key
```bash
node setup-api-key.js
```
Follow the prompts to add your free Etherscan API key.

### 3. Start Server
```bash
node index.js
```

### 4. View Leaderboard
Open http://localhost:3000/leaderboard

## 🎯 Test Data

To see the leaderboard in action with sample data:
```bash
node test-leaderboard.js
```

This adds realistic test donations totaling $30,000 across 6 donors using various cryptocurrencies.

## 📊 Tracked Donations

### ETH Donations
- **Address**: `0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668`
- **Pricing**: Historical ETH/USD rates from cached database
- **Updates**: Real-time via Etherscan API

### Stablecoin Donations
- **USDC**: `0xA0b86a33E6441386C0890659E98E6156e0c7fB14` (6 decimals)
- **USDT**: `0xdAC17F958D2ee523a2206206994597C13D831ec7` (6 decimals)  
- **DAI**: `0x6B175474E89094C44Da98b954EedeAC495271d0F` (18 decimals)
- **Pricing**: Fixed at $1.00 USD

## 🔧 Configuration

Key settings in `config.json`:

```json
{
  "etherscan": {
    "apikey": "YOUR_API_KEY_HERE"
  },
  "donationAddresses": {
    "eth_main": "0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668",
    "eth_historical": "0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668"
  }
}
```

## 📡 API Endpoints

### GET `/api/leaderboard`
Returns current leaderboard data in JSON format.

**Response Example:**
```json
[
  {
    "rank": 1,
    "from": "0x742d35Cc6634C0532925a3b8D5c0e7F29dae2e98",
    "totalUsdValue": 14000.00,
    "donationCount": 2,
    "currencies": ["ETH", "USDT"],
    "firstDonation": 1642723200,
    "lastDonation": 1642809600
  }
]
```

### GET `/leaderboard`
Displays the interactive leaderboard webpage.

## 🕐 Scheduled Tasks

- **Every 15 minutes**: Refresh leaderboard data and emit to connected clients
- **Daily at midnight UTC**: Fetch current ETH price and store in cache
- **Daily at midnight UTC**: Process any new donations since last update

## 💾 Database Collections

### `donations`
Individual donation records with USD values calculated at time of donation.

### `ethprices` 
Historical ETH price cache for accurate USD conversions.

### `plsprices`
Reserved for future PLS token price support.

## 🔄 Real-time Updates

The leaderboard automatically updates via Socket.IO when new donations are processed. Clients receive live data without page refresh.

**Socket Events:**
- `leaderboardData` - Emitted when leaderboard updates
- `connect` - Client connection established
- `disconnect` - Client disconnected

## 🎨 UI Features

- **Top 3 highlighting**: Gold, silver, and bronze styling for top donors
- **Statistics summary**: Total donated, total donors, transaction count
- **Responsive design**: Works on desktop, tablet, and mobile
- **Loading states**: Smooth loading animations and error handling
- **Address formatting**: Truncated addresses with full address on hover

## 🔧 Development

### File Structure
```
leaderboard.js          # Core service logic
index.js                # Main server with integration
public/leaderboard.html # Frontend interface
test-leaderboard.js     # Test data generator
setup-api-key.js        # API key configuration tool
```

### Key Functions
- `getLeaderboardData()` - Main aggregation logic
- `processDonations()` - Fetch and process new donations
- `refreshEthPricesCache()` - Load historical price data
- `grabAndEmitLeaderboardData()` - Update and broadcast data

## 🐛 Troubleshooting

### No donations showing
1. Check Etherscan API key is valid
2. Verify donation addresses are correct
3. Check server logs for API errors

### Price data missing
- ETH prices load from existing `ethprices` collection
- Ensure MongoDB connection is working
- Check for historical price data in database

### Socket.IO not connecting
- Verify server is running on correct port
- Check for CORS issues in browser console
- Ensure Socket.IO client library loads properly

## 📈 Future Enhancements

- **PLS token support** via PulseX subgraph integration
- **Historical price backfill** script for complete price history  
- **Manual donation entries** for known contributors
- **Export functionality** for CSV/Excel downloads
- **Email notifications** for large donations
- **Multi-chain support** for other EVM networks

## 📝 Logs

The system provides detailed logging for monitoring:

```
[LeaderboardService] --- Processing donations...
[LeaderboardService] --- Generated leaderboard with 6 entries. Top donor: 14000 USD
[MainServer] --- Leaderboard data updated and emitted via Socket.io. 6 entries.
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with sample data
5. Submit a pull request

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs for errors  
3. Verify API key and configuration
4. Test with sample data first

**Happy tracking! 🎉**
