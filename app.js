
/**
 * Basic requirements and initialization
 */


// Require libraries
var net = require('net');
var http = require('http');

// Store TCP connections in an array.
var sockets = {};

// Helpers for processing TCP stream.
var buffer = "";
var separator = "\n";
var process;
var server;


/**
 * Express Web Server.
 */


var express = require('express')
  , routes = require('./routes')

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'your secret here' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routing for the web-app

app.get('/', routes.index);

// Routing for http requests (API)
app.get('/device/:id/:dothis', function(req, res){
	var id = req.params.id;
	var dothis = req.params.dothis;
	console.log('HTTP request received for device ' + id + ' to ' + dothis);
	// If this device is connected, send it a message
	if (sockets[id]) {
		sockets[id].write(dothis + '\r\n');
		res.send('Message sent.');
	} else {
		res.send('No device connected with that ID.');
	}
});

// Routing for a few redirects
app.get('/demo', function(req, res){
	res.redirect('http://www.youtube.com/watch?v=fLkIoJ3BXEw');
});

app.get('/founders', function(req, res){
	res.redirect('http://www.youtube.com/watch?v=71ucyxj1wbk');
});

app.listen(80);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);


/**
 * TCP Server for devices.
 */


// Create the TCP server to communicate with the Arduino.
server = net.createServer(function(socket) {
	console.log('TCP client connected');
	socket.setEncoding('ascii');
	socket.setKeepAlive(true);

	socket.on('end', function() {
		// delete sockets[socket.remoteAddress];
		console.log('TCP client disconnected');
	});
	
	// Receive and parse incoming data
	socket.on('data', function(chunk) {
		buffer += chunk;
		console.log("Message received: " + chunk + " End of message.");
		
		var separatorIndex = buffer.indexOf(separator);
		var foundMessage = separatorIndex != -1;
		
		if (foundMessage) {
			var message = buffer.slice(0, separatorIndex);
			process(message, socket);
			buffer = buffer.slice(separatorIndex + 1);
		}
	});
	socket.write('hello\r\n');
});

// Fire up the TCP server bound to port 1307
server.listen(1307, function() {
	console.log('TCP server bound to port 1307');
});

// Process messages
process = function (message, socket) {
	message = message.trim();
	console.log("Processing message: " + message);
	sockets[message] = socket;
}