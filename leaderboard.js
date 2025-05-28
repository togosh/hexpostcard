const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const schedule = require('node-schedule');

const CONFIG = require('./config.json'); // To access API keys, etc.

// --- START: LEADERBOARD CONFIGURATION CONSTANTS ---
const ETHERSCAN_API_KEY = CONFIG.etherscan.apikey;
const ETHERSCAN_API_BASE = "https://api.etherscan.io/api";

// PulseChain configuration
const PULSESCAN_API_BASE = "https://api.scan.pulsechain.com/api";
const PULSEX_SUBGRAPH_URL = "https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex";
const WPLS_CONTRACT_ADDRESS_ON_PLS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27"; // Wrapped PLS for price lookup

// Donation addresses
const ETH_MAIN_DONATION_ADDRESS = CONFIG.donationAddresses.eth_main;
const ETH_HISTORICAL_DONATION_ADDRESS = CONFIG.donationAddresses.eth_historical;
const PLS_MAIN_DONATION_ADDRESS = CONFIG.donationAddresses.pls_main;

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
    currency: { type: String, required: true }, // 'ETH', 'USDC', 'USDT', 'DAI', 'PLS'
    chain: { type: String, required: true, default: 'Ethereum' }, // 'Ethereum', 'PulseChain'
    timestamp: { type: Number, required: true },
    blockNumber: { type: Number, required: true },
    usdValue: { type: Number, required: true }, // USD value at time of transaction
    priceAtTime: { type: Number, required: true } // ETH/PLS price used for calculation (1.0 for stablecoins)
}, { collection: "donations" });
const Donation = mongoose.model('Donation', DonationSchema);
// --- END: MONGODB SCHEMAS FOR PRICES AND DONATIONS ---

// --- START: PRICE CACHING ---
let ethPricesCache = [];
let plsPricesCache = []; // For PLS prices later
// --- END: PRICE CACHING ---

