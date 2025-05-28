#!/usr/bin/env node
// find-specific-donation.js - Search for a specific donation transaction

const mongoose = require('mongoose');
const CONFIG = require('./config.json');

async function findSpecificDonation() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('❌ Please provide a transaction hash to search for');
        console.log('Usage: node find-specific-donation.js [transaction_hash]');
        console.log('Example: node find-specific-donation.js 0x1234567890abcdef...');
        return;
    }
    
    const searchTxHash = args[0];
    console.log(`🔍 Searching for transaction: ${searchTxHash}`);
    
    try {
        await mongoose.connect(CONFIG.mongodb.connectionString);
        console.log('🔗 Connected to MongoDB');
        
        // Use existing model
        let Donation;
        try {
            Donation = mongoose.model('Donation');
        } catch (error) {
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
        
        // Search in database
        const donation = await Donation.findOne({ txHash: searchTxHash });
        
        if (donation) {
            console.log('✅ Found transaction in database!');
            const date = new Date(donation.timestamp * 1000);
            console.log(`- Hash: ${donation.txHash}`);
            console.log(`- From: ${donation.from}`);
            console.log(`- To: ${donation.to}`);
            console.log(`- Amount: ${donation.value} ${donation.currency}`);
            console.log(`- USD Value: $${donation.usdValue.toFixed(2)}`);
            console.log(`- Date: ${date.toLocaleString()}`);
            console.log(`- Block: ${donation.blockNumber}`);
        } else {
            console.log('❌ Transaction NOT found in database');
            
            // Search on Etherscan
            console.log('\n🔍 Checking Etherscan for this transaction...');
            
            try {
                const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
                const etherscanUrl = `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${searchTxHash}&apikey=${CONFIG.etherscan.apikey}`;
                
                const response = await fetch(etherscanUrl);
                const data = await response.json();
                
                if (data.result) {
                    const tx = data.result;
                    console.log('✅ Found transaction on Etherscan!');
                    console.log(`- Hash: ${tx.hash}`);
                    console.log(`- From: ${tx.from}`);
                    console.log(`- To: ${tx.to}`);
                    console.log(`- Value: ${parseInt(tx.value, 16) / Math.pow(10, 18)} ETH`);
                    console.log(`- Block: ${parseInt(tx.blockNumber, 16)}`);
                    
                    // Check if it's to one of our donation addresses
                    const donationAddresses = [
                        CONFIG.donationAddresses.eth_main.toLowerCase(),
                        CONFIG.donationAddresses.eth_historical.toLowerCase()
                    ];
                    
                    if (donationAddresses.includes(tx.to.toLowerCase())) {
                        console.log('✅ This transaction IS to a donation address!');
                        console.log('❗ This should have been processed. There may be a processing issue.');
                    } else {
                        console.log('❌ This transaction is NOT to a donation address');
                        console.log(`Expected addresses: ${donationAddresses.join(', ')}`);
                    }
                } else {
                    console.log('❌ Transaction not found on Etherscan or still pending');
                }
                
            } catch (etherscanError) {
                console.log(`❌ Error checking Etherscan: ${etherscanError.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run if called directly
if (require.main === module) {
    findSpecificDonation();
}

module.exports = { findSpecificDonation };
