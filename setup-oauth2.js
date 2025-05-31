const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.log('\n=== Gmail OAuth2 Setup for HEXpostcards ===\n');

console.log('This is the most secure method. Follow these steps:\n');

console.log('1. Go to Google Cloud Console:');
console.log('   https://console.cloud.google.com/\n');

console.log('2. Create a new project or select existing one\n');

console.log('3. Enable Gmail API:');
console.log('   - Go to APIs & Services > Library');
console.log('   - Search for "Gmail API"');
console.log('   - Click Enable\n');

console.log('4. Create OAuth2 Credentials:');
console.log('   - Go to APIs & Services > Credentials');
console.log('   - Click "Create Credentials" > "OAuth client ID"');
console.log('   - Choose "Desktop application"');
console.log('   - Name it "HEXpostcards Email"');
console.log('   - Download the JSON file\n');

console.log('5. Add authorized redirect URI:');
console.log('   - Add: http://localhost:3000/oauth2callback');
console.log('   - Or: https://developers.google.com/oauthplayground\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Do you want to continue with OAuth2 setup? (y/n): ');

rl.question('', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    console.log('\nI\'ll create the OAuth2 configuration for you...\n');
    
    const oauthConfig = {
      email: {
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: 'YOUR_EMAIL@gmail.com',
          clientId: 'YOUR_CLIENT_ID.googleusercontent.com',
          clientSecret: 'YOUR_CLIENT_SECRET',
          refreshToken: 'YOUR_REFRESH_TOKEN'
        },
        to: 'YOUR_DESTINATION_EMAIL@gmail.com'
      }
    };
    
    console.log('Created config template. You\'ll need to:');
    console.log('1. Replace the OAuth2 credentials');
    console.log('2. Get a refresh token using the OAuth playground');
    console.log('3. Update config.json with these values\n');
    
    console.log('OAuth2 Playground: https://developers.google.com/oauthplayground');
    console.log('- Use your Client ID and Secret');
    console.log('- Authorize Gmail API scope: https://mail.google.com/');
    console.log('- Exchange authorization code for tokens\n');
    
  } else {
    console.log('\nLet\'s try other options...\n');
  }
  rl.close();
});
