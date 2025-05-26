// test-leaderboard.js - Script to add test donation data for leaderboard testing
const mongoose = require('mongoose');
const CONFIG = require('./config.json');

// Use the same schemas as in leaderboard.js
const DonationSchema = new mongoose.Schema({
    txHash: { type: String, unique: true, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    value: { type: String, required: true },
    currency: { type: String, required: true },
    timestamp: { type: Number, required: true },
    blockNumber: { type: Number, required: true },
    usdValue: { type: Number, required: true },
    priceAtTime: { type: Number, required: true }
});

const Donation = mongoose.model('Donation', DonationSchema);

async function addTestData() {
    try {
        await mongoose.connect(CONFIG.mongodb.connectionString);
        console.log('Connected to MongoDB');

        // Clear existing test data
        await Donation.deleteMany({ txHash: { $regex: /^test_/ } });
        console.log('Cleared existing test data');

        // Test donation data
        const testDonations = [
            {
                txHash: 'test_0x123456789abcdef01',
                from: '0x742d35Cc6634C0532925a3b8D5c0e7F29dae2e98',
                to: '0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668',
                value: '5000000000000000000', // 5 ETH
                currency: 'ETH',
                timestamp: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
                blockNumber: 18500000,
                usdValue: 12500.00, // 5 ETH * $2500
                priceAtTime: 2500.00
            },
            {
                txHash: 'test_0x123456789abcdef02',
                from: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
                to: '0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668',
                value: '3500000000000000000', // 3.5 ETH
                currency: 'ETH',
                timestamp: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
                blockNumber: 18499000,
                usdValue: 8750.00, // 3.5 ETH * $2500
                priceAtTime: 2500.00
            },
            {
                txHash: 'test_0x123456789abcdef03',
                from: '0x8ba1f109551bD432803012645Hac136c5aBF50D',
                to: '0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668',
                value: '2000000000', // 2000 USDC (6 decimals)
                currency: 'USDC',
                timestamp: Math.floor(Date.now() / 1000) - 259200, // 3 days ago
                blockNumber: 18498000,
                usdValue: 2000.00,
                priceAtTime: 1.00
            },
            {
                txHash: 'test_0x123456789abcdef04',
                from: '0x742d35Cc6634C0532925a3b8D5c0e7F29dae2e98', // Same as first donor
                to: '0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668',
                value: '1500000000', // 1500 USDT (6 decimals)
                currency: 'USDT',
                timestamp: Math.floor(Date.now() / 1000) - 345600, // 4 days ago
                blockNumber: 18497000,
                usdValue: 1500.00,
                priceAtTime: 1.00
            },
            {
                txHash: 'test_0x123456789abcdef05',
                from: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
                to: '0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668',
                value: '1000000000000000000000', // 1000 DAI (18 decimals)
                currency: 'DAI',
                timestamp: Math.floor(Date.now() / 1000) - 432000, // 5 days ago
                blockNumber: 18496000,
                usdValue: 1000.00,
                priceAtTime: 1.00
            },
            {
                txHash: 'test_0x123456789abcdef06',
                from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                to: '0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668',
                value: '1500000000000000000', // 1.5 ETH
                currency: 'ETH',
                timestamp: Math.floor(Date.now() / 1000) - 518400, // 6 days ago
                blockNumber: 18495000,
                usdValue: 3750.00, // 1.5 ETH * $2500
                priceAtTime: 2500.00
            },
            {
                txHash: 'test_0x123456789abcdef07',
                from: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
                to: '0x716b1E629b0d3aBd14bD1E9E6557cdfaee839668',
                value: '500000000', // 500 USDC
                currency: 'USDC',
                timestamp: Math.floor(Date.now() / 1000) - 604800, // 7 days ago
                blockNumber: 18494000,
                usdValue: 500.00,
                priceAtTime: 1.00
            }
        ];

        // Insert test data
        await Donation.insertMany(testDonations);
        console.log(`Inserted ${testDonations.length} test donations`);

        // Display summary
        console.log('\\nTest Leaderboard Preview:');
        const pipeline = [
            {
                $group: {
                    _id: '$from',
                    totalUsdValue: { $sum: '$usdValue' },
                    donationCount: { $sum: 1 },
                    currencies: { $addToSet: '$currency' },
                    firstDonation: { $min: '$timestamp' }
                }
            },
            { $sort: { totalUsdValue: -1 } }
        ];

        const leaderboard = await Donation.aggregate(pipeline);
        leaderboard.forEach((donor, index) => {
            console.log(`${index + 1}. ${donor._id}: $${donor.totalUsdValue.toLocaleString()} (${donor.donationCount} donations, ${donor.currencies.join(', ')})`);
        });

        console.log('\\n✅ Test data added successfully!');
        console.log('🌐 Visit http://localhost:3000/leaderboard to see the test leaderboard');
        console.log('🔄 The leaderboard will auto-refresh every 15 minutes');
        console.log('');        console.log('To remove test data later, run:');
        console.log('node -e "require(\'mongoose\').connect(\''+CONFIG.mongodb.connectionString+'\').then(() => require(\'mongoose\').connection.db.collection(\'donations\').deleteMany({txHash: {$regex: /^test_/}})).then(() => process.exit())"');

    } catch (error) {
        console.error('Error adding test data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run if called directly
if (require.main === module) {
    addTestData();
}

module.exports = { addTestData };
