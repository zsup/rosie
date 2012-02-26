// Require libraries
var net = require('net');
var http = require('http');

// Store TCP connections. Will need to find a better way to do this (in a database)
var sockets = {};

// Create the http server to communicate with apps using Express.
var app = require('express').createServer();

// Routing for the root
app.get('/', function(req, res){
	console.log('HTTP request received');
	// If a device is connected, send it a message
	if (sockets[0]) {
		sockets[0].write('HIGH\r\n');
		res.send('Message sent.');
	} else {
		res.send('No devices connected.');
	}
});

app.listen(80);

// Create the TCP server to communicate with the Arduino.
var server = net.createServer(function(socket) {
	console.log('Client connected');
	// Add socket to the map to keep track of it
	sockets[0] = socket;
	socket.on('end', function() {
		delete sockets[socket.remoteAddress];
		console.log('Client disconnected');
	});
	socket.write('hello\r\n');
	socket.pipe(socket);
});

// Fire up the TCP server bound to port 1307
server.listen(1307, function() {
	console.log('TCP server bound to port 1307');
});