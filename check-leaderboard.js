const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function checkLeaderboard() {
    try {
        console.log('🔍 Checking leaderboard API...');
        
        const response = await fetch('http://localhost:3000/api/leaderboard');
        const data = await response.json();
        
        console.log('📊 Total entries:', data.length);
        console.log('\n🏆 Top 10 donors:');
        
        data.slice(0, 10).forEach((entry, i) => {
            console.log(`${i+1}. ${entry.from.substring(0, 10)}... - $${entry.totalUsdValue.toFixed(2)} (${entry.currencies.join(', ')})`);
        });
        
        // Look for the large donor
        const largeDonor = data.find(entry => entry.totalUsdValue > 90000);
        if (largeDonor) {
            console.log('\n🎯 LARGE DONOR FOUND:');
            console.log(`   Address: ${largeDonor.from}`);
            console.log(`   Value: $${largeDonor.totalUsdValue.toFixed(2)}`);
            console.log(`   Currencies: ${largeDonor.currencies.join(', ')}`);
            console.log(`   Rank: ${largeDonor.rank}`);
        } else {
            console.log('\n❌ Large donor not found in API response');
            console.log('   Checking for donors over $50,000...');
            const bigDonors = data.filter(entry => entry.totalUsdValue > 50000);
            console.log(`   Found ${bigDonors.length} donors over $50K`);
            bigDonors.forEach(donor => {
                console.log(`   - ${donor.from.substring(0, 10)}... $${donor.totalUsdValue.toFixed(2)}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error checking leaderboard:', error.message);
    }
}

checkLeaderboard();
