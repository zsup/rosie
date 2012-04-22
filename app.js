
/**
 * Basic requirements and initialization
 */


// Require libraries
var net = require('net');
var http = require('http');

// Store TCP connections in an array.
var sockets = {};
var intervals = {};

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

var app = module.exports = express.createServer(),
	io = require('socket.io').listen(app);

// Configuration
io.set('log level', 1); 
io.set('reconnect', false); 

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

function ts() {
	d = new Date().toTimeString()
	index = d.indexOf(" GMT")
	d = d.slice(0,index) + ": "
	return d
}

function clog(msg) {
	console.log(ts()+msg)
};

// Routing for the web-app

function loadDeviceInfo(req, res, next) {
  req.devices = devices;
  next();
}

app.get('/', loadDeviceInfo, routes.index);


// Routing for http requests (API)
app.get('/device/:id/:dothis', function(req, res){
	var id = req.params.id;
	var dothis = req.params.dothis;
	clog('HTTP request received for device ' + id + ' to ' + dothis);
	// If this device is connected, send it a message
	if (devices[id]) {
		switch(dothis) {
			case "turnOn":
				clog('sending turnOn to '+id)
				devices[id].socket.write('turnOn\n');
				break;
			case "turnOff":
				clog('sending turnOff to '+id)
				devices[id].socket.write('turnOff\n');
				break;
			case "toggle":
				if(devices[id].devicestatus=="On") {
					clog('sending turnOff to '+id)
					devices[id].socket.write('turnOff\n');
					devices[id].devicestatus="Off";
				}
				else {
					clog('sending turnOn to '+id)
					devices[id].devicestatus="On";
					devices[id].socket.write('turnOn\n');
				};
				updateStatus(devices[id]);
				break;
			case "flash":
				// first toggle once
				if(devices[id].devicestatus=="On") {
					clog('sending turnOff to '+id)
					devices[id].socket.write('turnOff\n');
					devices[id].devicestatus="Off";
				}
				else {
					clog('sending turnOn to '+id)
					devices[id].devicestatus="On";
					devices[id].socket.write('turnOn\n');
				};
				updateStatus(devices[id]);
				

				//then set flash timer
				intervalID = setInterval(flashToggle, 750, id)
				devices[id].flashstatus = "Flashing";
				devices[id].flashID = intervalID;
				updateFlashStatus(devices[id]);
				break;
			case "stopflash":
				clearInterval(devices[id].flashID)
				delete devices[id].flashID;
				devices[id].flashstatus = "NotFlashing";
				updateFlashStatus(devices[id]);
				break;
			default:
				break;
		}
		res.send('Message sent.');
	} else {
		res.send('No device connected with that ID.');
	}
});


function flashToggle(id) {
	if(devices[id].devicestatus=="On") {
		clog('sending turnOff to '+id+'(due to flashing)')
		devices[id].socket.write('turnOff\n');
		devices[id].devicestatus="Off";
	}
	else {
		clog('sending turnOn to '+id+'(due to flashing)')
		devices[id].devicestatus="On";
		devices[id].socket.write('turnOn\n');
	};
	updateStatus(devices[id]);
}

function updateFlashStatus(device) {
	clients.map(function(client) {
			client.emit('flashstatuschange', {
				devicename: device.devicename,
				flashstatus: device.flashstatus
			});
	});
};

function updateStatus(device) {
	clients.map(function(client) {
			client.emit('statuschange', {
				devicename: device.devicename,
				devicestatus: device.devicestatus
			});
	});
};

function addDevice(device) {
	clients.map(function(client) {
			client.emit('adddevice', {
				devicename: device.devicename,
				devicestatus: device.devicestatus,
				flashstatus: device.flashstatus
			});
	});
};

function removeDevice(device) {
	clients.map(function(client) {
			client.emit('removedevice', {devicename: device.devicename});
	});
};




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
	clog('TCP client connected');
	socket.setEncoding('ascii');
	socket.setKeepAlive(true);

	socket.devices = [];

	socket.on('close', function() {
		devicename = socket.devices.pop()
		
		while(devicename) {
			clog("hereeeeee")
			deleteDevice(devicename);
			devicename = socket.devices.pop()
		}
		clog('TCP client disconnected');
	});
	
	// Receive and parse incoming data
	socket.on('data', function(chunk) {
		buffer += chunk;
		clog("Message received: " + chunk);
		var separatorIndex = buffer.indexOf(separator);
		var foundMessage = separatorIndex != -1;
		
		while(separatorIndex != -1) {
			var message = buffer.slice(0, separatorIndex);
			//clog("Found message: " + message);
			process(message, socket);
			buffer = buffer.slice(separatorIndex + 1);
			separatorIndex = buffer.indexOf(separator);
		};
	});
});

// Fire up the TCP server bound to port 1307
server.listen(1307, function() {
	clog('TCP server bound to port 1307');
});

devices = {};

deleteDevice = function(devicename) {
	clog("deleting" + devicename)
	removeDevice(devices[devicename]);
	delete devices[devicename];
};

// Process messages
process = function (message, socket) {
	message = message.trim();
	clog("Processing message: " + message);
	//sockets[message] = socket;

	var msgobj = JSON.parse(message);

	devicename = msgobj.devicename
	devicestatus = msgobj.devicestatus
	flashstatus = "NotFlashing"

	devices[devicename] = {
		devicename: devicename,
		devicestatus: devicestatus,
		flashstatus: flashstatus,
		socket: socket,
	};

	socket.devices.push(devicename);

	addDevice({
		devicename: devicename,
		devicestatus: devicestatus,
		flashstatus: flashstatus
	});


	// if we get a status
	//devicename = devices.findkey(socket=socket) // returns "Elroy"
	//devicename.status = status
}

clients = [];

io.sockets.on('connection', function (iosocket) {
	clients.push(iosocket);
	for (var id in devices) {
		device = devices[id];
		clog("emitting to " + device.devicename);
		iosocket.emit('statuschange', {
				devicename: device.devicename,
				devicestatus: device.devicestatus
		});
	};
	iosocket.on('disconnect', function () {
    	clients.splice(clients.indexOf(iosocket), 1)
  	});
});

