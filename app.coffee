##########################################
#	BASIC REQUIREMENTS AND INITIALIZATION. #
##########################################

# Require libraries
net = require 'net'
http = require 'http'

# A JavaScript object helper to store devices
devices = {}

# Helpers for processing TCP stream.
buffer = ""
separator = "\n"

# Ports
tcpport = 1307

# Some helper functions.
ts = ->
	d = new Date().toTimeString()
	index = d.indexOf " GMT"
	d = d.slice 0, index

clog = (msg) ->
	console.log "#{ts()}: #{msg}"


###
#	EXPRESS WEB SERVER AND SOCKET.IO CONFIGURATION
###

express = require 'express'
routes = require './routes'
path = require 'path'
app = express()
server = http.createServer app
io = require('socket.io').listen(server)

# Express configuration.

app.configure ->
	@set 'port', process.env.PORT || 3000
	@set 'views', "#{__dirname}/views"
	@set 'view engine', 'jade'
	@use express.favicon()
	@use express.bodyParser()
	@use express.methodOverride()
	@use app.router
	@use express.static path.join __dirname, 'public'

app.configure 'development', ->
	@use express.errorHandler

server.listen app.get('port'), ->
  clog "Express server listening on port " + app.get('port')

# Socket.IO configuration.
io.set 'log level', 1
io.set 'reconnect', false


###
# OBJECT DEFINITIONS
###

# Let's define our core object: the Device.
class Device
	constructor: (@deviceid, @socket, @devicestatus = 0) ->
		@devicetype = "Device"
	
	turnOn: ->
		clog "Telling #{@deviceid} to turn on"
		@devicestatus = 1
		@message("turnOn")
		updateStatus this
	
	turnOff: ->
		clog "Telling #{@deviceid} to turn off"
		@devicestatus = 0
		@message("turnOff")
		updateStatus this
	
	toggle: ->
		if @devicestatus is 1
			@turnOff()
		else
			@turnOn()

	# Schedule an action in the future.
	# TODO: Actually implement this
	schedule: (time) ->
		throw "Scheduling has not yet been implemented."
	
	# Send the requested message to the device
	message: (msg) ->
		# TODO: Expect a response, and add error-catching
		@socket.write "#{@deviceid},#{msg}#{separator}"

# Lights are just like any other device, except they are also dimmable.
# They have a special function, "pulse", that flashes the light.
class Light extends Device
	constructor: (@deviceid, @socket, @devicestatus = 0, @dimval = 255) ->
		@devicetype = "Light"

	pulse: ->
		clog "Telling #{@deviceid} to pulse"
		@message("pulse")
	
	dim: (value) ->
		value = parseInt value
		if 0 <= value <= 255
			clog "Sending dim #{value} to #{@deviceid}"
			@dimval = value
			@message("dim#{value}")
			updateStatus this
		else clog "ERROR: Bad dim value: #{value}"
			# TODO: Error message back to API user
	
##########################################
#	ROUTING FOR THE WEB APP.               #
##########################################

###
# GETS.
###

# Routing for 'get status' HTTP requests
app.get '/device/:deviceid', (req, res) ->
	deviceid = req.params.deviceid
	device = devices[deviceid]

	if device?
		clog "Sending status of #{device.deviceid} to client"
		res.json
			deviceid: device.deviceid
			devicetype: device.devicetype
			devicestatus: device.devicestatus
	else
		clog "ERR: Request for status of #{req.params.deviceid} received; device not found"
		res.send 404, "No device connected with ID #{deviceid}."

# Routing for seeing device logs.
app.get '/device/:deviceid/logs', (req, res) ->
	# TODO: Implement this feature
	res.send 404, "Sorry, this feature has not yet been implemented."


###
# COMMANDS.
###

# Routing for 'command' http requests (API)
app.put '/device/:deviceid/:action/:param?', (req, res) ->
	deviceid = req.params.deviceid
	action = req.params.action

	if req.params.param?
		param = req.params.param
		clog "HTTP request received for device #{deviceid} to #{action} to #{param}"
	else
		param = ""
		clog "HTTP request received for device #{deviceid} to #{action}"
	
	# If the device is connected, send it a message
	
	if devices[deviceid]?
		device = devices[deviceid]
		try
			device[action](param)
			res.send 200, "Message sent to #{deviceid} to #{action}."
		catch err
			res.send 460, "Not a valid request. #{err}"
			clog "Not a valid request."
	else
		res.send 404, "No device connected with ID #{deviceid}"


###
# SCHEDULING.
###

# Schedule a new action. Has not yet been implemented.
app.post '/device/:deviceid/schedule/:action/:time', (req, res) ->
	# TODO: Implement
	res.send 460, "Scheduling has not yet been implemented."

