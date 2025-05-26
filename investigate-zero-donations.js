const mongoose = require('mongoose');
const config = require('./config.json');

async function investigateZeroDonations() {
    try {
        await mongoose.connect(config.mongodb.connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Connected to MongoDB');
        
        const donationSchema = new mongoose.Schema({}, { strict: false });
        const Donation = mongoose.model('Donation', donationSchema, 'donations');
        
        // Find all donations with $0 USD value
        const zeroDonations = await Donation.find({ usdValue: 0 }).sort({ timestamp: -1 }).limit(20);
        
        console.log(`\n🔍 Found ${zeroDonations.length} donations with $0 USD value:\n`);
        
        if (zeroDonations.length > 0) {
            console.log('📋 Sample zero-value donations:');
            zeroDonations.forEach((donation, i) => {
                const date = new Date(donation.timestamp * 1000).toISOString().split('T')[0];
                const ethAmount = donation.currency === 'ETH' ? (parseFloat(donation.value) / Math.pow(10, 18)).toFixed(6) : 'N/A';
                
                console.log(`${i+1}. ${donation.currency} - ${ethAmount} ETH - $${donation.usdValue} - ${date} - Price: $${donation.priceAtTime}`);
                console.log(`   From: ${donation.from}`);
                console.log(`   Tx: ${donation.txHash}`);
                console.log('');
            });
            
            // Check ETH price coverage
            const ethPriceSchema = new mongoose.Schema({}, { strict: false });
            const EthPrice = mongoose.model('EthPrice', ethPriceSchema, 'ethprices');
            
            const totalPrices = await EthPrice.countDocuments();
            const oldestPrice = await EthPrice.findOne().sort({ timestamp: 1 });
            const newestPrice = await EthPrice.findOne().sort({ timestamp: -1 });
            
            console.log(`\n📊 ETH Price Coverage:`);
            console.log(`   Total prices stored: ${totalPrices}`);
            if (oldestPrice && newestPrice) {
                console.log(`   Date range: ${new Date(oldestPrice.timestamp * 1000).toISOString().split('T')[0]} to ${new Date(newestPrice.timestamp * 1000).toISOString().split('T')[0]}`);
            }
            
            // Check for missing prices for zero donations
            console.log(`\n🔍 Checking price availability for zero donations:`);
            for (const donation of zeroDonations.slice(0, 5)) {
                const donationDate = new Date(donation.timestamp * 1000);
                donationDate.setUTCHours(0, 0, 0, 0);
                const dayTimestamp = Math.floor(donationDate.getTime() / 1000);
                
                const priceForDay = await EthPrice.findOne({ timestamp: dayTimestamp });
                const dateStr = donationDate.toISOString().split('T')[0];
                
                if (priceForDay) {
                    console.log(`   ✅ ${dateStr}: Price available ($${priceForDay.price})`);
                    
                    // Recalculate what the USD value should be
                    if (donation.currency === 'ETH') {
                        const ethAmount = parseFloat(donation.value) / Math.pow(10, 18);
                        const shouldBeUSD = ethAmount * priceForDay.price;
                        console.log(`      📊 Should be: ${ethAmount.toFixed(6)} ETH × $${priceForDay.price} = $${shouldBeUSD.toFixed(2)}`);
                    }
                } else {
                    console.log(`   ❌ ${dateStr}: No price available`);
                }
            }
        }
        
        // Check total counts
        const totalDonations = await Donation.countDocuments();
        const zeroCount = await Donation.countDocuments({ usdValue: 0 });
        const nonZeroCount = totalDonations - zeroCount;
        
        console.log(`\n📈 Summary:`);
        console.log(`   Total donations: ${totalDonations}`);
        console.log(`   Zero value: ${zeroCount} (${((zeroCount/totalDonations)*100).toFixed(1)}%)`);
        console.log(`   Non-zero value: ${nonZeroCount} (${((nonZeroCount/totalDonations)*100).toFixed(1)}%)`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

investigateZeroDonations();