// --- START: TRANSACTION FETCHING FUNCTIONS ---
// Generic function for fetching native transactions (ETH or PLS)
async function getNativeTransactions(address, apiBaseUrl, apiKey, chainName, startBlock = 0) {
    logService(`Fetching ${chainName} transactions for address ${address}...`);
    try {
        let url;
        
        if (chainName === 'PulseChain') {
            // PulseScan uses Etherscan-like API format
            url = `${apiBaseUrl}?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=99999999&sort=asc`;
            if (apiKey) url += `&apikey=${apiKey}`;
        } else {
            // Etherscan format
            url = `${apiBaseUrl}?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=99999999&sort=asc&apikey=${apiKey}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === "1" && data.result) {
            logService(`Found ${data.result.length} ${chainName} transactions for ${address}`);
            return data.result.filter(tx => 
                tx.to && tx.to.toLowerCase() === address.toLowerCase() && 
                tx.value !== "0" && 
                parseInt(tx.blockNumber) >= startBlock
            );
        } else {
            logService(`Error fetching ${chainName} transactions: ${data.message || 'Unknown error'}`);
            return [];
        }
    } catch (error) {
        logService(`Exception in getNativeTransactions for ${chainName}: ${error.message}`);
        return [];
    }
}

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
    if (currency === 'USDC' || currency === 'USDT' || currency === 'DAI') {
        return 1.0; // Stablecoins are always $1
    }
    
    const dayStart = new Date(timestamp * 1000);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayTimestamp = Math.floor(dayStart.getTime() / 1000);
    
    let priceCache;
    if (currency === 'PLS') {
        priceCache = plsPricesCache;
    } else {
        priceCache = ethPricesCache;
    }
    
    const priceEntry = priceCache.find(entry => entry.timestamp === dayTimestamp);
    if (priceEntry) {
        return priceEntry.price;
    }
    
    // Fallback: find closest price
    const sortedPrices = priceCache.sort((a, b) => Math.abs(a.timestamp - dayTimestamp) - Math.abs(b.timestamp - dayTimestamp));
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

// --- START: PLS PRICE FETCHING AND STORAGE LOGIC ---
async function fetchWithRetry(url, options, serviceName, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            logService(`${serviceName} attempt ${attempt}/${maxRetries} failed: ${error.message}`);
            if (attempt === maxRetries) {
                throw error;
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

async function getAndSet_currentPlsPrice() {
    logService("Attempting to get and set current PLS price...");
    try {
        // GraphQL query for PulseX Subgraph to get latest WPLS price
        const query = `
        {
            tokenDayDatas(
                where: { token: "${WPLS_CONTRACT_ADDRESS_ON_PLS.toLowerCase()}" }
                orderBy: date
                orderDirection: desc
                first: 1
            ) {
                date
                priceUSD
            }
        }`;

        const result = await fetchWithRetry(
            PULSEX_SUBGRAPH_URL,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            },
            "PulseX Subgraph PLS Price"
        );
        
        if (result.data && result.data.tokenDayDatas && result.data.tokenDayDatas.length > 0) {
            const latestData = result.data.tokenDayDatas[0];
            const price = parseFloat(latestData.priceUSD);
            const timestamp = parseInt(latestData.date);
            
            if (price > 0) {
                const existingPrice = await PlsPrice.findOne({ timestamp: timestamp });
                if (!existingPrice) {
                    await PlsPrice.create({ timestamp: timestamp, price: price });
                    logService(`Stored new PLS price for timestamp ${timestamp}: $${price}`);
                    await refreshPlsPricesCache(); // Update cache after new price
                } else {
                    logService(`PLS price for timestamp ${timestamp} already exists: $${existingPrice.price}`);
                }
            } else {
                logService(`Invalid PLS price received: ${price}`);
            }
        } else {
            logService(`Error fetching PLS price from PulseX Subgraph: ${JSON.stringify(result)}`);
        }
    } catch (error) {
        logService(`Exception in getAndSet_currentPlsPrice: ${error.message}`);
        console.error(error); // Log the full error for debugging
    }
}

async function refreshPlsPricesCache() {
    try {
        plsPricesCache = await PlsPrice.find().sort({ timestamp: 1 }).lean();
        logService(`PLS prices cache refreshed. ${plsPricesCache.length} entries.`);
    } catch (error) {
        logService(`Error refreshing PLS prices cache: ${error}`);
    }
}
// --- END: PLS PRICE FETCHING AND STORAGE LOGIC ---

// --- END: PLS PRICE FETCHING AND STORAGE LOGIC ---

// --- START: DONATION PROCESSING ---
// Helper function to process and store a single donation
async function processAndStoreDonation(tx, donationAddress, currency, chain, rawValue, formattedValue, priceAtTime, usdValue) {
    try {
        const txHash = tx.hash || tx.transaction_hash;
        const existing = await Donation.findOne({ txHash: txHash });
        if (existing) return false;

        await Donation.create({
            txHash: txHash,
            from: tx.from,
            to: tx.to,
            value: rawValue,
            currency: currency,
            chain: chain,
            timestamp: parseInt(tx.timeStamp || tx.timestamp),
            blockNumber: parseInt(tx.blockNumber || tx.block_number),
            usdValue: usdValue,
            priceAtTime: priceAtTime
        });

        logService(`Processed ${currency} donation: ${formattedValue} ${currency} ($${usdValue.toFixed(2)}) from ${tx.from} on ${chain}`);
        return true;
    } catch (error) {
        logService(`Error processing ${currency} transaction ${tx.hash || tx.transaction_hash}: ${error.message}`);
        return false;
    }
}

// Generic function to process donations for a specific address and chain
async function processDonationsForAddress(donationAddress, chain) {
    logService(`Processing donations for ${donationAddress} on ${chain}...`);
    
    // Get the last processed block number for this chain
    const lastDonation = await Donation.findOne({ chain: chain }).sort({ blockNumber: -1 });
    const startBlock = lastDonation ? lastDonation.blockNumber + 1 : 0;
    
    let newDonationsFound = false;
    
    if (chain === 'Ethereum') {
        // Process ETH donations (existing logic)
        const donationAddressesLower = [ETH_MAIN_DONATION_ADDRESS, ETH_HISTORICAL_DONATION_ADDRESS].map(addr => addr.toLowerCase());
        
        // Get both regular and internal transactions
        const regularTransactions = await getEthTransactions(donationAddress, startBlock);
        const internalTransactions = await getInternalEthTransactions(donationAddress, startBlock);
        
        // Combine both types of transactions
        const allTransactions = [...regularTransactions, ...internalTransactions];
        logService(`Total ETH transactions to process for ${donationAddress}: ${allTransactions.length} (${regularTransactions.length} regular + ${internalTransactions.length} internal)`);
        
        for (const tx of allTransactions) {
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
            const priceAtTime = getHistoricalPrice(parseInt(tx.timeStamp), 'ETH');
            
            if (priceAtTime > 0) {
                const usdValue = ethAmount * priceAtTime;
                const success = await processAndStoreDonation(tx, donationAddress, 'ETH', 'Ethereum', tx.value, ethAmount, priceAtTime, usdValue);
                if (success) newDonationsFound = true;
            } else {
                logService(`Skipping ETH transaction due to missing historical price: ${tx.hash}`);
            }
        }    } else if (chain === 'PulseChain') {
        // Process PLS donations
        const transactions = await getNativeTransactions(donationAddress, PULSESCAN_API_BASE, "", "PulseChain", startBlock);
        
        for (const tx of transactions) {
            // Check if transaction is valid and successful (using standard Etherscan-like format)
            if (tx.to && tx.to.toLowerCase() === donationAddress.toLowerCase() && 
                tx.value !== "0" && 
                parseInt(tx.blockNumber) >= startBlock) {
                
                const valueFormatted = parseFloat(tx.value) / Math.pow(10, 18); // PLS has 18 decimals
                
                // Use timestamp from the transaction
                const unixTimestamp = parseInt(tx.timeStamp);
                const priceAtTime = getHistoricalPrice(unixTimestamp, "PLS");
                
                if (priceAtTime > 0) {
                    const usdValue = valueFormatted * priceAtTime;
                    const success = await processAndStoreDonation(tx, donationAddress, "PLS", "PulseChain", tx.value, valueFormatted, priceAtTime, usdValue);
                    if (success) newDonationsFound = true;
                } else {
                    logService(`Skipping PLS transaction due to missing historical price: ${tx.hash}`);
                }
            }
        }// Add rate limit delay for PulseScan
        await new Promise(r => setTimeout(r, 2000));
    }
    
    return newDonationsFound;
}

async function processDonations() {
    logService("Processing donations...");
    
    try {        // Check if we have valid API keys
        const hasEtherscanKey = CONFIG.etherscan && CONFIG.etherscan.apikey && CONFIG.etherscan.apikey !== 'YOUR_ETHERSCAN_API_KEY_HERE';
        
        if (!hasEtherscanKey) {
            logService("No valid Etherscan API key configured. Skipping ETH donation processing, but will still process PLS donations.");
        }
        
        // First, clean up any existing invalid donations
        await cleanupInvalidDonations();
        
        let newDonationsFound = false;
        
        // Process ETH donations if Etherscan key is available
        if (hasEtherscanKey) {
            const addresses = [ETH_MAIN_DONATION_ADDRESS, ETH_HISTORICAL_DONATION_ADDRESS];
            for (const address of addresses) {
                const found = await processDonationsForAddress(address, 'Ethereum');
                if (found) newDonationsFound = true;
            }
            
            // Process stablecoin donations
            for (const [symbol, contractAddress] of Object.entries(STABLECOIN_CONTRACTS)) {
                await processTokenDonations(contractAddress, symbol);
            }
        }
          // Process PLS donations if PLS address is configured
        if (PLS_MAIN_DONATION_ADDRESS) {
            const found = await processDonationsForAddress(PLS_MAIN_DONATION_ADDRESS, 'PulseChain');
            if (found) newDonationsFound = true;
        }
        
        if (newDonationsFound) {
            logService("New donations found and processed.");
        } else {
            logService("No new donations found.");
        }
        
        logService("Donation processing completed.");
    } catch (error) {
        logService(`Error in processDonations: ${error.message}`);
        // Don't throw the error, just log it and continue
    }
}

async function processTokenDonations(tokenAddress, symbol) {
    const addresses = [ETH_MAIN_DONATION_ADDRESS, ETH_HISTORICAL_DONATION_ADDRESS];
    const donationAddressesLower = addresses.map(addr => addr.toLowerCase());
    
    // Get the last processed block number for this token
    const lastDonation = await Donation.findOne({ currency: symbol }).sort({ blockNumber: -1 });
    const startBlock = lastDonation ? lastDonation.blockNumber + 1 : 0;
    
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
                    chain: 'Ethereum',
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
    
    try {        
        // Ensure price caches are loaded
        if (ethPricesCache.length === 0) await refreshEthPricesCache();
        if (plsPricesCache.length === 0) await refreshPlsPricesCache();
        
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
                    chains: { $addToSet: "$chain" },
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
            chains: item.chains,
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

    // UTC 3 minutes past midnight for PLS price (after ETH price)
    schedule.scheduleJob({ rule: "3 0 * * *", tz: "Etc/UTC" }, async () => {
        logService("Scheduled job: Fetching daily PLS price.");
        await getAndSet_currentPlsPrice();
    });

    // Schedule donation processing every 5 minutes
    schedule.scheduleJob({ rule: "*/5 * * * *", tz: "Etc/UTC" }, async () => {
        logService("Scheduled job: Processing new donations.");
        await processDonations();
    });

    logService("Price update and donation processing schedules configured.");
}

async function initializeLeaderboardService() {
    logService("Initializing Leaderboard Service...");
    await mongoose.connection.once('open', async () => { // Ensure DB is connected before initial cache load
        logService("MongoDB connection confirmed for Leaderboard Service initialization.");
        await refreshEthPricesCache(); // Load initial ETH prices into cache
        await refreshPlsPricesCache(); // Load initial PLS prices into cache
    });
    schedulePriceUpdates(); // Set up daily fetching schedules
    
    // Fetch current prices on startup if it's been a while or cache is empty
    // This ensures that if the server restarts, it tries to get the latest price soon after.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayTs = Math.floor(today.getTime() / 1000);
    
    if (ethPricesCache.length === 0 || !ethPricesCache.find(p => p.timestamp === todayTs)) {
        logService("ETH price cache is empty or missing today's price on init, attempting initial fetch.");
        await getAndSet_currentEthPrice();
    }
    
    if (plsPricesCache.length === 0 || !plsPricesCache.find(p => p.timestamp === todayTs)) {
        logService("PLS price cache is empty or missing today's price on init, attempting initial fetch.");
        await getAndSet_currentPlsPrice();
    }

    logService("Leaderboard Service initialized.");
}
// --- END: INITIALIZATION AND SCHEDULING ---

// --- EXPORTS ---
module.exports = {
    initializeLeaderboardService,
    getLeaderboardData,
    processDonations, // Export for manual triggering if needed
    cleanupInvalidDonations, // Export for manual cleanup if needed
    getAndSet_currentEthPrice, // Export for manual ETH price fetching
    getAndSet_currentPlsPrice, // Export for manual PLS price fetching
    refreshEthPricesCache, // Export for manual cache refresh
    refreshPlsPricesCache, // Export for manual cache refresh
    // Export models for scripts
    EthPrice,
    PlsPrice,
    Donation,
};

// Function to clean up invalid donations (internal transfers, self-transactions, etc.)
async function cleanupInvalidDonations() {
    const ethDonationAddresses = [ETH_MAIN_DONATION_ADDRESS, ETH_HISTORICAL_DONATION_ADDRESS];
    const plsDonationAddresses = PLS_MAIN_DONATION_ADDRESS ? [PLS_MAIN_DONATION_ADDRESS] : [];
    const allDonationAddresses = [...ethDonationAddresses, ...plsDonationAddresses];
    const allDonationAddressesLower = allDonationAddresses.map(addr => addr.toLowerCase());
    
    logService("Cleaning up invalid donations...");
    
    try {
        // Find donations FROM donation addresses (these are withdrawals/internal transfers, not donations)
        const invalidFromDonations = await Donation.find({
            from: { $in: allDonationAddresses.concat(allDonationAddressesLower) }
        });
        
        // Find donations TO addresses that are not donation addresses
        const invalidToDonations = await Donation.find({
            to: { $nin: allDonationAddresses.concat(allDonationAddressesLower) }
        });
        
        const totalInvalid = invalidFromDonations.length + invalidToDonations.length;
        
        if (totalInvalid > 0) {
            logService(`Found ${totalInvalid} invalid donations to remove:`);
            logService(`- ${invalidFromDonations.length} donations FROM donation addresses`);
            logService(`- ${invalidToDonations.length} donations TO non-donation addresses`);
            
            // Remove invalid donations
            await Donation.deleteMany({
                $or: [
                    { from: { $in: allDonationAddresses.concat(allDonationAddressesLower) } },
                    { to: { $nin: allDonationAddresses.concat(allDonationAddressesLower) } }
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