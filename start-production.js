#!/usr/bin/env node

/**
 * Production startup script with enhanced memory management
 * This script starts the server with garbage collection enabled and additional monitoring
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting HEXpostcard server in production mode...');
console.log('📊 Memory monitoring and garbage collection enabled');

// Start the main process with garbage collection flags
const server = spawn('node', [
    '--expose-gc',                    // Enable manual garbage collection
    '--max-old-space-size=512',      // Limit heap to 512MB for 1GB server
    '--max-semi-space-size=64',      // Limit semi-space to 64MB
    '--optimize-for-size',           // Optimize for memory usage
    path.join(__dirname, 'index.js')
], {
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_ENV: 'production'
    }
});

// Handle server process events
server.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});

server.on('exit', (code, signal) => {
    if (signal === 'SIGKILL') {
        console.error('💀 Server was killed (SIGKILL) - likely due to OOM');
        console.error('🔧 Consider reducing memory usage or increasing server resources');
    } else {
        console.log(`📈 Server exited with code ${code} and signal ${signal}`);
    }
    
    // Auto-restart on crash (but not on intentional shutdown)
    if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {
        console.log('🔄 Restarting server in 5 seconds...');
        setTimeout(() => {
            console.log('🚀 Restarting server...');
            spawn(process.argv[0], process.argv.slice(1), {
                stdio: 'inherit',
                detached: true
            }).unref();
        }, 5000);
    }
});

// Handle shutdown signals
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.kill('SIGTERM');
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    server.kill('SIGINT');
});

// Log memory usage periodically
setInterval(() => {
    const used = process.memoryUsage();
    console.log(`[SUPERVISOR] Memory - RSS: ${Math.round(used.rss / 1024 / 1024)}MB, Heap: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
}, 60000); // Every minute

console.log('✅ Production server supervisor started');
console.log('📝 Monitor logs for memory usage and performance metrics');
