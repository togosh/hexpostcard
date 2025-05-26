// check-missing-prices.js
const mongoose = require('mongoose');
const config = require('./config.json');

// --- Mongoose Schemas ---
const EthPriceCacheSchema = new mongoose.Schema({
    date: { type: Date, required: true, unique: true }, // Normalized to midnight UTC
    price: { type: Number, required: true },
    source: { type: String }
});
const EthPrice = mongoose.model('EthPriceCheck', EthPriceCacheSchema, 'ethprices');

const DonationSchema = new mongoose.Schema({
    txHash: { type: String, required: true, unique: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    value: { type: Number, required: true }, // In the screenshot, value is a String, might need conversion if doing math
    currency: { type: String, required: true }, // Changed from token to currency
    timestamp: { type: Date, required: true }, // In the screenshot, timestamp is a Number (Unix?), ensure schema matches actual type or convert
    blockNumber: { type: Number, required: true },
    usdValue: { type: Number, required: true },
    priceAtTime: { type: Number }
});
const Donation = mongoose.model('DonationCheck', DonationSchema, 'donations');

function normalizeDateUTC(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

async function checkDonationsForMissingPrices() {
    try {
        await mongoose.connect(config.mongodb.connectionString);
        console.log('Connected to MongoDB.');

        // Diagnostic: Count all documents in the donations collection
        const totalDonationsCount = await Donation.countDocuments();
        console.log(`Total documents found in 'donations' collection: ${totalDonationsCount}`);

        if (totalDonationsCount === 0) {
            console.log('The donations collection is empty.');
            return;
        }

        // Diagnostic: Fetch and log one sample document
        const sampleDonation = await Donation.findOne().lean();
        console.log('Sample donation document:', JSON.stringify(sampleDonation, null, 2));

        // Proceed with checking ETH donations
        const ethDonations = await Donation.find({ currency: 'ETH' }).lean(); // Changed from token to currency
        if (!ethDonations.length) {
            console.log('No ETH donations found with filter { currency: "ETH" }.');
            // Log distinct token values to see what's available
            try {
                const distinctCurrencies = await Donation.distinct('currency'); // Changed from token to currency
                console.log('Distinct currency values in the collection:', distinctCurrencies);
            } catch (distinctError) {
                console.error('Error fetching distinct currency values:', distinctError);
            }
            return;
        }

        console.log(`Found ${ethDonations.length} ETH donations. Checking for missing prices...`);

        let missingPriceCount = 0;
        const missingPriceDetails = [];

        for (const donation of ethDonations) {
            const donationDateEpochMs = donation.timestamp * 1000; // Convert Unix seconds to milliseconds
            const donationDate = normalizeDateUTC(donationDateEpochMs);
            const priceEntry = await EthPrice.findOne({ date: donationDate }).lean();

            if (!priceEntry) {
                missingPriceCount++;
                const detail = {
                    txHash: donation.txHash,
                    donationDate: new Date(donationDateEpochMs).toISOString(), // Use epoch ms for correct full date
                    normalizedDateKey: donationDate.toISOString().split('T')[0],
                    value: donation.value,
                    currentUsdValue: donation.usdValue,
                    priceAtTime: donation.priceAtTime
                };
                missingPriceDetails.push(detail);
                console.warn(`Missing price for ETH donation: Tx ${donation.txHash}, Date: ${donationDate.toISOString().split('T')[0]}`);
            }
        }

        console.log('\n--- Missing ETH Price Check Summary ---');
        if (missingPriceCount === 0) {
            console.log('All ETH donations have a corresponding price entry in the ethprices collection.');
        } else {
            console.log(`Found ${missingPriceCount} ETH donation(s) missing a price entry.`);
            console.log('Details of donations missing prices:');
            missingPriceDetails.forEach(detail => console.log(JSON.stringify(detail, null, 2)));
        }

    } catch (error) {
        console.error('Critical error during missing price check:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

checkDonationsForMissingPrices();
