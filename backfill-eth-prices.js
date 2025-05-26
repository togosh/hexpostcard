// backfill-eth-prices.js
const mongoose = require('mongoose');
const axios = require('axios');
const config = require('./config.json');

// --- Mongoose Schemas ---
// Align with leaderboard.js schema for 'ethprices' collection
const EthPriceCacheSchema = new mongoose.Schema({
    timestamp: { type: Number, required: true, unique: true }, // Unix timestamp in seconds, normalized to midnight UTC
    price: { type: Number, required: true },
    source: { type: String }
});
// Explicitly use 'ethprices' collection, ensure it matches your existing setup
const EthPrice = mongoose.model('EthPrice', EthPriceCacheSchema, 'ethprices');

const DonationSchema = new mongoose.Schema({
    txHash: { type: String, required: true, unique: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    value: { type: Number, required: true }, // Assuming value is stored as Number; if String, adjust accordingly
    token: { type: String, required: true },
    timestamp: { type: Date, required: true }, // Storing as Date object in donations
    blockNumber: { type: Number, required: true },
    usdValue: { type: Number, required: true },
    priceAtTime: { type: Number }
});
// Explicitly use 'donations' collection
const Donation = mongoose.model('Donation', DonationSchema, 'donations');

// --- Helper Functions ---
function formatDateForCoinGecko(date) {
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
}

function normalizeDateUTC(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

// --- Main Backfill Logic ---
async function backfillEthPrices() {
    try {
        await mongoose.connect(config.mongodb.connectionString);
        console.log('Connected to MongoDB for ETH price backfill.');

        // 1. Determine Date Range
        const earliestEthDonationDoc = await Donation.findOne({ token: 'ETH' }).sort({ timestamp: 1 }).lean();
        
        let startDate = new Date('2020-01-01T00:00:00.000Z'); // Default start date
        if (earliestEthDonationDoc && earliestEthDonationDoc.timestamp) {
            // earliestEthDonationDoc.timestamp is a Date object from the DonationSchema
            const donationDate = normalizeDateUTC(new Date(earliestEthDonationDoc.timestamp)); 
            if (donationDate < startDate) {
                 startDate = donationDate;
            } else if (new Date(earliestEthDonationDoc.timestamp) < new Date()) { // ensure timestamp is valid past date
                 startDate = donationDate;
            }
            // Ensure timestamp is a Date object before calling toISOString
            const logTimestamp = earliestEthDonationDoc.timestamp instanceof Date ? earliestEthDonationDoc.timestamp : new Date(earliestEthDonationDoc.timestamp);
            console.log(`Earliest ETH donation found on: ${logTimestamp.toISOString()}. Starting backfill from ${startDate.toISOString().split('T')[0]}.`);
        } else {
            console.log('No ETH donations found or timestamp issue. Using default start date: 2020-01-01');
        }
        startDate = normalizeDateUTC(startDate); // Ensure it's normalized

        const processingEndDate = normalizeDateUTC(new Date()); // Today at 00:00 UTC
        processingEndDate.setUTCDate(processingEndDate.getUTCDate() - 1); // Set to yesterday at 00:00 UTC

        // CoinGecko free tier limit is ~365 days of historical data.
        // Calculate the earliest date we can fetch from based on yesterday.
        const coingeckoApiLimitDate = new Date(processingEndDate); // Start from processingEndDate
        coingeckoApiLimitDate.setDate(coingeckoApiLimitDate.getDate() - 365); // Go back 365 days
        normalizeDateUTC(coingeckoApiLimitDate); // Ensure it's normalized to midnight UTC

        let effectiveStartDate = new Date(startDate); // Use a copy for modification
        if (effectiveStartDate < coingeckoApiLimitDate) {
            console.warn(`Original start date ${effectiveStartDate.toISOString().split('T')[0]} is beyond CoinGecko's ~365-day free tier limit (which starts around ${coingeckoApiLimitDate.toISOString().split('T')[0]}).`);
            effectiveStartDate = coingeckoApiLimitDate;
            console.warn(`Adjusted start date to ${effectiveStartDate.toISOString().split('T')[0]} to comply with API limits.`);
        }
        
        // Ensure effectiveStartDate is not after processingEndDate
        if (effectiveStartDate > processingEndDate) {
            console.log(`Effective start date ${effectiveStartDate.toISOString().split('T')[0]} is after processing end date ${processingEndDate.toISOString().split('T')[0]}. No new dates to process.`);
            await mongoose.disconnect();
            console.log('Disconnected from MongoDB.');
            return;
        }

        console.log(`Attempting to backfill ETH prices from ${effectiveStartDate.toISOString().split('T')[0]} to ${processingEndDate.toISOString().split('T')[0]}`);

        let pricesAdded = 0;
        let pricesFailed = 0;
        let pricesSkipped = 0;

        const currentDate = new Date(effectiveStartDate); // Iterator date, will be incremented

        while (currentDate <= processingEndDate) {
            const normalizedCurrentDateLoop = normalizeDateUTC(new Date(currentDate)); // Fresh normalized date for this iteration
            const unixTimestampSeconds = Math.floor(normalizedCurrentDateLoop.getTime() / 1000);
            const dateStrForApi = formatDateForCoinGecko(normalizedCurrentDateLoop);
            const dateStrForLog = normalizedCurrentDateLoop.toISOString().split('T')[0];

            const existingPrice = await EthPrice.findOne({ timestamp: unixTimestampSeconds }).lean();
            if (existingPrice) {
                console.log(`Price for ${dateStrForLog} (Timestamp: ${unixTimestampSeconds}) already exists ($${existingPrice.price} from ${existingPrice.source || 'unknown'}). Skipping.`);
                pricesSkipped++;
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for politeness
                continue;
            }

            console.log(`Fetching price for ${dateStrForLog} (API date: ${dateStrForApi})...`);
            try {
                // CoinGecko API: https://api.coingecko.com/api/v3/coins/ethereum/history?date=DD-MM-YYYY&localization=false
                const apiUrl = `https://api.coingecko.com/api/v3/coins/ethereum/history?date=${dateStrForApi}&localization=false`;
                const response = await axios.get(apiUrl);
                
                if (response.data && response.data.market_data && response.data.market_data.current_price && typeof response.data.market_data.current_price.usd !== 'undefined') {
                    const price = response.data.market_data.current_price.usd;
                    if (price === null || price === 0) { // CoinGecko might return null or 0 if data is truly missing for a day
                        console.warn(`CoinGecko returned price ${price} for ${dateStrForLog}. Treating as unavailable.`);
                        pricesFailed++;
                    } else {
                        await EthPrice.create({
                            timestamp: unixTimestampSeconds, // Use Unix timestamp
                            price: price,
                            source: 'coingecko_historical'
                        });
                        console.log(`Saved price for ${dateStrForLog} (Timestamp: ${unixTimestampSeconds}): $${price}`);
                        pricesAdded++;
                    }
                } else {
                    console.warn(`No valid price data found for ${dateStrForLog} in CoinGecko response. Response:`, JSON.stringify(response.data, null, 2));
                    pricesFailed++;
                }
            } catch (error) {
                let errorMessage = error.message;
                if (error.response) {
                    errorMessage += ` | Status: ${error.response.status} | Data: ${JSON.stringify(error.response.data)}`;
                }
                console.error(`Error fetching price for ${dateStrForLog}: ${errorMessage}`);
                
                if (error.response && error.response.status === 429) {
                    console.log('Rate limit hit (429). Waiting for 60 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60s
                    continue; // Retry current date after waiting, do not increment currentDate
                } else if (error.response && error.response.status === 404) {
                    console.warn(`CoinGecko returned 404 for ${dateStrForLog}. Price unavailable for this date.`);
                    pricesFailed++; 
                } else {
                    pricesFailed++; // Other errors
                }
            }

            currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Move to next day
            // CoinGecko free tier: ~10-30 calls/minute. 6 seconds delay = 10 calls/minute.
            await new Promise(resolve => setTimeout(resolve, 6000)); 
        }

        console.log('\n--- ETH Price Backfill Summary ---');
        console.log(`Processed dates from ${effectiveStartDate.toISOString().split('T')[0]} to ${processingEndDate.toISOString().split('T')[0]}`);
        console.log(`Prices successfully added: ${pricesAdded}`);
        console.log(`Prices skipped (already existed): ${pricesSkipped}`);
        console.log(`Prices failed/unavailable: ${pricesFailed}`);

    } catch (error) {
        console.error('Critical error during ETH price backfill process:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

backfillEthPrices();
