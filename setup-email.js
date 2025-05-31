#!/usr/bin/env node

/**
 * Email Setup Script for HEXpostcards Feedback System
 * 
 * This script helps you configure Gmail for sending feedback emails.
 * You'll need to:
 * 1. Enable 2-Factor Authentication on your Gmail account
 * 2. Generate an App Password specifically for this application
 * 3. Update the config.json with your credentials
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function setupEmail() {
  console.log('\n=== HEXpostcards Email Setup ===\n');
  
  console.log('This will help you configure Gmail for the feedback system.\n');
  
  console.log('BEFORE YOU START:');
  console.log('1. Go to your Google Account settings (myaccount.google.com)');
  console.log('2. Enable 2-Factor Authentication if not already enabled');
  console.log('3. Go to Security > 2-Step Verification > App passwords');
  console.log('4. Generate a new app password for "Mail" or "Other (custom name)"');
  console.log('5. Copy the 16-character app password (it will look like: abcd efgh ijkl mnop)');
  console.log('\nPress Enter when you\'re ready to continue...');
  
  await question('');
  
  const email = await question('Enter your Gmail address: ');
  
  if (!email.includes('@gmail.com')) {
    console.log('Warning: This is configured for Gmail. Other email providers may require different settings.');
  }
  
  console.log('\nEnter your App Password (16 characters, no spaces):');
  console.log('Example: abcdefghijklmnop');
  const appPassword = await question('App Password: ');
  
  if (appPassword.length !== 16) {
    console.log('Warning: App passwords are typically 16 characters long.');
  }
  
  const confirmEmail = await question(`\nSend feedback emails to the same address (${email})? (y/n): `);
  let toEmail = email;
  if (confirmEmail.toLowerCase() !== 'y') {
    toEmail = await question('Enter email address to receive feedback: ');
  }
  
  // Read current config
  const configPath = path.join(__dirname, 'config.json');
  let config;
  
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
  } catch (error) {
    console.log('Error reading config.json:', error.message);
    rl.close();
    return;
  }
  
  // Update email configuration
  config.email = {
    service: 'gmail',
    auth: {
      user: email,
      pass: appPassword
    },
    to: toEmail
  };
  
  // Write updated config
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('\n✅ Email configuration updated successfully!');
    console.log('\nYour config.json has been updated with:');
    console.log(`- From email: ${email}`);
    console.log(`- To email: ${toEmail}`);
    console.log('- Service: Gmail');
    console.log('\n📧 Feedback forms will now send emails to your Gmail account.');
    console.log('\nTo test the configuration, restart your server and submit a test feedback form.');
    
  } catch (error) {
    console.log('Error writing config.json:', error.message);
  }
  
  rl.close();
}

// Test email configuration
async function testEmail() {
  console.log('\n=== Email Configuration Test ===\n');
  
  const configPath = path.join(__dirname, 'config.json');
  let config;
  
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
  } catch (error) {
    console.log('Error reading config.json:', error.message);
    return;
  }
  
  if (!config.email || !config.email.auth || !config.email.auth.user || !config.email.auth.pass) {
    console.log('❌ Email not configured. Run: node setup-email.js');
    return;
  }
  
  console.log('Testing email configuration...');
  
  const nodemailer = require('nodemailer');
  
  const transporter = nodemailer.createTransport({
    service: config.email.service,
    auth: {
      user: config.email.auth.user,
      pass: config.email.auth.pass
    }
  });
  
  try {
    await transporter.verify();
    console.log('✅ Email configuration is valid!');
    
    const sendTest = await question('Send a test email? (y/n): ');
    if (sendTest.toLowerCase() === 'y') {
      const testMailOptions = {
        from: config.email.auth.user,
        to: config.email.to,
        subject: 'HEXpostcards Feedback System Test',
        text: `This is a test email from your HEXpostcards feedback system.

Configuration:
- From: ${config.email.auth.user}
- To: ${config.email.to}
- Time: ${new Date().toISOString()}

If you received this email, your feedback system is working correctly!`
      };
      
      await transporter.sendMail(testMailOptions);
      console.log('✅ Test email sent successfully!');
      console.log(`Check your inbox at ${config.email.to}`);
    }
    
  } catch (error) {
    console.log('❌ Email configuration error:', error.message);
    if (error.message.includes('Invalid login')) {
      console.log('\nThis usually means:');
      console.log('1. Wrong email address or app password');
      console.log('2. 2-Factor Authentication not enabled');
      console.log('3. App password not generated or expired');
      console.log('\nRun "node setup-email.js" to reconfigure.');
    }
  }
  
  rl.close();
}

// Main execution
const args = process.argv.slice(2);
if (args.includes('test')) {
  testEmail();
} else {
  setupEmail();
}
