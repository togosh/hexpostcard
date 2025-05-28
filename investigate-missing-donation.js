#!/usr/bin/env node
// investigate-missing-donation.js - Debug script to investigate missing donations

const mongoose = require('mongoose');
const CONFIG = require('./config.json');
const leaderboard = require('./leaderboard.js');

// Use the same schemas as in leaderboard.js
let Donation;
try {
    // Try to get existing model first
    Donation = mongoose.model('Donation');
} catch (error) {
    // Model doesn't exist, create it
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
    Donation = mongoose.model('Donation', DonationSchema);
}

async function investigateMissingDonation() {
    try {
        await mongoose.connect(CONFIG.mongodb.connectionString);
        console.log('🔗 Connected to MongoDB');
        
        console.log('\n📊 Current Database Status:');
        
        // Check current donations
        const allDonations = await Donation.find().sort({timestamp: -1});
        console.log(`\n💰 Found ${allDonations.length} total donations in database`);
        
        if (allDonations.length > 0) {
            console.log('\n🏆 Recent donations (last 10):');
            allDonations.slice(0, 10).forEach((d, i) => {
                const date = new Date(d.timestamp * 1000);
                console.log(`${i+1}. ${d.txHash} | ${d.from} | ${d.value} ${d.currency} | $${d.usdValue.toFixed(2)} | ${date.toLocaleString()}`);
            });
        }
        
        // Check configuration
        console.log('\n⚙️  Configuration Check:');
        console.log(`- Main donation address: ${CONFIG.donationAddresses.eth_main}`);
        console.log(`- Historical donation address: ${CONFIG.donationAddresses.eth_historical}`);
        console.log(`- Etherscan API key: ${CONFIG.etherscan.apikey ? 'Configured' : 'MISSING'}`);
        
        // Check latest block processed
        const lastDonation = await Donation.findOne().sort({ blockNumber: -1 });
        if (lastDonation) {
            console.log(`- Last processed block: ${lastDonation.blockNumber}`);
            console.log(`- Last processed transaction time: ${new Date(lastDonation.timestamp * 1000).toLocaleString()}`);
        } else {
            console.log('- No donations processed yet');
        }
        
        console.log('\n🔍 Testing Etherscan API Connection:');
        
        // Test Etherscan API
        const testApiUrl = `https://api.etherscan.io/api?module=account&action=txlist&address=${CONFIG.donationAddresses.eth_main}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${CONFIG.etherscan.apikey}`;
        
        try {
            const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
            const response = await fetch(testApiUrl);
            const data = await response.json();
            
            if (data.status === '1') {
                console.log(`✅ Etherscan API working! Found ${data.result.length} recent transactions`);
                
                // Look for recent ETH transactions
                const recentEthTxs = data.result.filter(tx => 
                    tx.to.toLowerCase() === CONFIG.donationAddresses.eth_main.toLowerCase() ||
                    tx.to.toLowerCase() === CONFIG.donationAddresses.eth_historical.toLowerCase()
                );
                
                if (recentEthTxs.length > 0) {
                    console.log(`\n💎 Found ${recentEthTxs.length} recent ETH transactions to donation addresses:`);
                    recentEthTxs.slice(0, 5).forEach((tx, i) => {
                        const ethValue = parseFloat(tx.value) / Math.pow(10, 18);
                        const date = new Date(parseInt(tx.timeStamp) * 1000);
                        console.log(`${i+1}. ${tx.hash} | ${tx.from} | ${ethValue.toFixed(4)} ETH | ${date.toLocaleString()}`);
                        
                        // Check if this transaction is in our database
                        const isInDb = allDonations.find(d => d.txHash === tx.hash);
                        if (isInDb) {
                            console.log(`   ✅ This transaction IS in database`);
                        } else {
                            console.log(`   ❌ This transaction is NOT in database - MISSING!`);
                        }
                    });
                }
            } else {
                console.log(`❌ Etherscan API error: ${data.message}`);
            }
        } catch (apiError) {
            console.log(`❌ Failed to test Etherscan API: ${apiError.message}`);
        }
        
        console.log('\n🔧 Manual Processing Test:');
        console.log('Attempting to manually process donations...');
        
        try {
            await leaderboard.processDonations();
            console.log('✅ Manual donation processing completed successfully');
            
            // Check again after processing
            const updatedDonations = await Donation.find().sort({timestamp: -1});
            console.log(`📊 After processing: ${updatedDonations.length} total donations`);
            
            if (updatedDonations.length > allDonations.length) {
                const newDonations = updatedDonations.length - allDonations.length;
                console.log(`🎉 Found ${newDonations} new donations!`);
            }
            
        } catch (processError) {
            console.log(`❌ Manual processing failed: ${processError.message}`);
            console.log(`Full error:`, processError);
        }
        
        console.log('\n📋 Investigation Summary:');
        console.log('1. Check if your transaction appears in the "recent ETH transactions" list above');
        console.log('2. If it appears but says "NOT in database", then processing failed');
        console.log('3. If it doesn\'t appear, verify you sent to the correct address');
        console.log('4. If manual processing failed, check the error message above');
        console.log(`\n💡 Expected donation addresses:`);
        console.log(`   Main: ${CONFIG.donationAddresses.eth_main}`);
        console.log(`   Historical: ${CONFIG.donationAddresses.eth_historical}`);
        
    } catch (error) {
        console.error('❌ Investigation failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run if called directly
if (require.main === module) {
    investigateMissingDonation();
}

module.exports = { investigateMissingDonation };