# Delete a scheduled action. You only need to know the timecode.
# Also you must be the one who scheduled an action in the first place to delete it.
app.delete '/device/:deviceid/schedule/:time', (req, res) ->
	# TODO: Implement
	res.send 460, "Scheduling has not yet been implemented."


###
# HISTORY.
###

app.get '/device/:deviceid/history/', (req, res) ->
	# TODO: Implement
	res.send 460, "History has not yet been implemented."

# TODO: Refactor the following set of functions into one "emit" function
flashToggle = (device) ->
	device.toggle()
	clog "(Due to flashing)"



##########################################
#	TCP SERVER FOR DEVICES.                #
##########################################

# Create the TCP server to communicate with the Arduino.
server = net.createServer (socket) ->
	clog 'TCP client connected'
	socket.setEncoding 'ascii'
	socket.setKeepAlive true

	socket.on 'close', ->
		for deviceid, device of devices
			if device.socket is socket
				removeDevice device
				delete devices[deviceid]
				clog "Device #{deviceid} disconnected"
		clog 'TCP client disconnected'
	
	# Receive and parse incoming data
	socket.on 'data', (chunk) ->
		buffer += chunk
		clog "Message received: #{chunk}"
		separatorIndex = buffer.indexOf separator
		foundMessage = separatorIndex != -1
		
		while separatorIndex != -1
			message = buffer.slice 0, separatorIndex
			processmsg message, socket
			buffer = buffer.slice(separatorIndex + 1)
			separatorIndex = buffer.indexOf separator

# Fire up the TCP server
server.listen tcpport, ->
	clog "TCP server bound to port #{tcpport}"

# Process messages.
#
# Note: this is only used for instantiation right now.
# In the future we'll have to break this up.
#
processmsg = (message, socket) ->
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
	devicetype = msgobj.devicetype ? "Light"
	devicestatus = msgobj.devicestatus ? 0
	dimval = msgobj.dimval ? 255
	
	currentdevice = devices[deviceid]
	
	if not currentdevice?
		# TODO: This will cause an error if the same device connects through multiple sockets. Fix it.
		if devicetype = "Light"
			devices[deviceid] = new Light(deviceid, devicetype, socket, devicestatus, dimval)
		else
			devices[deviceid] = new Device(deviceid, devicetype, socket, devicestatus)
		addDevice devices[deviceid]
		clog "Added: #{deviceid}"
	else
		if devicestatus? then currentdevice.devicestatus = devicestatus
		if dimval? then currentdevice.dimval = dimval
		if socket isnt currentdevice.socket then currentdevice.socket = socket
		updateDevice currentdevice
		clog "Updated: #{deviceid}"



############################################################################################
#	SOCKET.IO EMISSIONS                                                                      #
#                                                                                          #
# Perfect for telling developers/apps when a device's status has changed.                  #
# Also gives the developer a list of devices when they connect. Good for testing.          #
# May be implemented in a different way in the future (PubSub?) but this works for now.    #
############################################################################################

updateStatus = (device) ->
	if device.devicetype == "Light"
		io.sockets.emit 'statuschange',
			deviceid: device.deviceid
			devicestatus: device.devicestatus
			dimval: device.dimval
	else
		io.sockets.emit 'statuschange',
			deviceid: device.deviceid
			devicestatus: device.devicestatus

addDevice = (device) ->
	io.sockets.emit 'adddevice',
		deviceid: device.deviceid
		devicetype: device.devicetype
		devicestatus: device.devicestatus
		dimval: device.dimval

removeDevice = (device) ->
	io.sockets.emit 'removedevice',
		deviceid: device.deviceid

# When a socket connects, give it a list of devices by adding them in sequence.
io.sockets.on 'connection', (iosocket) ->
	clog "Got new socket"
	for deviceid, device of devices
		clog "Add device #{device.deviceid}"
		addDevice(device)
			
	iosocket.on 'disconnect', ->
    clog "Socket disconnected"


##########################################
#	OTHER JUNK.                            #
##########################################

# Routing for a few redirects

app.get '/demo', (req, res) ->
	res.redirect 'http://www.youtube.com/watch?v=IOncq-OM3_g'
	
app.get '/demo2', (req, res) ->
	res.redirect 'http://www.youtube.com/watch?v=8hsvGO4FHNo'

app.get '/demo3', (req, res) ->
	res.redirect 'http://www.youtube.com/watch?v=fLkIoJ3BXEw'

app.get '/founders', (req, res) ->
	res.redirect 'http://www.youtube.com/watch?v=71ucyxj1wbk'