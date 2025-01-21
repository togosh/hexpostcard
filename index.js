var CONFIG = require('./config.json');
var DEBUG = CONFIG.debug;
console.log(DEBUG);

const http = require('http');
require('es6-promise').polyfill();
 
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

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
  // Get host without port number
  const host = req.headers.host.split(':')[0];
  
  // Check if it's not www and not an IP address
  if (!host.startsWith('www.') && 
      !host.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/) && 
      host !== 'localhost' && 
      !DEBUG) {
      // Redirect to www version
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
      // Include the full URL path and query in the redirect
      const fullUrl = 'https://' + req.hostname + req.originalUrl;
      return res.redirect(307, fullUrl);
    }
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public')));

app.get("/", 			      function(req, res){ res.sendFile('/index.html', 			        {root: __dirname}); });
app.get("/faq", 		    function(req, res){ res.sendFile('/public/faq.html', 		      {root: __dirname}); });
app.get("/designs", 		function(req, res){ res.sendFile('/public/designs.html', 		  {root: __dirname}); });
app.get("/contest", 		function(req, res){ res.sendFile('/public/contest.html', 		  {root: __dirname}); });
app.get("/donate", 		  function(req, res){ res.sendFile('/public/index.html#donate', {root: __dirname}); });
app.get("/sacrifice", 	function(req, res){ res.sendFile('/public/donate.html', 	    {root: __dirname}); });
app.get("/sac", 		    function(req, res){ res.sendFile('/public/donate.html', 	    {root: __dirname}); });
app.get("/action", 	    function(req, res){ res.sendFile('/public/action.html',       {root: __dirname}); });
app.get("/takeaction", 	function(req, res){ res.sendFile('/public/action.html',       {root: __dirname}); });
app.get("/advertise", 	function(req, res){ res.sendFile('/public/action.html',       {root: __dirname}); });
app.get("/list", 		    function(req, res){ res.sendFile('/public/action.html',       {root: __dirname}); });
app.get("/team", 		    function(req, res){ res.sendFile('/public/team.html', 		    {root: __dirname}); });
app.get("/about", 		  function(req, res){ res.sendFile('/public/team.html', 		    {root: __dirname}); });
app.get("/guide", 		  function(req, res){ res.sendFile('/public/tutorial.html', 	  {root: __dirname}); });
app.get("/faq", 		    function(req, res){ res.sendFile('/public/faq.html', 		      {root: __dirname}); });
app.get("/disclaimer", 	function(req, res){ res.sendFile('/public/disclaimer.html', 	{root: __dirname}); });
app.get("/terms", 		  function(req, res){ res.sendFile('/public/terms.html', 		    {root: __dirname}); });

app.get(["/tutorial", "/instructions"], function(req, res) {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile('/public/tutorial.html', {root: __dirname});
});

httpServer.listen(httpPort, hostname, () => { log(`Server running at http://${hostname}:${httpPort}/`);});
if(!DEBUG){ httpsServer.listen(httpsPort, hostname, () => { 
    log('listening on *:' + httpsPort); 
  });
}

const log = (message) => {
    console.log(new Date().toISOString() + ", " + message);
}
