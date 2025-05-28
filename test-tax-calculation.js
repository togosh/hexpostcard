// Quick test to verify tax calculations are working correctly
const express = require('express');
const app = express();

// Mock leaderboard data for testing
const mockData = [
    { rank: 1, totalUsdValue: 98040, donationCount: 1 },
    { rank: 2, totalUsdValue: 50000, donationCount: 3 },
    { rank: 3, totalUsdValue: 25000, donationCount: 2 },
    { rank: 4, totalUsdValue: 13643, donationCount: 4 }
];

// Calculate totals like the frontend does
const totalDonations = mockData.reduce((sum, item) => sum + (item.totalUsdValue || 0), 0);
const totalDonors = mockData.length;
const totalTransactions = mockData.reduce((sum, item) => sum + (item.donationCount || 0), 0);

// Calculate estimated tax liability (15% short-term capital gains)
const taxLiability = totalDonations * 0.15;
const netAfterTax = totalDonations - taxLiability;

console.log('Tax Calculation Test Results:');
console.log('============================');
console.log(`Total Donations: $${totalDonations.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`Total Donors: ${totalDonors}`);
console.log(`Total Transactions: ${totalTransactions}`);
console.log(`Estimated Tax (15%): $${taxLiability.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`Net After Tax: $${netAfterTax.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log('============================');
console.log('These values should match what appears in the financial disclaimer section.');
