const mongoose = require('mongoose');

// Disable mongoose buffering globally for better error handling
mongoose.set('bufferCommands', false);

var CONFIG = require('./config.json');
var DEBUG = CONFIG.debug;
console.log(DEBUG);

// Helper for logging
const log = (message) => {
    console.log(`${new Date().toISOString()} [MainServer] --- ${message}`);
}

const http = require('http');
require('es6-promise').polyfill();

// --- START: MEMORY MONITORING AND CRASH PREVENTION ---
// Updated for 1GB server: Leave ~300MB for system, use ~700MB max for Node.js
const MEMORY_LIMIT_MB = 600; // Reduced from 800MB to 600MB for 1GB server
const MEMORY_CHECK_INTERVAL = 20000; // Check every 20 seconds (more frequent)
const MEMORY_CRITICAL_MB = 500; // Critical threshold at 500MB
const MEMORY_WARNING_MB = 400; // Warning threshold at 400MB

let lastMemoryWarning = 0;
let highMemoryCount = 0;

function logMemoryUsage() {
    const used = process.memoryUsage();
    const memoryMB = Math.round(used.rss / 1024 / 1024);
    const heapMB = Math.round(used.heapUsed / 1024 / 1024);
    
    console.log(`[MEMORY] RSS: ${memoryMB}MB, Heap: ${heapMB}MB, External: ${Math.round(used.external / 1024 / 1024)}MB`);
    
    if (memoryMB > MEMORY_WARNING_MB) {
        console.log(`[MEMORY WARNING] Memory usage: ${memoryMB}MB (Warning threshold: ${MEMORY_WARNING_MB}MB)`);
    }
    
    if (memoryMB > MEMORY_CRITICAL_MB) {
        highMemoryCount++;
        const now = Date.now();
        
        if (now - lastMemoryWarning > 60000) { // Only warn once per minute
            console.error(`[MEMORY CRITICAL] Memory usage ${memoryMB}MB exceeds critical limit ${MEMORY_CRITICAL_MB}MB! Count: ${highMemoryCount}`);
            lastMemoryWarning = now;
            
            // Force garbage collection if available
            if (global.gc) {
                console.log('[MEMORY] Forcing garbage collection...');
                global.gc();
                const afterGC = process.memoryUsage();
                const afterMB = Math.round(afterGC.rss / 1024 / 1024);
                console.log(`[MEMORY] After GC: ${afterMB}MB (freed ${memoryMB - afterMB}MB)`);
            }
        }
        
        // If memory stays high for too long, we may need to restart
        if (highMemoryCount > 10) {
            console.error('[MEMORY CRITICAL] Memory has been high for too long. Consider restarting.');
        }
    } else {
        highMemoryCount = Math.max(0, highMemoryCount - 1); // Gradually reduce count
    }
    
    if (memoryMB > MEMORY_LIMIT_MB) {
        console.error(`[MEMORY WARNING] Memory usage ${memoryMB}MB exceeds limit ${MEMORY_LIMIT_MB}MB!`);
    }
    
    return memoryMB;
}

// Monitor memory usage
setInterval(logMemoryUsage, MEMORY_CHECK_INTERVAL);

// Handle uncaught exceptions and promise rejections
process.on('uncaughtException', (error) => {
    console.error('[CRASH PREVENTION] Uncaught Exception:', error);
    logMemoryUsage();
    // Don't exit immediately, log for debugging
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRASH PREVENTION] Unhandled Rejection at:', promise, 'reason:', reason);
    logMemoryUsage();
});

// Log memory on exit signals
process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] SIGTERM received');
    logMemoryUsage();
});

process.on('SIGINT', () => {
    console.log('[SHUTDOWN] SIGINT received');
    logMemoryUsage();
});
// --- END: MEMORY MONITORING AND CRASH PREVENTION ---
 
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto'); // Added for hashing
const schedule = require('node-schedule'); // For scheduling leaderboard updates
const nodemailer = require('nodemailer'); // For sending emails
const rateLimit = require('express-rate-limit'); // For rate limiting

// --- START: LEADERBOARD SERVICE INTEGRATION ---
const leaderboardService = require('./leaderboard.js'); // Import the leaderboard service
// --- END: LEADERBOARD SERVICE INTEGRATION ---

// Mongoose Schema for Votes
var Schema = mongoose.Schema;

// Using a schema similar to VoteContest03 from the old file,
// but designId is now a String to match designs.json
var VoteSchema = new Schema({
  ip: { type: String, required: true },
  votes: [{ designId: String, rank: Number }], // designId is now String
  createdAt: { type: Date, default: Date.now }
}, {
  collection: "votecontest03" // Explicitly specify the collection name HERE
});

