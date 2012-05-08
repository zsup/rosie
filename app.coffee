
###
	Basic requirements and initialization
###


# Require libraries
net = require 'net'
http = require 'http'

# A JavaScript object helper to store devices
devices = {}

# Helpers for processing TCP stream.
buffer = ""
separator = "\n"

# Some helper functions.
ts = ->
	# TODO: CoffeeScript-ize this
	d = new Date().toTimeString()
	index = d.indexOf " GMT"
	d = d.slice(0,index)

clog = (msg) ->
	console.log "#{ts()}: #{msg}"

# Let's define our core object: the Device.
class Device
	constructor: (@deviceid, @devicetype, @socket, @devicestatus = "Off", @flashstatus = "NotFlashing", @dimval = 255) ->
	
	turnOn: ->
		clog "Telling #{@deviceid} to turn on"
		@devicestatus = "On"
		@socket.write "#{@deviceid},turnOn\n"
		updateStatus this
	
	turnOff: ->
		clog "Telling #{@deviceid} to turn off"
		@devicestatus = "Off"
		@socket.write "#{@deviceid},turnOff\n"
		updateStatus this
	
	toggle: ->
		if @devicestatus is "On"
			@turnOff()
		else
			@turnOn()
	
	flash: ->
		if @flashstatus is "Flashing"
			clog "Deactivating flash for #{@deviceid}"
			clearInterval @flashID
			delete @flashID
			@flashstatus = "NotFlashing"
			updateFlashStatus this
		else
			clog "Activating flash for #{@deviceid}"
			# first toggle once
			@toggle()
		
			# then set flash timer
			# TODO: Make this call the toggle() function instead of the external flashToggle function
			@flashID = setInterval flashToggle, 750, this
			@flashstatus = "Flashing"
			updateFlashStatus this
	
	# TODO: Should be put in a separate "dimmable device" class that extends Device
	dim: (value) ->
		value = parseInt value
		if 0 <= value <= 256
			if value is 0 then value = 1
			if value is 256 then value = 255
			clog "sending dim #{value} to #{@deviceid}"
			@socket.write "#{@deviceid},dim#{value}\n"
			@dimval = value
			updateDimStatus this
		else clog "Bad dim val: #{value}"
		

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
	
###
	Routing for the web-app
###

loadDevices = (req, res, next) ->
	if devices?
		req.devices = devices
		next()

# Load the core site
app.get '/', loadDevices, (req, res) ->
	res.render 'index',
		title: "SWITCH"
		devices: devices

# Routing for 'get status' HTTP requests
app.get '/device/:deviceid', (req, res) ->
	device = devices[req.params.deviceid]
	if device?
		clog "Sending status of #{device.deviceid} to client"
		res.json
			deviceid: device.deviceid
			devicetype: device.devicetype
			devicestatus: device.devicestatus
	else
		clog "Request for status of #{req.params.deviceid} received; device not found"
		res.send "No device at that address", 404

# Routing for 'command' http requests (API)
app.get '/device/:deviceid/:dothis/:param?', (req, res) ->
	deviceid = req.params.deviceid
	dothis = req.params.dothis
	if req.params.param?
		param = req.params.param
		clog "HTTP request received for device #{deviceid} to #{dothis} to #{param}"
	else
		param = ""
		clog "HTTP request received for device #{deviceid} to #{dothis}"
	
	# If the device is connected, send it a message
	device = devices[deviceid]
	if device? and dothis?
		try
			device[dothis](param)
			res.send "Message sent to #{deviceid}."
		catch err
			res.send "Not a valid request."
			clog "Not a valid request."
	else res.send "No device connected with ID #{deviceid}"

# TODO: Refactor the following set of functions into one "emit" function
flashToggle = (device) ->
	device.toggle()
	clog "(Due to flashing)"

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

removeDevice = (device) ->
	io.sockets.emit 'removedevice',
		deviceid: device.deviceid


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

	socket.on 'close', ->
		for id, device of devices
			if device.socket is socket
				removeDevice device
				delete devices[id]
				clog "Device #{id} disconnected"
		clog 'TCP client disconnected'
	
	# Receive and parse incoming data
	socket.on 'data', (chunk) ->
		buffer += chunk
		clog "Message received: #{chunk}" 
		# TODO: CoffeeScript-ize this section
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
	
	if not currentdevice?
		# TODO: This will cause an error if the same device connects through multiple sockets. Fix it.
		devices[deviceid] = new Device(deviceid, devicetype, socket, devicestatus)
		addDevice devices[deviceid]
		clog "Added: #{deviceid}"
	else
		if devicetype? then currentdevice.devicetype = devicetype
		if devicestatus? then currentdevice.devicestatus = devicestatus
		if socket isnt currentdevice.socket then currentdevice.socket = socket
		updateDevice
			deviceid: deviceid
			devicetype: devicetype
			devicestatus: devicestatus
		clog "Updated: #{deviceid}"

io.sockets.on 'connection', (iosocket) ->
	clog "Got new socket"
	# TODO: Now that this is working, take this out from the page template
	for id, device of devices
		device = devices[id]
		clog "Emitting about #{device.deviceid}"
		iosocket.emit 'statuschange',
			deviceid: device.deviceid
			devicestatus: device.devicestatus
		iosocket.emit 'dimstatuschange',
			deviceid: device.deviceid,
			dimval: device.dimval
			
	iosocket.on 'disconnect', ->
    	clog "Socket disconnected"