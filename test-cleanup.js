const leaderboard = require('./leaderboard.js');

async function testCleanup() {
    try {
        console.log('🧹 Testing donation cleanup...');
        
        // Run the cleanup function
        await leaderboard.cleanupInvalidDonations();
        
        console.log('✅ Cleanup completed successfully');
        console.log('🔄 Refreshing leaderboard data...');
        
        // Get updated leaderboard data
        const data = await leaderboard.getLeaderboardData();
        
        console.log(`📊 Updated leaderboard with ${data.length} entries`);
        console.log('\n🏆 Top 5 donors after cleanup:');
        
        data.slice(0, 5).forEach((entry, i) => {
            console.log(`${i+1}. ${entry.from.substring(0, 10)}... - $${entry.totalUsdValue.toFixed(2)} (${entry.currencies.join(', ')})`);
        });
        
        // Check if the large donor is still there
        const largeDonor = data.find(entry => entry.totalUsdValue > 90000);
        if (largeDonor) {
            console.log('\n🎯 Large donor still present after cleanup:');
            console.log(`   Value: $${largeDonor.totalUsdValue.toFixed(2)}`);
            console.log(`   Address: ${largeDonor.from}`);
        } else {
            console.log('\n⚠️  Large donor not found after cleanup');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during cleanup test:', error.message);
        process.exit(1);
    }
}

testCleanup();
