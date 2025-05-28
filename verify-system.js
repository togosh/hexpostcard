const config = require('./config.json');
const mongoose = require('mongoose');

// Quick verification script
async function verify() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(config.mongodb.connectionString);
        console.log('✓ Connected to MongoDB');
        
        // Check collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\nAvailable collections:');
        collections.forEach(col => {
            console.log('- ' + col.name);
        });
        
        // Check PLS prices
        const plsPricesCollection = mongoose.connection.db.collection('plsprices');
        const plsCount = await plsPricesCollection.countDocuments();
        console.log(`\nPLS prices: ${plsCount} entries`);
        
        // Check ETH prices  
        const ethPricesCollection = mongoose.connection.db.collection('ethprices');
        const ethCount = await ethPricesCollection.countDocuments();
        console.log(`ETH prices: ${ethCount} entries`);
        
        // Check donations
        const donationsCollection = mongoose.connection.db.collection('donations');
        const totalDonations = await donationsCollection.countDocuments();
        const plsDonations = await donationsCollection.countDocuments({currency: 'PLS'});
        const ethDonations = await donationsCollection.countDocuments({currency: 'ETH'});
        console.log(`\nTotal donations: ${totalDonations}`);
        console.log(`PLS donations: ${plsDonations}`);
        console.log(`ETH donations: ${ethDonations}`);
        
        console.log('\n✅ System verification complete! PLS integration is ready.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

verify();
