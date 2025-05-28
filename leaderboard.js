const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const schedule = require('node-schedule');

const CONFIG = require('./config.json'); // To access API keys, etc.

// --- START: LEADERBOARD CONFIGURATION CONSTANTS ---
const ETHERSCAN_API_KEY = CONFIG.etherscan.apikey;
const ETHERSCAN_API_BASE = "https://api.etherscan.io/api";

// Donation addresses
const ETH_MAIN_DONATION_ADDRESS = CONFIG.donationAddresses.eth_main;
const ETH_HISTORICAL_DONATION_ADDRESS = CONFIG.donationAddresses.eth_historical;

// Stablecoin contract addresses on Ethereum
const STABLECOIN_CONTRACTS = {
    "USDC": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC contract (Centre/Circle) - REAL CONTRACT
    "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Tether contract
    "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F"   // DAI contract
};
// --- END: LEADERBOARD CONFIGURATION CONSTANTS ---

// --- START: MONGODB SCHEMAS FOR PRICES AND DONATIONS ---
const EthPriceSchema = new Schema({
    timestamp: { type: Number, required: true, unique: true, index: true }, // Unix timestamp in seconds for start of day UTC
    price: { type: Number, required: true }
}, { collection: "ethprices" });
const EthPrice = mongoose.model('EthPrice', EthPriceSchema);

const PlsPriceSchema = new Schema({ // Defining it here, will implement usage in Phase 2
    timestamp: { type: Number, required: true, unique: true, index: true },
    price: { type: Number, required: true }
}, { collection: "plsprices" });
const PlsPrice = mongoose.model('PlsPrice', PlsPriceSchema);

// Schema for storing processed donations
const DonationSchema = new Schema({
    txHash: { type: String, required: true, unique: true, index: true },
    from: { type: String, required: true, index: true },
    to: { type: String, required: true },
    value: { type: String, required: true }, // String to handle big numbers
    currency: { type: String, required: true }, // 'ETH', 'USDC', 'USDT', 'DAI'
    timestamp: { type: Number, required: true },
    blockNumber: { type: Number, required: true },
    usdValue: { type: Number, required: true }, // USD value at time of transaction
    priceAtTime: { type: Number, required: true } // ETH price used for calculation (1.0 for stablecoins)
}, { collection: "donations" });
const Donation = mongoose.model('Donation', DonationSchema);
// --- END: MONGODB SCHEMAS FOR PRICES AND DONATIONS ---

// --- START: PRICE CACHING ---
let ethPricesCache = [];
let plsPricesCache = []; // For PLS prices later
// --- END: PRICE CACHING ---

// --- START: TRANSACTION FETCHING FUNCTIONS ---
async function getEthTransactions(address, startBlock = 0) {
    logService(`Fetching ETH transactions for address ${address}...`);
    try {
        const url = `${ETHERSCAN_API_BASE}?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === "1" && data.result) {
            logService(`Found ${data.result.length} regular ETH transactions for ${address}`);
            return data.result.filter(tx => 
                tx.to && tx.to.toLowerCase() === address.toLowerCase() && 
                tx.value !== "0"
            );
        } else {
            logService(`Error fetching ETH transactions: ${data.message || 'Unknown error'}`);
            return [];
        }
    } catch (error) {
        logService(`Exception in getEthTransactions: ${error.message}`);
        return [];
    }
}

async function getInternalEthTransactions(address, startBlock = 0) {
    logService(`Fetching internal ETH transactions for address ${address}...`);
    try {
        const url = `${ETHERSCAN_API_BASE}?module=account&action=txlistinternal&address=${address}&startblock=${startBlock}&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === "1" && data.result) {
            logService(`Found ${data.result.length} internal ETH transactions for ${address}`);
            return data.result.filter(tx => 
                tx.to && tx.to.toLowerCase() === address.toLowerCase() && 
                tx.value !== "0" && tx.isError === "0"
            );
        } else {
            logService(`Error fetching internal ETH transactions: ${data.message || 'Unknown error'}`);
            return [];
        }
    } catch (error) {
        logService(`Exception in getInternalEthTransactions: ${error.message}`);
        return [];
    }
}

