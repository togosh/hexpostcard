#!/usr/bin/env node
// setup-api-key.js - Interactive script to set up Etherscan API key

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function setupApiKey() {
    console.log('\n🔧 HEXpostcards Leaderboard - API Key Setup\n');
    console.log('To track real donations, you need a free Etherscan API key.\n');
    console.log('📋 Steps to get your API key:');
    console.log('1. Go to https://etherscan.io/apis');
    console.log('2. Click "Create New API Key Token"');
    console.log('3. Register for a free account if needed');
    console.log('4. Copy your API key from the dashboard\n');

    const proceed = await askQuestion('Do you have an Etherscan API key ready? (y/n): ');
    
    if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
        console.log('\n📌 When you have your API key, run this script again or manually edit config.json');
        console.log('   Replace "YOUR_ETHERSCAN_API_KEY_HERE" with your actual key.\n');
        rl.close();
        return;
    }

    const apiKey = await askQuestion('\n🔑 Enter your Etherscan API key: ');
    
    if (!apiKey || apiKey.trim().length < 10) {
        console.log('\n❌ Invalid API key. Please run the script again with a valid key.\n');
        rl.close();
        return;
    }

    try {
        // Read current config
        const configPath = path.join(__dirname, 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Update API key
        config.etherscan.apikey = apiKey.trim();
        
        // Write back to file
        fs.writeFileSync(configPath, JSON.stringify(config, null, '\t'));
        
        console.log('\n✅ API key saved successfully!');
        console.log('🔄 Restart your server to begin tracking real donations.');
        console.log('\n📊 The leaderboard will now:');
        console.log('   • Fetch real ETH donations');
        console.log('   • Track USDC, USDT, and DAI transfers');
        console.log('   • Calculate USD values using historical prices');
        console.log('   • Update every 15 minutes');
        console.log('\n🌐 Visit http://localhost:3000/leaderboard to see results\n');
        
    } catch (error) {
        console.error('\n❌ Error saving API key:', error.message);
        console.log('💡 You can manually edit config.json to add your API key.\n');
    }
    
    rl.close();
}

// Run if called directly
if (require.main === module) {
    setupApiKey();
}

module.exports = { setupApiKey };
