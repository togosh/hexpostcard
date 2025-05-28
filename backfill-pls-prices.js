const config = require('./config.json');
const mongoose = require('mongoose');

// --- MongoDB Schema Definitions ---
const PlsPriceSchema = new mongoose.Schema({
    priceUsd: { type: Number, required: true },
    timestamp: { type: Date, required: true },
    source: { type: String, default: 'PulseX_Subgraph' }
});

// Create indexes for faster queries
PlsPriceSchema.index({ timestamp: 1 });

const PlsPrice = mongoose.model('PlsPrice', PlsPriceSchema);

// PulseX GraphQL endpoint for PLS price data
const PULSEX_SUBGRAPH_URL = 'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex';

/**
 * Fetch historical PLS price for a specific date using PulseX Subgraph
 */
async function fetchPlsPriceForDate(date) {
    try {
        const timestamp = Math.floor(date.getTime() / 1000);
        
        const query = `
        {
            token(id: "0xa1077a294dde1b09bb078844df40758a5d0f9a27") {
                id
                symbol
                name
                derivedUSD
                tokenDayData(
                    first: 1
                    where: { date_lte: ${timestamp} }
                    orderBy: date
                    orderDirection: desc
                ) {
                    date
                    priceUSD
                    totalLiquidityUSD
                    dailyVolumeUSD
                }
            }
        }`;

        const response = await fetch(PULSEX_SUBGRAPH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.errors) {
            throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        if (!data.data || !data.data.token) {
            throw new Error('No token data found');
        }

        const token = data.data.token;
        let priceUsd = null;

        // Try to get price from token day data first (most accurate)
        if (token.tokenDayData && token.tokenDayData.length > 0) {
            priceUsd = parseFloat(token.tokenDayData[0].priceUSD);
        }
        
        // Fallback to derivedUSD if no day data
        if (!priceUsd && token.derivedUSD) {
            priceUsd = parseFloat(token.derivedUSD);
        }

        if (!priceUsd || priceUsd <= 0) {
            throw new Error('Invalid price data received');
        }

        return priceUsd;
    } catch (error) {
        console.error(`Error fetching PLS price for ${date.toISOString()}: ${error.message}`);
        return null;
    }
}

/**
 * Backfill PLS prices for a date range
 */
async function backfillPlsPrices(startDate, endDate) {
    console.log(`Starting PLS price backfill from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    let successCount = 0;
    let errorCount = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        try {
            // Check if price already exists for this date
            const existingPrice = await PlsPrice.findOne({
                timestamp: {
                    $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
                    $lt: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
                }
            });
            
            if (existingPrice) {
                console.log(`Price already exists for ${dateStr}: $${existingPrice.priceUsd}`);
            } else {
                console.log(`Fetching PLS price for ${dateStr}...`);
                const priceUsd = await fetchPlsPriceForDate(currentDate);
                
                if (priceUsd) {
                    await PlsPrice.create({
                        priceUsd: priceUsd,
                        timestamp: new Date(currentDate),
                        source: 'PulseX_Subgraph'
                    });
                    
                    console.log(`✓ Saved PLS price for ${dateStr}: $${priceUsd}`);
                    successCount++;
                } else {
                    console.log(`✗ Failed to fetch PLS price for ${dateStr}`);
                    errorCount++;
                }
            }
            
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error(`Error processing ${dateStr}: ${error.message}`);
            errorCount++;
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`\nBackfill completed!`);
    console.log(`✓ Success: ${successCount} prices`);
    console.log(`✗ Errors: ${errorCount} prices`);
}

/**
 * Main execution function
 */
async function main() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(config.mongodb.connectionString);
        console.log('✓ Connected to MongoDB');
        
        // Get command line arguments for date range
        const args = process.argv.slice(2);
        
        let startDate, endDate;
        
        if (args.length >= 2) {
            startDate = new Date(args[0]);
            endDate = new Date(args[1]);
        } else {
            // Default range based on known PLS donation dates
            startDate = new Date('2024-02-04'); // First PLS donation
            endDate = new Date(); // Today
        }
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Invalid date format. Use YYYY-MM-DD format.');
        }
        
        if (startDate > endDate) {
            throw new Error('Start date must be before end date.');
        }
        
        await backfillPlsPrices(startDate, endDate);
        
    } catch (error) {
        console.error('Error in main execution:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
        process.exit(0);
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

module.exports = { backfillPlsPrices, fetchPlsPriceForDate };
