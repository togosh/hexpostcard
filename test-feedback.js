#!/usr/bin/env node

/**
 * Quick test for the feedback system functionality
 */

const axios = require('axios');

async function testFeedbackSystem() {
    console.log('🧪 Testing HEXpostcards Feedback System...\n');
    
    // Test data
    const testFeedback = {
        name: 'Test User',
        email: 'test@example.com',
        subject: 'Feature Request',
        message: 'This is a test message to verify the feedback system is working correctly.',
        source: 'Direct Test'
    };
    
    try {
        console.log('📡 Sending test feedback...');
        
        // Assuming server is running on localhost:8080 or 3000
        const ports = [8080, 3000, 80];
        let response = null;
        let workingPort = null;
        
        for (const port of ports) {
            try {
                const url = `http://localhost:${port}/api/contact`;
                console.log(`   Trying port ${port}...`);
                
                response = await axios.post(url, testFeedback, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                });
                
                workingPort = port;
                break;
                
            } catch (error) {
                if (error.code === 'ECONNREFUSED') {
                    console.log(`   Port ${port} not available`);
                } else {
                    console.log(`   Port ${port} error:`, error.message);
                }
            }
        }
        
        if (!response) {
            console.log('❌ Could not connect to server. Make sure it\'s running with:');
            console.log('   npm start');
            console.log('\nOr check which port your server is using.');
            return;
        }
        
        console.log(`✅ Connected to server on port ${workingPort}`);
        console.log('📧 Response:', response.data.message);
        console.log('\n✅ Feedback system is working!');
        console.log('\nNext steps:');
        console.log('1. Set up your Gmail credentials: node setup-email.js');
        console.log('2. Test email functionality: node setup-email.js test');
        console.log('3. Visit http://localhost:' + workingPort + '/contact to try the form');
        
    } catch (error) {
        if (error.response) {
            console.log('❌ Server responded with error:', error.response.status);
            console.log('   Message:', error.response.data?.error || error.response.data);
            
            if (error.response.status === 500) {
                console.log('\n🔧 This might be an email configuration issue.');
                console.log('   Run: node setup-email.js');
            }
        } else {
            console.log('❌ Network error:', error.message);
            console.log('\n💡 Make sure your server is running:');
            console.log('   npm start');
        }
    }
}

// Run test if called directly
if (require.main === module) {
    testFeedbackSystem();
}

module.exports = { testFeedbackSystem };