// Using 'DesignVotes' as the collection name for the new system
var DesignVote = mongoose.model('VoteContest03', VoteSchema);

// MongoDB Connection
var mongoDB = CONFIG.mongodb.connectionString;
mongoose.connect(mongoDB, {
    maxPoolSize: 10, // Increase connection pool for better performance
    serverSelectionTimeoutMS: 10000, // Increase timeout
    socketTimeoutMS: 60000, // Increase socket timeout
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
    heartbeatFrequencyMS: 10000, // Check connection health every 10 seconds
    connectTimeoutMS: 10000, // Add connection timeout
    family: 4 // Use IPv4, skip trying IPv6
}).then(async () => {
    log("Mongo Connected!");
    logMemoryUsage();
    
    // Initialize the leaderboard service (loads price caches, sets up its schedules)
    try {
        await leaderboardService.initializeLeaderboardService();
        log("Leaderboard service initialized successfully");
    } catch (error) {
        log("Error initializing leaderboard service: " + error.message);
        console.error(error);
    }
    
    // Initial data grab for leaderboard on startup with timeout
    try {
        await Promise.race([
            grabAndEmitLeaderboardData(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
        ]);
    } catch (error) {
        log("Error or timeout during initial leaderboard data grab: " + error.message);
    }
}).catch(err => {
    log("Mongo Connection Error: " + err);
});

// Global variable for leaderboard data, to be populated by the service
var leaderboardData = undefined;

const salt = CONFIG.salt; // Salt for IP hashing

const { JSDOM } = require( "jsdom" );
const { window } = new JSDOM( "" );
const $ = require( "jquery" )( window );

var hostname = CONFIG.hostname;
if (DEBUG){ hostname = '127.0.0.1'; }

var httpPort = 80; 
if (DEBUG){ httpPort = 3000; }
const httpsPort = 443;

var httpsOptions = undefined;
if(!DEBUG){ 
  httpsOptions = {
    cert: fs.readFileSync(CONFIG.https.cert),
    key: fs.readFileSync(CONFIG.https.key)
  };
  if(CONFIG.https.ca !== undefined && CONFIG.https.ca != ""){
    httpsOptions.ca = fs.readFileSync(CONFIG.https.ca)
  }
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const host = req.headers.host.split(':')[0];
  if (!host.startsWith('www.') && 
      !host.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/) && 
      host !== 'localhost' && 
      !DEBUG) {
      return res.redirect(301, `http://www.${host}${req.url}`);
  }
  next();
});

app.use(function(req, res, next) {
    next();
});

const httpServer = http.createServer(app);
var httpsServer = undefined;
if(!DEBUG){ httpsServer = https.createServer(httpsOptions, app);}

