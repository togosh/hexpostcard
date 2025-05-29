#!/usr/bin/env node

/**
 * System health check and diagnostics
 * Run this to diagnose potential issues before they cause crashes
 */

const mongoose = require('mongoose');
const CONFIG = require('./config.json');

console.log('🔍 Running HEXpostcard system health check...\n');

async function runHealthCheck() {
    // Check 1: Configuration
    console.log('1️⃣  Checking configuration...');
    try {
        if (!CONFIG.mongodb || !CONFIG.mongodb.connectionString) {
            console.log('❌ MongoDB connection string missing');
        } else {
            console.log('✅ MongoDB configuration found');
        }
        
        if (!CONFIG.etherscan || !CONFIG.etherscan.apikey || CONFIG.etherscan.apikey === 'YOUR_ETHERSCAN_API_KEY_HERE') {
            console.log('⚠️  Etherscan API key not configured (some features will be limited)');
        } else {
            console.log('✅ Etherscan API key configured');
        }
        
        if (!CONFIG.donationAddresses) {
            console.log('❌ Donation addresses not configured');
        } else {
            console.log('✅ Donation addresses configured');
        }
    } catch (error) {
        console.log('❌ Configuration error:', error.message);
    }

    // Check 2: MongoDB Connection
    console.log('\n2️⃣  Testing MongoDB connection...');
    try {
        await mongoose.connect(CONFIG.mongodb.connectionString, {
            maxPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000
        });
        console.log('✅ MongoDB connection successful');
        
        // Check 3: Database collections
        console.log('\n3️⃣  Checking database collections...');
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        const expectedCollections = ['donations', 'ethprices', 'plsprices'];
        expectedCollections.forEach(name => {
            if (collectionNames.includes(name)) {
                console.log(`✅ Collection '${name}' exists`);
            } else {
                console.log(`⚠️  Collection '${name}' not found (will be created as needed)`);
            }
        });
        
        // Check donation data
        const donationCount = await mongoose.connection.db.collection('donations').countDocuments();
        console.log(`📊 Total donations in database: ${donationCount}`);
        
        // Check price data
        const ethPriceCount = await mongoose.connection.db.collection('ethprices').countDocuments();
        console.log(`📈 ETH price records: ${ethPriceCount}`);
        
        const plsPriceCount = await mongoose.connection.db.collection('plsprices').countDocuments();
        console.log(`📈 PLS price records: ${plsPriceCount}`);
        
    } catch (error) {
        console.log('❌ Database check error:', error.message);
        return;
    }
    
    // Check 4: Memory usage
    console.log('\n4️⃣  Checking current memory usage...');
    const used = process.memoryUsage();
    const memoryMB = Math.round(used.rss / 1024 / 1024);
    const heapMB = Math.round(used.heapUsed / 1024 / 1024);
    
    console.log(`📊 Current process memory: RSS=${memoryMB}MB, Heap=${heapMB}MB`);
    
    if (memoryMB > 100) {
        console.log('⚠️  High memory usage detected for health check process');
    } else {
        console.log('✅ Memory usage looks normal');
    }
    
    // Check 5: API connectivity
    console.log('\n5️⃣  Testing external API connectivity...');
    
    // Test Etherscan
    if (CONFIG.etherscan && CONFIG.etherscan.apikey && CONFIG.etherscan.apikey !== 'YOUR_ETHERSCAN_API_KEY_HERE') {
        try {
            const fetch = require('node-fetch');
            const response = await fetch(`https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${CONFIG.etherscan.apikey}`);
            const data = await response.json();
            
            if (data.status === '1') {
                console.log('✅ Etherscan API connectivity working');
            } else {
                console.log('❌ Etherscan API error:', data.message);
            }
        } catch (error) {
            console.log('❌ Etherscan API connection failed:', error.message);
        }
    } else {
        console.log('⚠️  Skipping Etherscan API test (no API key)');
    }
    
    console.log('\n6️⃣  Health check summary:');
    console.log('✅ System health check completed');
    console.log('📝 Review any warnings above before starting the production server');
    console.log('\n🚀 To start the server with memory monitoring:');
    console.log('   npm run production');
    console.log('\n📊 To monitor memory usage separately:');
    console.log('   npm run monitor');
    
    await mongoose.connection.close();
    process.exit(0);
}

runHealthCheck().catch(error => {
    console.log('❌ Health check failed:', error.message);
    process.exit(1);
});
