const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.log('\n=== Gmail Less Secure Apps Setup ===\n');

console.log('⚠️  WARNING: Google is phasing this out, but it might still work for some accounts.\n');

console.log('Steps to try:');
console.log('1. Go to: https://myaccount.google.com/security');
console.log('2. Turn ON "Less secure app access" (if available)');
console.log('3. Use your regular Gmail password (not an app password)\n');

console.log('If you don\'t see "Less secure app access":');
console.log('- Your account might have 2FA enabled (which disables this option)');
console.log('- Google might have removed it for your account type\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Do you see "Less secure app access" in your Google Account? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    console.log('\n✅ Great! Turn it ON and use this config:\n');
    
    const config = {
      email: {
        service: 'gmail',
        auth: {
          user: 'your-email@gmail.com',
          pass: 'your-regular-gmail-password'
        },
        to: 'destination@gmail.com'
      }
    };
    
    console.log('Config template:');
    console.log(JSON.stringify(config, null, 2));
    console.log('\nReplace with your actual email and password.');
    
  } else {
    console.log('\n❌ This option is not available for your account.');
    console.log('Try OAuth2 setup instead: npm run setup-oauth2');
  }
  rl.close();
});
