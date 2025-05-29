#!/usr/bin/env node

/**
 * Memory monitoring and diagnostics script
 * Run this alongside your main server to monitor memory usage patterns
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const LOG_FILE = path.join(__dirname, 'memory-monitor.log');
const CHECK_INTERVAL = 10000; // 10 seconds
const ALERT_THRESHOLD_MB = 400; // Alert if memory goes above 400MB (1GB server)

let alertCount = 0;
let maxMemory = 0;
let memoryHistory = [];

console.log('🔍 Starting memory monitor...');
console.log(`📝 Logging to: ${LOG_FILE}`);
console.log(`⚠️  Alert threshold: ${ALERT_THRESHOLD_MB}MB`);

function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} ${message}\n`;
    
    try {
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (error) {
        console.error('Failed to write to log file:', error.message);
    }
}

function getProcessMemory() {
    try {
        // Find Node.js processes related to hexpostcard
        let ps;
        if (process.platform === 'win32') {
            // Windows: Use tasklist to find node processes
            ps = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', { encoding: 'utf8' });
        } else {
            // Unix/Linux: Use ps command
            ps = execSync('ps aux | grep "node.*index.js\\|node.*hexpostcard" | grep -v grep', { encoding: 'utf8' });
        }
        
        let totalMemory = 0;
        let processCount = 0;
        
        if (process.platform === 'win32') {
            // Parse Windows tasklist output
            const lines = ps.trim().split('\n');
            for (let i = 1; i < lines.length; i++) { // Skip header
                const line = lines[i];
                if (line.includes('node.exe')) {
                    const csvMatch = line.match(/"([^"]*)".*"([^"]*)".*"([^"]*)".*"([^"]*)".*"([^"]*)"/);
                    if (csvMatch) {
                        const memString = csvMatch[5].replace(',', '').replace(' K', '');
                        const memMB = parseFloat(memString) / 1024; // Convert KB to MB
                        totalMemory += memMB;
                        processCount++;
                        console.log(`Node process: ${memMB.toFixed(1)}MB`);
                    }
                }
            }
        } else {
            // Parse Unix ps output
            const lines = ps.trim().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const parts = line.trim().split(/\s+/);
                    const memPercent = parseFloat(parts[3]);
                    const memMB = parseFloat(parts[5]) / 1024; // Convert KB to MB
                    
                    totalMemory += memMB;
                    processCount++;
                    
                    console.log(`Process ${parts[1]}: ${memMB.toFixed(1)}MB (${memPercent}%)`);
                }
            });
        }
        
        return { totalMemory, processCount };
    } catch (error) {
        // Fallback if process command fails
        return null;
    }
}

function checkMemory() {
    const memInfo = getProcessMemory();
    
    if (!memInfo) {
        console.log('❌ Could not get process memory info');
        return;
    }
    
    const { totalMemory, processCount } = memInfo;
    const memoryMB = Math.round(totalMemory);
    
    // Track history
    memoryHistory.push({
        timestamp: Date.now(),
        memory: memoryMB
    });
    
    // Keep only last 100 readings
    if (memoryHistory.length > 100) {
        memoryHistory.shift();
    }
    
    // Update max memory
    if (memoryMB > maxMemory) {
        maxMemory = memoryMB;
    }
    
    // Calculate trend
    let trend = '';
    if (memoryHistory.length >= 5) {
        const recent = memoryHistory.slice(-5);
        const first = recent[0].memory;
        const last = recent[recent.length - 1].memory;
        const change = last - first;
        
        if (change > 20) {
            trend = '📈 RISING';
        } else if (change < -20) {
            trend = '📉 FALLING';
        } else {
            trend = '➡️  STABLE';
        }
    }
    
    const status = memoryMB > ALERT_THRESHOLD_MB ? '🚨 HIGH' : '✅ OK';
    const message = `Memory: ${memoryMB}MB (Max: ${maxMemory}MB) | Processes: ${processCount} | ${trend} | ${status}`;
    
    console.log(message);
    logToFile(message);
    
    // Alert handling
    if (memoryMB > ALERT_THRESHOLD_MB) {
        alertCount++;
        if (alertCount % 6 === 1) { // Alert every minute when high
            const alertMsg = `🚨 HIGH MEMORY ALERT: ${memoryMB}MB (Threshold: ${ALERT_THRESHOLD_MB}MB)`;
            console.log(alertMsg);
            logToFile(`ALERT: ${alertMsg}`);
            
            // Suggest garbage collection if available
            logToFile('SUGGESTION: Consider forcing garbage collection or restarting server');
        }
    } else {
        alertCount = 0;
    }
}

// Initial check
checkMemory();

// Start monitoring
setInterval(checkMemory, CHECK_INTERVAL);

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Memory monitor stopping...');
    logToFile('Memory monitor stopped');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Memory monitor stopping...');
    logToFile('Memory monitor stopped');
    process.exit(0);
});

console.log('✅ Memory monitor started. Press Ctrl+C to stop.');