if(!DEBUG){
  app.use((req, res, next) => {
    if(req.protocol === 'http') {
      const fullUrl = 'https://' + req.hostname + req.originalUrl;
      return res.redirect(307, fullUrl);
    }
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public')));


app.get("/",                     function(req, res){ res.sendFile('/index.html',                 {root: __dirname}); });

app.get(["/donate", "/donation", "/sacrifice", "/sac"], 
                                function(req, res){ res.redirect('/#donate'); });

app.get("/design",               function(req, res){ res.sendFile('/public/designs.html',          {root: __dirname}); });
app.get("/designs",              function(req, res){ res.sendFile('/public/designs.html',          {root: __dirname}); });
app.get("/contest",              function(req, res){ res.sendFile('/public/designs.html',          {root: __dirname}); });

app.get("/action",               function(req, res){ res.sendFile('/public/action.html',       {root: __dirname}); });
app.get("/takeaction",      function(req, res){ res.sendFile('/public/action.html',       {root: __dirname}); });
app.get("/advertise",      function(req, res){ res.sendFile('/public/action.html',       {root: __dirname}); });
app.get("/list",                 function(req, res){ res.sendFile('/public/action.html',       {root: __dirname}); });

app.get(["/tutorial", "/instructions", "/guide"], 
                                function(req, res) {
                                            res.set('X-Robots-Tag', 'noindex, nofollow');
                                            res.sendFile('/public/tutorial.html',     {root: __dirname});});

app.get("/faq",                  function(req, res){ res.sendFile('/public/faq.html',              {root: __dirname}); });
app.get(["/contact", "/feedback"], function(req, res){ res.sendFile('/public/contact.html',         {root: __dirname}); });

app.get(["/team", "/about"], 
                                function(req, res) {
                                            res.sendFile('/public/team.html',         {root: __dirname}); });

app.get("/disclaimer",      function(req, res){ res.sendFile('/public/disclaimer.html',     {root: __dirname}); });
app.get("/terms",                function(req, res){ res.sendFile('/public/terms.html',            {root: __dirname}); });
app.get("/gallery",              function(req, res){ res.sendFile('/public/gallery.html',          {root: __dirname}); });
app.get("/community",      function(req, res){ res.sendFile('/public/gallery.html',          {root: __dirname}); });
app.get("/pictures",             function(req, res){ res.sendFile('/public/gallery.html',          {root: __dirname}); });

app.get(["/why", "/whymail", "/whydirectmail"], 
                                 function(req, res) {
                                              res.sendFile('/public/whydirectmail.html', {root: __dirname}); });

// --- START: LEADERBOARD ROUTES ---
app.get("/leaderboard", function(req, res){ res.sendFile('/public/leaderboard.html', {root: __dirname}); });

// NEW: Leaderboard API endpoint (uses the service)
app.get("/api/leaderboard", async (req, res) => {
  if (leaderboardData) { // leaderboardData is the global var updated by grabAndEmitLeaderboardData
    res.json(leaderboardData);
  } else {
    log("Leaderboard data not ready for API call, attempting to fetch now.");
    const freshData = await leaderboardService.getLeaderboardData(); // Call the service
    if (freshData && Array.isArray(freshData) && freshData.length > 0) { // Check it's not placeholder
        leaderboardData = freshData;
        res.json(leaderboardData);
    } else {
        res.status(503).json({ message: "Leaderboard data is currently being generated. Please try again shortly." });
    }
  }
});
// --- END: LEADERBOARD ROUTES ---

// NEW: Transaction details API endpoint for a specific address
app.get("/api/transactions/:address", async (req, res) => {
  try {
    const address = req.params.address;
    
    // Get all donations for this address, sorted by timestamp (newest first)
    const { Donation } = require('./leaderboard.js');
    const transactions = await Donation.find({ 
      from: { $regex: new RegExp(`^${address}$`, 'i') } // Case insensitive match
    }).sort({ timestamp: -1 }); // Sort by timestamp descending (newest first)
    
    // Format the transactions for display
    const formattedTransactions = transactions.map(tx => ({
      txHash: tx.txHash,
      currency: tx.currency,
      chain: tx.chain,
      value: tx.currency === 'ETH' || tx.currency === 'PLS' ? 
        (parseFloat(tx.value) / Math.pow(10, 18)).toFixed(6) : 
        (parseFloat(tx.value) / Math.pow(10, tx.currency === 'DAI' ? 18 : 6)).toFixed(2),
      usdValue: tx.usdValue.toFixed(2),
      timestamp: tx.timestamp,
      date: new Date(tx.timestamp * 1000).toLocaleString(),
      blockNumber: tx.blockNumber,
      priceAtTime: tx.priceAtTime
    }));
    
    res.json(formattedTransactions);
  } catch (error) {
    console.error(`Error fetching transactions for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Failed to fetch transaction details' });
  }
});

// VOTING FUNCTIONALITY
function hashIp(ipAddress) {
  //console.log("ipAddress: ", ipAddress); // Debugging line
  if (!ipAddress) return null; // Handle undefined ipAddress
  const saltedIp = salt + ipAddress;
  //console.log("Salted IP: ", saltedIp); // Debugging line
  const hash = crypto.createHash('sha256').update(saltedIp).digest('hex');
  //console.log("Hashed IP: ", hash); // Debugging lineq
  return hash;
}

app.post('/submit-vote', async (req, res) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const remoteAddress = req.connection.remoteAddress;
  let clientIp = req.ip;

  if (forwardedFor) {
    clientIp = forwardedFor.split(',')[0].trim();
  } else if (remoteAddress) {
    clientIp = remoteAddress;
  }
  
  const hashedIp = hashIp(clientIp);

  if (!hashedIp) {
    return res.status(400).json({ message: 'Could not determine IP address.' });
  }

  const votes = req.body.votes;

  if (!Array.isArray(votes) || votes.length === 0 || votes.length > 5) {
    return res.status(400).json({ message: 'Invalid vote format. You must rank between 1 and 5 designs.' });
  }

  const receivedIds = new Set();
  for (const vote of votes) {
    if (typeof vote.designId !== 'string' || vote.designId.trim() === '') {
      return res.status(400).json({ message: 'Invalid designId in vote.' });
    }
    if (receivedIds.has(vote.designId)) {
      return res.status(400).json({ message: 'Duplicate designId detected in your vote.' });
    }
    receivedIds.add(vote.designId);
  }

  try {
    const existingVote = await DesignVote.findOne({ ip: hashedIp });
    if (existingVote) {
      return res.status(403).json({ message: 'You have already voted.' });
    }

    // Ensure ranks are assigned correctly based on the order in the array
    const transformedVotes = votes.map((vote, index) => ({
      designId: vote.designId,
      rank: index + 1 
    }));

    await DesignVote.create({ ip: hashedIp, votes: transformedVotes });
    res.status(200).json({ message: 'Vote successfully recorded.' });
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ message: 'Error submitting vote. Please try again later.' });
  }
});

app.get('/best-designs', async (req, res) => {
  try {
    const bestDesigns = await calculateBestDesigns();
    res.json(bestDesigns);
  } catch (error) {
    console.error('Error fetching best designs:', error);
    res.status(500).json({ message: 'Error fetching best designs' });
  }
});

async function calculateBestDesigns() {
  const allVotes = await DesignVote.find();
  const scores = {};

  allVotes.forEach(voteDoc => {
    voteDoc.votes.forEach(({ designId, rank }) => {
      if (!scores[designId]) scores[designId] = 0;
      // Points: Rank 1 = 5 points, Rank 2 = 4 points, ..., Rank 5 = 1 point
      scores[designId] += (6 - rank); 
    });
  });

  const sortedScores = Object.keys(scores).map(designId => ({
    designId: designId, // Keep as string
    score: scores[designId]
  })).sort((a, b) => b.score - a.score);

  return sortedScores;
}
// END VOTING FUNCTIONALITY

// --- START: EMAIL CONTACT FORM FUNCTIONALITY ---
// Configure nodemailer transporter
const emailTransporter = nodemailer.createTransport({
  service: CONFIG.email.service,
  auth: {
    user: CONFIG.email.auth.user,
    pass: CONFIG.email.auth.pass
  }
});

// Verify email configuration on startup
emailTransporter.verify((error, success) => {
  if (error) {
    console.log('[EMAIL] Configuration error:', error);
  } else {
    console.log('[EMAIL] Server is ready to send emails');
  }
});

// Rate limiter for contact form (max 3 submissions per hour per IP)
const contactRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 requests per windowMs
  message: {
    error: 'Too many feedback submissions. Please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Contact form endpoint
app.post('/api/contact', contactRateLimit, async (req, res) => {try {
    console.log('[EMAIL] Received contact form submission:', req.body);
    
    const { name, email, subject, message, source, website } = req.body;
    
    // Honeypot check - if this field is filled, it's likely a bot
    if (website && website.trim() !== '') {
      console.log('[EMAIL] Honeypot triggered - likely bot submission blocked');
      return res.status(400).json({ 
        error: 'Invalid form submission.' 
      });
    }
    
    // Basic validation
    if (!name || !email || !message) {
      console.log('[EMAIL] Validation failed - missing required fields');
      return res.status(400).json({ 
        error: 'Please fill in all required fields (name, email, and message).' 
      });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[EMAIL] Validation failed - invalid email format');
      return res.status(400).json({ 
        error: 'Please enter a valid email address.' 
      });    }
    
    console.log('[EMAIL] Validation passed, proceeding with email setup...');
    
    // Create email content
    const emailSubject = subject || 'General Feedback';
    const emailContent = `
New feedback received from HEXpostcards website:

Name: ${name}
Email: ${email}
Subject: ${emailSubject}
Time: ${new Date().toISOString()}

Message:
${message}

---
This message was sent from the HEXpostcards feedback form.
    `.trim();
    
    // Email options
    const mailOptions = {
      from: CONFIG.email.auth.user,
      to: CONFIG.email.to,
      subject: `HEXpostcards Feedback: ${emailSubject}`,
      text: emailContent,
      replyTo: email
    };
      // Send email
    console.log('[EMAIL] Attempting to send email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      replyTo: mailOptions.replyTo
    });
    
    await emailTransporter.sendMail(mailOptions);
    
    console.log(`[EMAIL] Feedback sent successfully from ${email} (${name}) - Subject: ${emailSubject}`);
    
    res.status(200).json({ 
      message: 'Thank you for your feedback! We\'ll get back to you soon.' 
    });
    
  } catch (error) {
    console.error('[EMAIL] Error sending feedback email:', error);
    console.error('[EMAIL] Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    res.status(500).json({ 
      error: 'Sorry, there was an error sending your message. Please try again later.' 
    });
  }
});
// --- END: EMAIL CONTACT FORM FUNCTIONALITY ---

// --- START: LEADERBOARD DATA GRABBING AND SOCKET.IO ---
async function grabAndEmitLeaderboardData() {
    const startTime = Date.now();
    log("grabAndEmitLeaderboardData triggered...");
    logMemoryUsage();
    
    try {
        // Add timeout to prevent hanging
        const freshLeaderboardData = await Promise.race([
            leaderboardService.getLeaderboardData(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Leaderboard data fetch timeout')), 60000)
            )
        ]);
        
        if (freshLeaderboardData && Array.isArray(freshLeaderboardData)) {
            leaderboardData = freshLeaderboardData; // Update global cache
            if (io) { // Check if io is initialized
                io.emit("leaderboardData", leaderboardData);
                log(`Leaderboard data updated and emitted via Socket.io. ${leaderboardData.length} entries. Took ${Date.now() - startTime}ms`);
            } else {
                log("Socket.io not initialized, cannot emit leaderboard data.");
            }
            logMemoryUsage();
        } else {
            log("Failed to fetch fresh leaderboard data from service.");
        }
    } catch (error) {
        log("Error in grabAndEmitLeaderboardData: " + error.message);
        console.error(error);
        logMemoryUsage();
        
        // Force garbage collection on error
        if (global.gc) {
            global.gc();
        }
    }
}

// Schedule for grabbing leaderboard data (every 20 minutes instead of 15) with error handling
let scheduleJob = schedule.scheduleJob("*/20 * * * *", async () => {
    try {
        const memoryMB = logMemoryUsage();
        if (memoryMB < MEMORY_CRITICAL_MB) { // Only run if memory is not critical
            await grabAndEmitLeaderboardData();
        } else {
            log(`Skipping scheduled leaderboard update due to high memory usage: ${memoryMB}MB`);
        }
    } catch (error) {
        log("Scheduled leaderboard update failed: " + error.message);
        console.error(error);
        logMemoryUsage();
    }
});

// Log scheduled job creation
log("Scheduled leaderboard updates every 20 minutes");

// Add graceful shutdown handling
process.on('SIGTERM', async () => {
    console.log('[SHUTDOWN] SIGTERM received, starting graceful shutdown...');
    if (scheduleJob) {
        scheduleJob.cancel();
        console.log('[SHUTDOWN] Cancelled scheduled jobs');
    }
    
    try {
        await mongoose.connection.close();
        console.log('[SHUTDOWN] MongoDB connection closed');
    } catch (error) {
        console.error('[SHUTDOWN] Error closing MongoDB:', error);
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[SHUTDOWN] SIGINT received, starting graceful shutdown...');
    if (scheduleJob) {
        scheduleJob.cancel();
        console.log('[SHUTDOWN] Cancelled scheduled jobs');
    }
    
    try {
        await mongoose.connection.close();
        console.log('[SHUTDOWN] MongoDB connection closed');
    } catch (error) {
        console.error('[SHUTDOWN] Error closing MongoDB:', error);
    }
    
    process.exit(0);
});
// --- END: LEADERBOARD DATA GRABBING AND SOCKET.IO ---

httpServer.listen(httpPort, hostname, () => { log(`Server running at http://${hostname}:${httpPort}/`);});
if(!DEBUG){ httpsServer.listen(httpsPort, hostname, () => { 
    log('listening on *:' + httpsPort); 
  });
}

// Socket.io Setup
var io = undefined;
if(DEBUG){ 
  io = require('socket.io')(httpServer);
} else { 
  if (httpsServer) {
    io = require('socket.io')(httpsServer, {secure: true});
  } else {
    log("ERROR: HTTPS server not initialized for Socket.io in non-debug mode.");
  }
}

if (io) {
    io.on('connection', (socket) => {
        log('SOCKET -- Client connected: ' + socket.id);
        logMemoryUsage();
        
        if (leaderboardData) {
            socket.emit("leaderboardData", leaderboardData);
        }
        
        socket.on('disconnect', () => {
            log('SOCKET -- Client disconnected: ' + socket.id);
        });
        
        // Add error handling for socket errors
        socket.on('error', (error) => {
            log('SOCKET -- Error for client ' + socket.id + ': ' + error.message);
        });
    });
    
    // Handle io errors
    io.on('error', (error) => {
        log('SOCKET.IO -- Server error: ' + error.message);
        console.error(error);
    });
} else {
    log("Socket.io server could not be initialized.");
}