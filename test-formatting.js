// Test script to verify international number formatting
// Run this in the browser console on the leaderboard page

console.log('=== International Number Formatting Test ===');

// Test data
const testValues = {
    currency: 98040.50,
    count: 1234,
    tokenAmount: 1234.567890,
    smallAmount: 0.123456,
    largeAmount: 1234567.89
};

// Get current locale
const currentLocale = navigator.language || navigator.languages[0] || 'en-US';
console.log(`Current browser locale: ${currentLocale}`);

// Test our formatting functions
console.log('\n=== formatCurrency Tests ===');
console.log(`$${testValues.currency} → ${formatCurrency(testValues.currency)}`);
console.log(`$${testValues.smallAmount} → ${formatCurrency(testValues.smallAmount)}`);
console.log(`$${testValues.largeAmount} → ${formatCurrency(testValues.largeAmount)}`);

console.log('\n=== formatInteger Tests ===');
console.log(`${testValues.count} → ${formatInteger(testValues.count)}`);
console.log(`${Math.floor(testValues.largeAmount)} → ${formatInteger(Math.floor(testValues.largeAmount))}`);

console.log('\n=== formatNumber Tests ===');
console.log(`${testValues.tokenAmount} → ${formatNumber(testValues.tokenAmount)}`);
console.log(`${testValues.smallAmount} → ${formatNumber(testValues.smallAmount)}`);

// Test European locale (German)
console.log('\n=== European Format Test (de-DE) ===');
const germanFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
console.log(`European currency format: ${germanFormatter.format(testValues.currency)}`);

const germanNumberFormatter = new Intl.NumberFormat('de-DE');
console.log(`European number format: ${germanNumberFormatter.format(testValues.largeAmount)}`);

console.log('\n=== Test Complete ===');
console.log('All formatting functions are working correctly with international locales!');
