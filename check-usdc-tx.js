const https = require('https');
const config = require('./config.json');

async function checkSpecificTransaction() {
  console.log('Checking the specific 98,040 USDC transaction...');
  console.log('Transaction hash: 0xa6593df65c586e4ec68aaae26e3e82a13e040635a03e0616c623715e6e5a70c8');
  console.log('');
  
  // Check transaction details
  const txHash = '0xa6593df65c586e4ec68aaae26e3e82a13e040635a03e0616c623715e6e5a70c8';
  const url = `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${config.etherscan.apikey}`;
  
  try {
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    
    console.log('Transaction details:');
    console.log('Result:', data.result);
    
    if (data.result) {
      console.log('From:', data.result.from);
      console.log('To:', data.result.to);
      console.log('Value:', data.result.value);
      console.log('Block Number:', parseInt(data.result.blockNumber, 16));
    }
    
    // Check all token transfers in block 14395789
    const tokenUrl = `https://api.etherscan.io/api?module=account&action=tokentx&address=0x25D4CCeba035AabB7aC79C4F2fEaD5bC74E6B9d8&startblock=14395789&endblock=14395789&sort=desc&apikey=${config.etherscan.apikey}`;
    
    console.log('\nChecking token transfers for block 14395789...');
    const tokenData = await new Promise((resolve, reject) => {
      https.get(tokenUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    
    console.log('Token transfer result status:', tokenData.status);
    console.log('Token transfers found:', tokenData.result ? tokenData.result.length : 0);
    
    if (tokenData.result && tokenData.result.length > 0) {
      console.log('\nAll token transfers in this block:');
      tokenData.result.forEach((tx, i) => {
        const amount = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal));
        console.log(`${i+1}. ${tx.hash} | ${amount.toLocaleString()} ${tx.tokenSymbol} | From: ${tx.from} | To: ${tx.to}`);
        
        if (tx.hash === txHash) {
          console.log('*** THIS IS THE 98,040 USDC TRANSACTION! ***');
          console.log('Contract Address:', tx.contractAddress);
          console.log('Token Symbol:', tx.tokenSymbol);
          console.log('Token Name:', tx.tokenName);
          console.log('Token Decimals:', tx.tokenDecimal);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSpecificTransaction();
