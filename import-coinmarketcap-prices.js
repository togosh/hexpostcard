const fs = require('fs');
const mongoose = require('mongoose');
const { parse } = require('csv-parse');
const config = require('./config.json');

// --- Mongoose Schema (should match leaderboard.js and backfill-eth-prices.js) ---
const EthPriceCacheSchema = new mongoose.Schema({
    date: { type: Date, required: true, unique: true }, // Ensure this is 'date' and type Date
    price: { type: Number, required: true },
    source: { type: String }
});
// Ensure the model uses the corrected schema and targets the 'ethprices' collection.
const EthPrice = mongoose.model('EthPriceCsvImportModel', EthPriceCacheSchema, 'ethprices'); 

async function importPricesFromCSV(csvFilePaths) {
    if (!csvFilePaths || csvFilePaths.length === 0) {
        console.error('No CSV file paths provided.');
        return;
    }

    try {
        await mongoose.connect(config.mongodb.connectionString);
        console.log('Connected to MongoDB for CSV price import.');

        let pricesAdded = 0;
        let pricesSkipped = 0;
        let pricesFailed = 0;
        let totalRowsProcessed = 0;

        const fileProcessingPromises = []; // Array to hold promises for each file

        for (const filePath of csvFilePaths) {
            console.log(`\nProcessing CSV file: ${filePath}`);
            if (!fs.existsSync(filePath)) {
                console.error(`File not found: ${filePath}`);
                pricesFailed += 1; // Count as a failure for summary
                continue;
            }

            const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
            const dbOperationPromises = []; // Initialize array to hold promises for DB operations for this file
            
            // Use a promise to handle the async nature of parsing for each file
            await new Promise((resolve, reject) => {
                const parser = parse({
                    delimiter: ';', // Assuming ';' is correct. If issues persist, verify CSVs.
                    columns: true, 
                    skip_empty_lines: true,
                    trim: true,
                    bom: true 
                });

                parser.on('readable', () => { // Removed async here, individual record processing will be async
                    let record;
                    while ((record = parser.read()) !== null) {
                        totalRowsProcessed++;
                        // Wrap record processing in an async IIFE and add its promise to the array
                        const recordProcessingPromise = (async () => {
                            const timeOpen = record.timeOpen;
                            const openPriceStr = record.open;

                            if (!timeOpen || !openPriceStr) {
                                console.warn(`Skipping row due to missing timeOpen or open price:`, record);
                                pricesFailed++;
                                return; // Exit this IIFE for this record
                            }

                            try {
                                const dateObj = new Date(timeOpen);
                                if (isNaN(dateObj.getTime())) {
                                    console.warn(`Skipping row due to invalid date format for timeOpen: ${timeOpen}`, record);
                                    pricesFailed++;
                                    return; // Exit
                                }
                                
                                dateObj.setUTCHours(0, 0, 0, 0);

                                const openPrice = parseFloat(openPriceStr);
                                if (isNaN(openPrice)) {
                                    console.warn(`Skipping row due to invalid format for open price: ${openPriceStr}`, record);
                                    pricesFailed++;
                                    return; // Exit
                                }

                                // Query by date object
                                const existingPrice = await EthPrice.findOne({ date: dateObj });
                                if (existingPrice) {
                                    pricesSkipped++;
                                } else {
                                    // Save with date object
                                    await EthPrice.create({
                                        date: dateObj,
                                        price: openPrice,
                                        source: 'coinmarketcap_csv'
                                    });
                                    pricesAdded++;
                                }
                            } catch (dbError) {
                                if (dbError.code === 11000) {
                                    pricesSkipped++; 
                                } else {
                                    console.error(`Error processing record:`, record, dbError);
                                    pricesFailed++;
                                }
                            }
                        })(); // Immediately invoke the async function
                        dbOperationPromises.push(recordProcessingPromise); // Add the promise to the list
                    }
                });

                parser.on('error', (err) => {
                    console.error(`Error parsing CSV file ${filePath}:`, err.message);
                    // Consider how to handle overall failure for a file. 
                    // For now, individual record errors are counted.
                    reject(err); // Reject the promise for this file
                });

                parser.on('end', async () => { // Make this async
                    console.log(`Finished reading records from ${filePath}. Waiting for database operations to complete...`);
                    try {
                        await Promise.allSettled(dbOperationPromises); // Wait for all DB ops for this file
                        console.log(`All database operations for ${filePath} completed.`);
                        resolve(); // Resolve the promise for this file
                    } catch (settleError) {
                        // This catch might not be strictly necessary if individual errors are handled
                        // but good for catching unexpected issues with Promise.allSettled itself.
                        console.error(`Error during Promise.allSettled for ${filePath}:`, settleError);
                        reject(settleError);
                    }
                });

                parser.write(fileContent);
                parser.end();
            });
        }

        console.log('\n--- CoinMarketCap CSV Import Summary ---');
        console.log(`Total rows processed: ${totalRowsProcessed}`);
        console.log(`Prices successfully added: ${pricesAdded}`);
        console.log(`Prices skipped (already existed or duplicate): ${pricesSkipped}`);
        console.log(`Rows/records failed to process: ${pricesFailed}`);

    } catch (error) {
        console.error('Critical error during CSV import process:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

// --- Define CSV file paths here ---
const csvFiles = [
    "c:\\Users\\steph\\Downloads\\Ethereum_1_1_2022-1_1_2023_historical_data_coinmarketcap.csv",
    "c:\\Users\\steph\\Downloads\\Ethereum_1_1_2023-1_1_2024_historical_data_coinmarketcap.csv",
    "c:\\Users\\steph\\Downloads\\Ethereum_1_1_2024-1_1_2025_historical_data_coinmarketcap.csv",
    "c:\\Users\\steph\\Downloads\\Ethereum_1_1_2025-5_26_2025_historical_data_coinmarketcap.csv"
    // Add more file paths if needed
];

if (require.main === module) {
    importPricesFromCSV(csvFiles).catch(err => console.error("Unhandled promise rejection in importPricesFromCSV:", err));
}

module.exports = { importPricesFromCSV }; // Export if you want to use it elsewhere
