const mongoose = require('mongoose');
const CONFIG = require('./config.json');

// Use the same schema as in leaderboard.js
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

async function removeTestData() {
    try {
        await mongoose.connect(CONFIG.mongodb.connectionString);
        console.log('Connected to MongoDB');
        
        // Check current donations
        const allDonations = await Donation.find().sort({timestamp: -1});
        console.log(`Found ${allDonations.length} total donations`);
        
        if (allDonations.length > 0) {
            console.log('\nCurrent donations:');
            allDonations.forEach(d => {
                const date = new Date(d.timestamp * 1000);
                console.log(`- ${d.txHash} | ${d.from} | ${d.value} ${d.currency} | $${d.usdValue.toFixed(2)} | ${date.toLocaleDateString()}`);
            });
        }
        
        // Remove test donations (those with test_ prefix in txHash)
        const deleteResult = await Donation.deleteMany({ 
            txHash: { $regex: /^test_/ } 
        });
        
        console.log(`\nDeleted ${deleteResult.deletedCount} test donations`);
        
        // Show remaining donations
        const remainingDonations = await Donation.find().sort({timestamp: -1});
        console.log(`\nRemaining donations: ${remainingDonations.length}`);
        
        if (remainingDonations.length > 0) {
            console.log('\nReal donations:');
            remainingDonations.forEach(d => {
                const date = new Date(d.timestamp * 1000);
                console.log(`- ${d.txHash} | ${d.from} | ${d.value} ${d.currency} | $${d.usdValue.toFixed(2)} | ${date.toLocaleDateString()}`);
            });
        } else {
            console.log('No real donations found yet. The system will fetch them automatically every 15 minutes.');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

removeTestData();