async function getTokenTransfers(tokenAddress, toAddress, startBlock = 0) {
    logService(`Fetching token transfers for ${tokenAddress} to ${toAddress}...`);
    try {
        const url = `${ETHERSCAN_API_BASE}?module=account&action=tokentx&contractaddress=${tokenAddress}&address=${toAddress}&startblock=${startBlock}&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === "1" && data.result) {
            logService(`Found ${data.result.length} token transfers for ${tokenAddress}`);
            return data.result.filter(tx => 
                tx.to && tx.to.toLowerCase() === toAddress.toLowerCase() && 
                tx.value !== "0"
            );
        } else {
            logService(`Error fetching token transfers: ${data.message || 'Unknown error'}`);
            return [];
        }
    } catch (error) {
        logService(`Exception in getTokenTransfers: ${error.message}`);
        return [];
    }
}

function getHistoricalPrice(timestamp, currency = 'ETH') {
    if (currency !== 'ETH') {
        return 1.0; // Stablecoins are always $1
    }
    
    const dayStart = new Date(timestamp * 1000);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayTimestamp = Math.floor(dayStart.getTime() / 1000);
    
    const priceEntry = ethPricesCache.find(entry => entry.timestamp === dayTimestamp);
    if (priceEntry) {
        return priceEntry.price;
    }
    
    // Fallback: find closest price
    const sortedPrices = ethPricesCache.sort((a, b) => Math.abs(a.timestamp - dayTimestamp) - Math.abs(b.timestamp - dayTimestamp));
    return sortedPrices.length > 0 ? sortedPrices[0].price : 0;
}
// --- END: TRANSACTION FETCHING FUNCTIONS ---

// Helper for logging specific to this service
const logService = (message) => {
    console.log(`${new Date().toISOString()} [LeaderboardService] --- ${message}`);
}

// --- START: ETH PRICE FETCHING AND STORAGE LOGIC ---
async function getAndSet_currentEthPrice() {
    logService("Attempting to get and set current ETH price...");
    try {
        const resp = await (await fetch(`${ETHERSCAN_API_BASE}?module=stats&action=ethprice&apikey=${ETHERSCAN_API_KEY}`)).json();
        if (resp.status === "1" && resp.result && resp.result.ethusd) {
            const price = parseFloat(resp.result.ethusd);
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const timestamp = Math.floor(today.getTime() / 1000);

            const existingPrice = await EthPrice.findOne({ timestamp: timestamp });
            if (!existingPrice) {
                await EthPrice.create({ timestamp: timestamp, price: price });
                logService(`Stored new ETH price for ${today.toDateString()}: $${price}`);
                await refreshEthPricesCache(); // Update cache after new price
            } else {
                logService(`ETH price for ${today.toDateString()} already exists: $${existingPrice.price}`);
            }
        } else {
            logService(`Error fetching ETH price from Etherscan: ${JSON.stringify(resp.result || resp.message || resp)}`);
        }
    } catch (error) {
        logService(`Exception in getAndSet_currentEthPrice: ${error.message}`);
        console.error(error); // Log the full error for debugging
    }
}

async function refreshEthPricesCache() {
    try {
        ethPricesCache = await EthPrice.find().sort({ timestamp: 1 }).lean();
        logService(`ETH prices cache refreshed. ${ethPricesCache.length} entries.`);
    } catch (error) {
        logService(`Error refreshing ETH prices cache: ${error}`);
    }
}
// --- END: ETH PRICE FETCHING AND STORAGE LOGIC ---

// --- START: DONATION PROCESSING ---
async function processDonations() {
    logService("Processing donations...");
    
    try {
        // Check if we have a valid API key
        if (!CONFIG.etherscan || !CONFIG.etherscan.apikey || CONFIG.etherscan.apikey === 'YOUR_ETHERSCAN_API_KEY_HERE') {
            logService("No valid Etherscan API key configured. Skipping new donation processing.");
            return;
        }
        
        // First, clean up any existing invalid donations
        await cleanupInvalidDonations();
        
        // Get the last processed block number
        const lastDonation = await Donation.findOne().sort({ blockNumber: -1 });
        const startBlock = lastDonation ? lastDonation.blockNumber + 1 : 0;
        
        // Process ETH donations
        await processEthDonations(startBlock);
        
        // Process stablecoin donations
        for (const [symbol, contractAddress] of Object.entries(STABLECOIN_CONTRACTS)) {
            await processTokenDonations(contractAddress, symbol, startBlock);
        }
        
        logService("Donation processing completed.");
    } catch (error) {
        logService(`Error in processDonations: ${error.message}`);
        // Don't throw the error, just log it and continue
    }
}

async function processEthDonations(startBlock) {
    const addresses = [ETH_MAIN_DONATION_ADDRESS, ETH_HISTORICAL_DONATION_ADDRESS];
    const donationAddressesLower = addresses.map(addr => addr.toLowerCase());
    
    for (const address of addresses) {
        // Get both regular and internal transactions
        const regularTransactions = await getEthTransactions(address, startBlock);
        const internalTransactions = await getInternalEthTransactions(address, startBlock);
        
        // Combine both types of transactions
        const allTransactions = [...regularTransactions, ...internalTransactions];
        logService(`Total ETH transactions to process for ${address}: ${allTransactions.length} (${regularTransactions.length} regular + ${internalTransactions.length} internal)`);
        
        for (const tx of allTransactions) {
            try {
                const existing = await Donation.findOne({ txHash: tx.hash });
                if (existing) continue;
                
                // Filter out internal transactions and self-transactions
                const fromLower = tx.from.toLowerCase();
                const toLower = tx.to.toLowerCase();
                
                // Skip if the transaction is FROM a donation address (internal transfer or withdrawal)
                if (donationAddressesLower.includes(fromLower)) {
                    logService(`Skipping internal/outgoing ETH transaction: ${tx.hash} from ${tx.from} to ${tx.to}`);
                    continue;
                }
                
                // Skip if the transaction is TO an address that's not a donation address
                if (!donationAddressesLower.includes(toLower)) {
                    logService(`Skipping ETH transaction not to donation address: ${tx.hash} to ${tx.to}`);
                    continue;
                }
                
                const ethAmount = parseFloat(tx.value) / Math.pow(10, 18); // Convert from wei
                const priceAtTime = getHistoricalPrice(parseInt(tx.timeStamp));
                const usdValue = ethAmount * priceAtTime;
                
                await Donation.create({
                    txHash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    value: tx.value,
                    currency: 'ETH',
                    timestamp: parseInt(tx.timeStamp),
                    blockNumber: parseInt(tx.blockNumber),
                    usdValue: usdValue,
                    priceAtTime: priceAtTime
                });
                
                logService(`Processed ETH donation: ${ethAmount} ETH ($${usdValue.toFixed(2)}) from ${tx.from}`);
            } catch (error) {
                logService(`Error processing ETH transaction ${tx.hash}: ${error.message}`);
            }
        }
    }
}

async function processTokenDonations(tokenAddress, symbol, startBlock) {
    const addresses = [ETH_MAIN_DONATION_ADDRESS, ETH_HISTORICAL_DONATION_ADDRESS];
    const donationAddressesLower = addresses.map(addr => addr.toLowerCase());
    
    for (const address of addresses) {
        const transfers = await getTokenTransfers(tokenAddress, address, startBlock);
        
        for (const transfer of transfers) {
            try {
                const existing = await Donation.findOne({ txHash: transfer.hash });
                if (existing) continue;
                
                // Filter out internal transactions and self-transactions
                const fromLower = transfer.from.toLowerCase();
                const toLower = transfer.to.toLowerCase();
                
                // Skip if the transaction is FROM a donation address (internal transfer or withdrawal)
                if (donationAddressesLower.includes(fromLower)) {
                    logService(`Skipping internal/outgoing ${symbol} transaction: ${transfer.hash} from ${transfer.from} to ${transfer.to}`);
                    continue;
                }
                
                // Skip if the transaction is TO an address that's not a donation address
                if (!donationAddressesLower.includes(toLower)) {
                    logService(`Skipping ${symbol} transaction not to donation address: ${transfer.hash} to ${transfer.to}`);
                    continue;
                }
                
                let tokenAmount;
                if (symbol === 'USDC' || symbol === 'USDT') {
                    tokenAmount = parseFloat(transfer.value) / Math.pow(10, 6); // 6 decimals
                } else if (symbol === 'DAI') {
                    tokenAmount = parseFloat(transfer.value) / Math.pow(10, 18); // 18 decimals
                }
                
                const usdValue = tokenAmount; // Stablecoins = $1
                
                await Donation.create({
                    txHash: transfer.hash,
                    from: transfer.from,
                    to: transfer.to,
                    value: transfer.value,
                    currency: symbol,
                    timestamp: parseInt(transfer.timeStamp),
                    blockNumber: parseInt(transfer.blockNumber),
                    usdValue: usdValue,
                    priceAtTime: 1.0
                });
                
                logService(`Processed ${symbol} donation: ${tokenAmount} ${symbol} ($${usdValue.toFixed(2)}) from ${transfer.from}`);
            } catch (error) {
                logService(`Error processing ${symbol} transaction ${transfer.hash}: ${error.message}`);
            }
        }
    }
}
// --- END: DONATION PROCESSING ---

// --- START: LEADERBOARD DATA FUNCTION ---
async function getLeaderboardData() {
    logService("getLeaderboardData called - generating actual leaderboard data.");
    
    try {        // Ensure price caches are loaded
        if (ethPricesCache.length === 0) await refreshEthPricesCache();
        
        // Try to process any new donations first (skip if API unavailable)
        try {
            await processDonations();
        } catch (error) {
            logService(`Skipping donation processing due to error: ${error.message}`);
            logService("Generating leaderboard from existing donations only.");
        }
        
        // Aggregate donations by sender address
        const aggregatedDonations = await Donation.aggregate([
            {
                $group: {
                    _id: "$from",
                    totalUsdValue: { $sum: "$usdValue" },
                    donationCount: { $sum: 1 },
                    currencies: { $addToSet: "$currency" },
                    firstDonation: { $min: "$timestamp" },
                    lastDonation: { $max: "$timestamp" }
                }
            },
            {
                $sort: { totalUsdValue: -1 }
            }
        ]);
        
        // Add rank and format the data
        const leaderboardData = aggregatedDonations.map((item, index) => ({
            rank: index + 1,
            from: item._id,
            totalUsdValue: Math.round(item.totalUsdValue * 100) / 100, // Round to 2 decimal places
            donationCount: item.donationCount,
            currencies: item.currencies,
            firstDonation: item.firstDonation,
            lastDonation: item.lastDonation
        }));
        
        logService(`Generated leaderboard with ${leaderboardData.length} entries. Top donor: ${leaderboardData[0]?.totalUsdValue || 0} USD`);
        
        return leaderboardData;
    } catch (error) {
        logService(`Error in getLeaderboardData: ${error.message}`);
        console.error(error);
        return [];
    }
}
// --- END: LEADERBOARD DATA FUNCTION ---


// --- START: INITIALIZATION AND SCHEDULING ---
function schedulePriceUpdates() {
    logService("Scheduling price updates...");
    // UTC midnight for ETH price (Etherscan updates around then)
    schedule.scheduleJob({ rule: "0 0 * * *", tz: "Etc/UTC" }, async () => {
        logService("Scheduled job: Fetching daily ETH price.");
        await getAndSet_currentEthPrice();
    });

    // Schedule donation processing every hour
    schedule.scheduleJob({ rule: "0 * * * *", tz: "Etc/UTC" }, async () => {
        logService("Scheduled job: Processing new donations.");
        await processDonations();
    });

    // Placeholder for PLS price scheduling - will activate in Phase 2
    // schedule.scheduleJob({ rule: "5 0 * * *", tz: "Etc/UTC" }, async () => {
    //     logService("Scheduled job: Fetching daily PLS price.");
    //     // await getAndSet_currentPlsPrice(); // Implement in Phase 2
    // });
    logService("Price update and donation processing schedules configured.");
}

async function initializeLeaderboardService() {
    logService("Initializing Leaderboard Service...");
    await mongoose.connection.once('open', async () => { // Ensure DB is connected before initial cache load
        logService("MongoDB connection confirmed for Leaderboard Service initialization.");
        await refreshEthPricesCache(); // Load initial ETH prices into cache
        // await refreshPlsPricesCache(); // Load initial PLS prices - for Phase 2
    });
    schedulePriceUpdates(); // Set up daily fetching schedules
    
    // Fetch current prices on startup if it's been a while or cache is empty
    // This ensures that if the server restarts, it tries to get the latest price soon after.
    if (ethPricesCache.length === 0) { // Or check last updated timestamp
        logService("ETH price cache is empty on init, attempting initial fetch.");
        await getAndSet_currentEthPrice();
    }
    // Add similar for PLS in Phase 2

    logService("Leaderboard Service initialized.");
}
// --- END: INITIALIZATION AND SCHEDULING ---

// --- EXPORTS ---
module.exports = {
    initializeLeaderboardService,
    getLeaderboardData,
    processDonations, // Export for manual triggering if needed
    cleanupInvalidDonations, // Export for manual cleanup if needed
    // We can export getAndSet_currentEthPrice if we need to trigger it manually for tests,
    // but generally, it'll be handled by the scheduler and initialization.
    // getAndSet_currentEthPrice
};

// Function to clean up invalid donations (internal transfers, self-transactions, etc.)
async function cleanupInvalidDonations() {
    const donationAddresses = [ETH_MAIN_DONATION_ADDRESS, ETH_HISTORICAL_DONATION_ADDRESS];
    const donationAddressesLower = donationAddresses.map(addr => addr.toLowerCase());
    
    logService("Cleaning up invalid donations...");
    
    try {
        // Find donations FROM donation addresses (these are withdrawals/internal transfers, not donations)
        const invalidFromDonations = await Donation.find({
            from: { $in: donationAddresses.concat(donationAddressesLower) }
        });
        
        // Find donations TO addresses that are not donation addresses
        const invalidToDonations = await Donation.find({
            to: { $nin: donationAddresses.concat(donationAddressesLower) }
        });
        
        const totalInvalid = invalidFromDonations.length + invalidToDonations.length;
        
        if (totalInvalid > 0) {
            logService(`Found ${totalInvalid} invalid donations to remove:`);
            logService(`- ${invalidFromDonations.length} donations FROM donation addresses`);
            logService(`- ${invalidToDonations.length} donations TO non-donation addresses`);
            
            // Remove invalid donations
            await Donation.deleteMany({
                $or: [
                    { from: { $in: donationAddresses.concat(donationAddressesLower) } },
                    { to: { $nin: donationAddresses.concat(donationAddressesLower) } }
                ]
            });
            
            logService(`Removed ${totalInvalid} invalid donations from database`);
        } else {
            logService("No invalid donations found");
        }
    } catch (error) {
        logService(`Error cleaning up invalid donations: ${error.message}`);
    }
}