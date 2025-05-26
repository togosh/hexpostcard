const mongoose = require('mongoose');
const config = require('./config.json');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ETHERSCAN_API_KEY = config.etherscan.apikey;
const ETHERSCAN_API_BASE = "https://api.etherscan.io/api";

async function fixZeroDonations() {
    try {
        await mongoose.connect(config.mongodb.connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Connected to MongoDB');
        
        const donationSchema = new mongoose.Schema({}, { strict: false });
        const Donation = mongoose.model('Donation', donationSchema, 'donations');
        
        const ethPriceSchema = new mongoose.Schema({}, { strict: false });
        const EthPrice = mongoose.model('EthPrice', ethPriceSchema, 'ethprices');
        
        // Load all ETH prices into cache
        const allPrices = await EthPrice.find().sort({ timestamp: 1 });
        console.log(`📊 Loaded ${allPrices.length} ETH prices into cache`);
        
        // Get current ETH price as fallback
        let currentPrice = 2570; // Default fallback
        try {
            const resp = await (await fetch(`${ETHERSCAN_API_BASE}?module=stats&action=ethprice&apikey=${ETHERSCAN_API_KEY}`)).json();
            if (resp.status === "1" && resp.result && resp.result.ethusd) {
                currentPrice = parseFloat(resp.result.ethusd);
                console.log(`💰 Current ETH price: $${currentPrice}`);
            }
        } catch (error) {
            console.log(`⚠️  Using fallback ETH price: $${currentPrice}`);
        }
        
        // Find all donations with $0 USD value
        const zeroDonations = await Donation.find({ usdValue: 0 });
        console.log(`🔍 Found ${zeroDonations.length} donations with $0 USD value`);
        
        let fixedCount = 0;
        let totalValueAdded = 0;
        
        for (const donation of zeroDonations) {
            try {
                let newUsdValue = 0;
                let newPriceAtTime = 0;
                
                if (donation.currency === 'ETH') {
                    const ethAmount = parseFloat(donation.value) / Math.pow(10, 18);
                    
                    // Find price for the donation date
                    const donationDate = new Date(donation.timestamp * 1000);
                    donationDate.setUTCHours(0, 0, 0, 0);
                    const dayTimestamp = Math.floor(donationDate.getTime() / 1000);
                    
                    // Look for exact date price
                    let priceEntry = allPrices.find(p => p.timestamp === dayTimestamp);
                    
                    if (!priceEntry) {
                        // Find closest price
                        const sortedPrices = allPrices.sort((a, b) => 
                            Math.abs(a.timestamp - dayTimestamp) - Math.abs(b.timestamp - dayTimestamp)
                        );
                        priceEntry = sortedPrices[0];
                    }
                    
                    if (priceEntry) {
                        newPriceAtTime = priceEntry.price;
                        newUsdValue = ethAmount * newPriceAtTime;
                    } else {
                        // Use current price as final fallback
                        newPriceAtTime = currentPrice;
                        newUsdValue = ethAmount * currentPrice;
                        console.log(`   ⚠️  No historical price found for ${donationDate.toISOString().split('T')[0]}, using current price`);
                    }
                    
                    // Update the donation
                    await Donation.updateOne(
                        { _id: donation._id },
                        { 
                            usdValue: newUsdValue,
                            priceAtTime: newPriceAtTime
                        }
                    );
                    
                    console.log(`✅ Fixed: ${ethAmount.toFixed(6)} ETH × $${newPriceAtTime.toFixed(2)} = $${newUsdValue.toFixed(2)} (${donationDate.toISOString().split('T')[0]})`);
                    
                    fixedCount++;
                    totalValueAdded += newUsdValue;
                    
                } else {
                    // Stablecoin should always be $1
                    let tokenAmount;
                    if (donation.currency === 'USDC' || donation.currency === 'USDT') {
                        tokenAmount = parseFloat(donation.value) / Math.pow(10, 6);
                    } else if (donation.currency === 'DAI') {
                        tokenAmount = parseFloat(donation.value) / Math.pow(10, 18);
                    }
                    
                    if (tokenAmount) {
                        await Donation.updateOne(
                            { _id: donation._id },
                            { 
                                usdValue: tokenAmount,
                                priceAtTime: 1.0
                            }
                        );
                        
                        console.log(`✅ Fixed: ${tokenAmount.toFixed(2)} ${donation.currency} = $${tokenAmount.toFixed(2)}`);
                        fixedCount++;
                        totalValueAdded += tokenAmount;
                    }
                }
                
            } catch (error) {
                console.error(`❌ Error fixing donation ${donation.txHash}: ${error.message}`);
            }
        }
        
        console.log(`\n🎉 Summary:`);
        console.log(`   Fixed ${fixedCount} donations`);
        console.log(`   Total value added: $${totalValueAdded.toFixed(2)}`);
        console.log(`   Remaining zero donations: ${zeroDonations.length - fixedCount}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

fixZeroDonations();
