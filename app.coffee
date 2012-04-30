
###
	Basic requirements and initialization
###


# Require libraries
net = require 'net'
http = require 'http'

# Store a couple of JavaScript object helpers
sockets = {}
intervals = {}
devices = {}

# Helpers for processing TCP stream.
buffer = ""
separator = "\n"


###
	Express Web Server.
###


express = require 'express'
routes = require './routes'
app = module.exports = express.createServer()
io = require('socket.io').listen(app)

# Configuration
io.set 'log level', 1
io.set 'reconnect', false

app.configure ->
	@set 'views', "#{__dirname}/views"
	@set 'view engine', 'jade'
	@use express.bodyParser()
	@use express.methodOverride()
	@use express.cookieParser()
	@use express.session
		secret: 'your secret here'
	@use app.router
	@use express.static "#{__dirname}/public" 

app.configure 'development', ->
	@use express.errorHandler
		dumpExceptions: true
		showStack: true

app.configure 'production', ->
	@use express.errorHandler()

ts = ->
	d = new Date().toTimeString()
	index = d.indexOf " GMT"
	d = d.slice(0,index)

clog = (msg) ->
	console.log "#{ts()}: #{msg}"
	
###
	Routing for the web-app
###

loadDevices = (req, res, next) ->
	if devices?
		req.devices = devices
		next()
	else
		next(new Error('No devices yet'))

# Load the core site
app.get '/', loadDevices, (req, res) ->
	res.render 'index',
		title: "SWITCH"
		devices: devices

# Routing for http requests (API)
app.get '/device/:deviceid/:dothis/:param?', (req, res) ->
	deviceid = req.params.deviceid
	dothis = req.params.dothis
	if req.params.param?
		param = req.params.param
		clog "HTTP request received for device #{deviceid} to #{dothis} to #{param}"
	else
		clog "HTTP request received for device #{deviceid} to #{dothis}"
	
	# If the device is connected, send it a message
	device = devices[deviceid]
	if device?
		switch dothis
			when "turnOn"
				clog "sending turnOn to #{deviceid}"
				device.socket.write "#{deviceid},turnOn\n"
				updateStatus device
			when "turnOff"
				clog "sending turnOff to #{deviceid}"
				device.socket.write "#{deviceid},turnOff\n"
				updateStatus device
			when "toggle"
				if device.devicestatus is "On"
					clog "sending turnOff to #{deviceid}"
					device.socket.write "#{deviceid},turnOff\n"
					device.devicestatus = "Off"
				else
					clog "sending turnOn to #{deviceid}"
					device.socket.write "#{deviceid},turnOn\n"
					device.devicestatus = "On"
				updateStatus device
			when "flash"
				if device.flashstatus is "Flashing"
					clog "Not sending flash command - already flashing"
					break
				else
					# first toggle once
					if device.devicestatus is "On"
						clog "sending turnOff to #{deviceid}"
						device.socket.write "#{deviceid},turnOff\n"
						device.devicestatus = "Off"
					else
						clog "sending turnOn to #{deviceid}"
						device.socket.write "#{deviceid},turnOn\n"
						device.devicestatus = "On"
					updateStatus device
				
					# then set flash timer
					intervalID = setInterval flashToggle, 750, device
					device.flashstatus = "Flashing"
					device.flashID = intervalID
					updateFlashStatus device
					break
			when "stopflash"
				clearInterval device.flashID
				delete device.flashID
				device.flashstatus = "NotFlashing"
				updateFlashStatus device
			when "dim"
				if not param?
					clog "Must send parameters to dim"
					break
				dimval = parseInt param
				if 0 <= dimval <= 256
					if dimval is 0 then dimval = 1
					if dimval is 256 then dimval = 255
					clog "sending dim #{dimval} to #{deviceid}"
					device.socket.write "#{deviceid},dim#{dimval}\n"
					device.dimval = dimval
					updateDimStatus device
				else clog "Bad dim val: #{param}"
			else
				clog "#{dothis} is not a valid function."
		res.send "Message sent."
	else res.send "No device connected with ID #{deviceid}"

flashToggle = (device) ->
	if device.devicestatus is "On"
		clog "Sending turnOff to #{device.deviceid} (due to flashing)"
		device.socket.write "#{device.deviceid},turnOff\n"
		device.devicestatus = "Off"
	else
		clog "Sending turnOn to #{device.deviceid} (due to flashing)"
		device.socket.write "#{device.deviceid},turnOn\n"
		device.devicestatus = "On"
	updateStatus device


updateFlashStatus = (device) ->
	io.sockets.emit 'flashstatuschange',
		deviceid: device.deviceid
		flashstatus: device.flashstatus

updateStatus = (device) ->
	io.sockets.emit 'statuschange',
		deviceid: device.deviceid
		devicestatus: device.devicestatus

