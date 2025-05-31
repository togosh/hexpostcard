const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.log('\n=== Contact Form Protection Setup ===\n');

console.log('I\'ve already added basic protection:\n');
console.log('✅ Honeypot field (invisible to users, catches basic bots)');
console.log('✅ Rate limiting (max 3 submissions per hour per IP)\n');

console.log('Would you like to add additional protection?\n');

const options = {
  '1': 'Simple Math Captcha (e.g., "What is 5 + 3?")',
  '2': 'Google reCAPTCHA v3 (invisible, scores users)',
  '3': 'hCaptcha (privacy-focused alternative to reCAPTCHA)',
  '4': 'Cloudflare Turnstile (newest, privacy-focused)',
  '5': 'Just use current protection (honeypot + rate limiting)'
};

console.log('Choose additional protection:');
Object.entries(options).forEach(([key, option]) => {
  console.log(`${key}. ${option}`);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\nEnter your choice (1-5): ', (choice) => {
  switch(choice) {
    case '1':
      console.log('\n📝 Simple Math Captcha Setup:');
      console.log('This adds a simple question like "What is 5 + 3?" to the form.');
      console.log('- User-friendly');
      console.log('- Stops most bots');
      console.log('- No external dependencies');
      console.log('\nI can implement this for you. Would you like me to add it?');
      break;
      
    case '2':
      console.log('\n🤖 Google reCAPTCHA v3 Setup:');
      console.log('1. Go to: https://www.google.com/recaptcha/admin/create');
      console.log('2. Choose reCAPTCHA v3');
      console.log('3. Add your domain: localhost (for testing)');
      console.log('4. Get Site Key and Secret Key');
      console.log('5. Add keys to config.json');
      break;
      
    case '3':
      console.log('\n🔒 hCaptcha Setup:');
      console.log('1. Go to: https://www.hcaptcha.com/');
      console.log('2. Sign up and create a site');
      console.log('3. Add your domain');
      console.log('4. Get Site Key and Secret Key');
      console.log('5. Add keys to config.json');
      break;
      
    case '4':
      console.log('\n☁️ Cloudflare Turnstile Setup:');
      console.log('1. Go to: https://developers.cloudflare.com/turnstile/');
      console.log('2. Get Turnstile keys');
      console.log('3. Add to your site');
      console.log('4. Very new but privacy-focused');
      break;
      
    case '5':
      console.log('\n✅ Current Protection Summary:');
      console.log('Your form now has:');
      console.log('- Honeypot field (catches basic bots)');
      console.log('- Rate limiting (3 submissions/hour per IP)');
      console.log('- Form validation');
      console.log('- No IP logging (privacy-friendly)');
      console.log('\nThis should handle 90%+ of spam attempts!');
      break;
      
    default:
      console.log('\n❌ Invalid choice. Current protection is already active.');
  }
  
  rl.close();
});
