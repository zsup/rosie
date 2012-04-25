
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
app.get('/device/:deviceid/:dothis', function(req, res){
	var deviceid = req.params.deviceid;
	var dothis = req.params.dothis;
	clog('HTTP request received for device ' + deviceid + ' to ' + dothis);
	// If this device is connected, send it a message
	device = devices[deviceid]
	if (device) {
		switch(dothis) {
			case "turnOn":
				clog('sending turnOn to '+device.deviceid)
				device.socket.write(device.deviceid+',turnOn\n');
				break;
			case "turnOff":
				clog('sending turnOff to '+device.deviceid)
				device.socket.write(device.deviceid+',turnOff\n');
				break;
			case "toggle":
				if(device.devicestatus=="On") {
					clog('sending turnOff to '+device.deviceid)
					device.socket.write(device.deviceid+',turnOff\n');
					device.devicestatus="Off";
				}
				else {
					clog('sending turnOn to '+device.deviceid)
					device.devicestatus="On";
					device.socket.write(device.deviceid+',turnOn\n');
				};
				updateStatus(device);
				break;
			case "flash":
				if(device.flashstatus == "Flashing") {
					clog("not sending flash command - already flashing");
					break;
				}
				else {
					// first toggle once
					if(device.devicestatus=="On") {
						clog('sending turnOff to '+device.deviceid)
						device.socket.write(device.deviceid+',turnOff\n');
						device.devicestatus="Off";
					}
					else {
						clog('sending turnOn to '+device.deviceid)
						device.devicestatus="On";
						device.socket.write(device.deviceid+',turnOn\n');
					}
					updateStatus(device);
					
					//then set flash timer
					intervalID = setInterval(flashToggle, 750, device)
					device.flashstatus = "Flashing";
					device.flashID = intervalID;
					updateFlashStatus(device);
					break;
				}
			case "stopflash":
				clearInterval(device.flashID)
				delete device.flashID;
				device.flashstatus = "NotFlashing";
				updateFlashStatus(device);
				break;
			default:
				if (dothis.indexOf("dim") == 0) {
					//dimming
					dothis = dothis.slice(3)
					var dimval = parseInt(dothis)
					if(0<=dimval && dimval <=256) {
						if(dimval==0) {dimval=1}
						if(dimval==256) {dimval=255}
						clog('sending dim' + dimval + ' to '+device.deviceid)
						device.socket.write(device.deviceid+',dim'+dimval+'\n');
						device.dimval=dimval;
						updateDimStatus(device);
					}
					else {
						clog("bad dim val: " + dimval)
					}
				}
				break;
		}
		res.send('Message sent.');
	} else {
		res.send('No device connected with that ID.');
	}
});


function flashToggle(device) {
	if(device.devicestatus=="On") {
		clog('sending turnOff to '+device.deviceid+'(due to flashing)')
		device.socket.write(device.deviceid+',turnOff\n');
		device.devicestatus="Off";
	}
	else {
		clog('sending turnOn to '+device.deviceid+'(due to flashing)')
		device.devicestatus="On";
		device.socket.write(device.deviceid+',turnOn\n');
	};
	updateStatus(device);
}

function updateFlashStatus(device) {
	clients.map(function(client) {
			client.emit('flashstatuschange', {
				deviceid: device.deviceid,
				flashstatus: device.flashstatus
			});
	});
};

function updateStatus(device) {
	clients.map(function(client) {
			client.emit('statuschange', {
				deviceid: device.deviceid,
				devicestatus: device.devicestatus
			});
	});
};

function updateDimStatus(device) {
	clients.map(function(client) {
			client.emit('dimstatuschange', {
				deviceid: device.deviceid,
				dimval: device.dimval
			});
	});
};

function addDevice(device) {
	clients.map(function(client) {
			client.emit('adddevice', {
				deviceid: device.deviceid,
				devicetype: device.devicetype,
				devicestatus: device.devicestatus,
				flashstatus: device.flashstatus,
				dimval: device.dimval
			});
	});
};

function removeDevice(device) {
	clients.map(function(client) {
			client.emit('removedevice', {deviceid: device.deviceid});
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
		device = socket.devices.pop();
		
		while(device) {
			deleteDevice(device);
			device = socket.devices.pop();
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

deleteDevice = function(device) {
	clog("Deleting " + device)
	removeDevice(devices[device]);
	delete devices[device];
};

// Process messages
process = function (message, socket) {
	message = message.trim();
	clog("Processing message: " + message);
	//sockets[message] = socket;

	var failure = false;
	try {
		var msgobj = JSON.parse(message);
	}
	catch (SyntaxError) {
		failure = true;
		clog("failed to process - bad syntax");
		return;
	}

	enoughinfo = (
		msgobj.hasOwnProperty('deviceid')
	)
	if(!enoughinfo) {
		clog("not enough info");
		return;
	}

	// well formed input - add device to list of devices
	var deviceid = msgobj.deviceid;
	if(msgobj.devicestatus==1) {
		devicestatus = "On"
	}
	else {
		devicestatus = "Off"
	}
	var flashstatus = "NotFlashing";
	var devicetype = msgobj.devicetype;
	var dimval = 255;

	devices[deviceid] = {
		deviceid: deviceid,
		devicetype: devicetype,
		devicestatus: devicestatus,
		flashstatus: flashstatus,
		dimval: dimval,
		socket: socket,
	};

	socket.devices.push(deviceid);

	addDevice({
		deviceid: deviceid,
		devicetype: devicetype,
		devicestatus: devicestatus,
		flashstatus: flashstatus,
		dimval: dimval
	});
	clog("Added: " + deviceid)



	// if we get a status
	//devicename = devices.findkey(socket=socket) // returns "Elroy"
	//devicename.status = status
}

clients = [];

io.sockets.on('connection', function (iosocket) {
	clog("got new socket");
	clients.push(iosocket);
	for (var id in devices) {
		device = devices[id];
		clog("emitting to " + device.deviceid);
		iosocket.emit('statuschange', {
				deviceid: device.deviceid,
				devicestatus: device.devicestatus
		});
		iosocket.emit('dimstatuschange', {
				deviceid: device.deviceid,
				dimval: device.dimval
		});
	};
	iosocket.on('disconnect', function () {
    	clients.splice(clients.indexOf(iosocket), 1)
  	});
});

