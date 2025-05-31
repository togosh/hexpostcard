const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.log('\n=== Alternative Email Services Setup ===\n');

console.log('If Gmail is too complicated, here are easier alternatives:\n');

const services = {
  '1': {
    name: 'Outlook/Hotmail',
    service: 'hotmail',
    port: 587,
    note: 'Just use your email and password - no app passwords needed usually'
  },
  '2': {
    name: 'Yahoo Mail',
    service: 'yahoo',
    port: 587,
    note: 'May need app password, but easier to find than Gmail'
  },
  '3': {
    name: 'Zoho Mail',
    service: 'zoho',
    port: 587,
    note: 'Business email service, straightforward setup'
  },
  '4': {
    name: 'SendGrid (Recommended)',
    service: 'custom',
    host: 'smtp.sendgrid.net',
    port: 587,
    note: 'Professional email service, free tier available, very reliable'
  }
};

console.log('Choose an alternative:');
Object.entries(services).forEach(([key, service]) => {
  console.log(`${key}. ${service.name}`);
  console.log(`   ${service.note}\n`);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Which service would you like to use? (1-4): ', (choice) => {
  const selected = services[choice];
  
  if (selected) {
    console.log(`\n✅ ${selected.name} Configuration:\n`);
    
    if (selected.name === 'SendGrid (Recommended)') {
      console.log('SendGrid Setup:');
      console.log('1. Go to: https://sendgrid.com/');
      console.log('2. Sign up for free account');
      console.log('3. Go to Settings > API Keys');
      console.log('4. Create API Key with "Mail Send" permission');
      console.log('5. Use the API key as your password\n');
      
      const config = {
        email: {
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: 'YOUR_SENDGRID_API_KEY'
          },
          to: 'your-email@gmail.com'
        }
      };
      console.log('Config:');
      console.log(JSON.stringify(config, null, 2));
      
    } else {
      const config = {
        email: {
          service: selected.service,
          auth: {
            user: `your-email@${selected.name.toLowerCase().split('/')[0]}.com`,
            pass: 'your-password'
          },
          to: 'destination@gmail.com'
        }
      };
      
      console.log('Config:');
      console.log(JSON.stringify(config, null, 2));
      console.log(`\nNote: ${selected.note}`);
    }
    
  } else {
    console.log('\n❌ Invalid choice. Please run the script again.');
  }
  
  rl.close();
});
