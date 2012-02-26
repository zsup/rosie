// Require libraries
var net = require('net');
var http = require('http');

// Store TCP connections. Will need to find a better way to do this (in a database)
var sockets = {};

// Create the http server to communicate with apps using Express.
var app = require('express').createServer();

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

app.listen(3000);

// Create the TCP server to communicate with the Arduino.
var server = net.createServer(function(socket) {
	console.log('TCP client connected');
	socket.setEncoding('ascii');
	socket.setKeepAlive(true);
	socket.on('end', function() {
		// delete sockets[socket.remoteAddress];
		console.log('TCP client disconnected');
	});
	// Receive device ID and store device in the sockets map
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