
/**
 * Basic requirements and initialization
 */


// Require libraries
var net = require('net');
var http = require('http');

// Store TCP connections. Will need to find a better way to do this (in a database)
var sockets = {};


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

// Routes

app.get('/', routes.index);

// Routing for http requests
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

app.listen(80);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);


/**
 * TCP Server for devices.
 */


// Create the TCP server to communicate with the Arduino.
var server = net.createServer(function(socket) {
	console.log('TCP client connected');
	socket.setEncoding('ascii');
	socket.setKeepAlive(true);

	socket.on('end', function() {
		// delete sockets[socket.remoteAddress];
		console.log('TCP client disconnected');
	});
	// Receive data
	socket.on('data', function(data) {
		console.log(data);
		sockets[data] = socket;
	});
	socket.write('hello\r\n');
});

// Fire up the TCP server bound to port 1307
server.listen(1307, function() {
	console.log('TCP server bound to port 1307');
});