updateDimStatus = (device) ->
	io.sockets.emit 'dimstatuschange',
		deviceid: device.deviceid
		dimval: device.dimval

addDevice = (device) ->
	io.sockets.emit 'adddevice',
		deviceid: device.deviceid
		devicetype: device.devicetype
		devicestatus: device.devicestatus
		flashstatus: device.flashstatus
		dimval: device.dimval

updateDevice = (device) ->
	io.sockets.emit 'updatedevice',
		deviceid: device.deviceid
		devicetype: device.devicetype
		devicestatus: device.devicestatus
		flashstatus: device.flashstatus
		dimval: device.dimval
		socket: device.socket

removeDevice = (device) ->
	io.sockets.emit 'removedevice',
		deviceid: device.deviceid

deleteDevice = (device) ->
	clog "Deleting #{device}"
	removeDevice devices[device]
	delete devices[device]


# Routing for a few redirects
app.get '/demo', (req, res) ->
	res.redirect 'http://www.youtube.com/watch?v=fLkIoJ3BXEw'

app.get '/founders', (req, res) ->
	res.redirect 'http://www.youtube.com/watch?v=71ucyxj1wbk'

app.listen 80, ->
	clog "Express server listening on port #{app.address().port} in #{app.settings.env} mode"

###
	TCP Server for devices.
###


# Create the TCP server to communicate with the Arduino.
server = net.createServer (socket) ->
	clog 'TCP client connected'
	socket.setEncoding 'ascii'
	socket.setKeepAlive true

	socket.devices = [];

	# TODO: Rewrite this so it searches for all devices with the socket 'socket' and deletes them.
	# Then, get rid of all of the references to socket.devices[].
	socket.on 'close', ->
		device = socket.devices.pop()
		
		if device?
			deleteDevice(device);
			device = socket.devices.pop()
		clog 'TCP client disconnected'
	
	# Receive and parse incoming data
	socket.on 'data', (chunk) ->
		buffer += chunk
		clog "Message received: #{chunk}" 
		separatorIndex = buffer.indexOf separator
		foundMessage = separatorIndex != -1
		
		while separatorIndex != -1
			message = buffer.slice 0, separatorIndex
			# clog("Found message: " + message);
			process message, socket
			buffer = buffer.slice(separatorIndex + 1)
			separatorIndex = buffer.indexOf separator

# Fire up the TCP server bound to port 1307
server.listen 1307, ->
	clog 'TCP server bound to port 1307'

# Process messages
process = (message, socket) ->
	message = message.trim()
	clog "Processing message: #{message}"
	failure = false
	
	try
		msgobj = JSON.parse message
	catch SyntaxError
		failure = true
		clog "Failed to process - bad syntax"
		return

	enoughinfo = msgobj.hasOwnProperty 'deviceid'
	
	if not enoughinfo
		clog "Not enough info"
		return

	# well formed input - add device to list of devices
	deviceid = msgobj.deviceid
	if msgobj.devicestatus is 1
		devicestatus = "On"
	else
		devicestatus = "Off"
	
	devicetype = msgobj.devicetype
	
	currentdevice = devices[deviceid]
	
	if not currentdevice
		flashstatus = "NotFlashing"
		dimval = 255
		addDevice
			deviceid: deviceid
			devicetype: devicetype
			devicestatus: devicestatus
			flashstatus: flashstatus
			dimval: dimval
		clog "Added: #{deviceid}"
		# TODO: This will cause an error if the same device connects through multiple sockets. Fix it.
		socket.devices.push deviceid
		devices[deviceid] =
			deviceid: deviceid
			devicetype: devicetype
			devicestatus: devicestatus
			flashstatus: flashstatus
			dimval: dimval
			socket: socket
	else
		if not devicetype
			devicetype = currentdevice[devicetype]
		flashstatus = currentdevice[flashstatus]
		dimval = currentdevice[dimval]
		updateDevice
			deviceid: deviceid
			devicetype: devicetype
			devicestatus: devicestatus
		devices[deviceid] = 
			deviceid: deviceid
			devicetype: devicetype
			devicestatus: devicestatus
			flashstatus: flashstatus
			dimval: dimval
			socket: socket
		clog "Updated: #{deviceid}"

io.sockets.on 'connection', (iosocket) ->
	clog "Got new socket"
	for id in devices
		device = devices[id]
		clog "Emitting to #{device.deviceid}"
		iosocket.emit 'statuschange',
			deviceid: device.deviceid
			devicestatus: device.devicestatus
		iosocket.emit 'dimstatuschange',
			deviceid: device.deviceid,
			dimval: device.dimval
			
	iosocket.on 'disconnect', ->
    	clog "Socket disconnected"