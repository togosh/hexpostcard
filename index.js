var CONFIG = require('./config.json');
var DEBUG = CONFIG.debug;
console.log(DEBUG);

const http = require('http');
require('es6-promise').polyfill();
 
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto'); // Added for hashing
var mongoose = require('mongoose'); // Added for MongoDB

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
mongoose.connect(mongoDB).then(() => {
    log("Mongo Connected!");
}).catch(err => {
    log("Mongo Connection Error: " + err);
});

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

httpServer.listen(httpPort, hostname, () => { log(`Server running at http://${hostname}:${httpPort}/`);});
if(!DEBUG){ httpsServer.listen(httpsPort, hostname, () => { 
    log('listening on *:' + httpsPort); 
  });
}

const log = (message) => {
    console.log(new Date().toISOString() + ", " + message);
}