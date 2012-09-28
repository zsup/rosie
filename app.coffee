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
	@set 'port', process.env.PORT || 80
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
# MONGODB AND MONGOOSE CONFIGURATION
###

mongoose = require 'mongoose'
db = mongoose.createConnection 'mongodb://rosey:jetson@alex.mongohq.com:10092/Spark-History'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

actionSchema = new Schema
	deviceid: String
	time: Date
	action: String
	param: String
	devicestatus: Boolean
	dimval: Number

Action = db.model('Action', actionSchema)


###
# OBJECT DEFINITIONS
###

# Let's define our core object: the Device.
class Device
	constructor: (@deviceid, @devicestatus = 0, @socket) ->
		@devicetype = "Device"

	commands: [
		"turnOn"
		"turnOff"
		"toggle"
		"schedule"
	]

	do: (action, params) ->
		if @commands.indexOf(action) is -1
			throw "#{action} is not a valid command"
		else
			return_values = @[action](params)
			@emit 'update'
			@store action, params
			return_values

	# Stringify for sharing over JSON.
	stringify: ->
		JSON.stringify
			deviceid: @deviceid
			devicetype: @devicetype
			devicestatus: @devicestatus

	turnOn: ->
		clog "Telling #{@deviceid} to turn on"
		@message "turnOn"
		@devicestatus = 1

	turnOff: ->
		clog "Telling #{@deviceid} to turn off"
		@message "turnOff"
		@devicestatus = 0

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
		@socket.write "{#{@deviceid}:#{msg}}#{separator}"

	# Emit a message to the socket.IO sockets
	emit: (msg) ->
		if msg is 'add' or 'remove' or 'update'
			io.sockets.emit msg, @stringify
		else
			throw "Bad socket.IO message"

	# Add the action to the history
	store: (action, params) ->
		x = new Action
			deviceid: @deviceid
			time: new Date().toISOString()
			action: action
			params: params
			devicestatus: @devicestatus
		x.save()
		clog "Stored #{action} in database"


# Lights are just like any other device, except they are also dimmable.
# They have a special function, "pulse", that flashes the light.
class Light extends Device
	constructor: (@deviceid, @devicestatus = 0, @dimval = 255, @socket) ->
		@devicetype = "Light"

	commands: [
		"turnOn"
		"turnOff"
		"toggle"
		"schedule"
		"dim"
		"pulse"
		"fade"
	]

	# Stringify for sharing over JSON.
	stringify: ->
		JSON.stringify
			deviceid: @deviceid
			devicetype: @devicetype
			devicestatus: @devicestatus
			dimval: @dimval

	pulse: ->
		clog "Telling #{@deviceid} to pulse"
		@message "pulse"

	dim: (params) ->
		value = parseInt params[0]
		if 0 <= value <= 255
			clog "Sending dim #{value} to #{@deviceid}"
			@message "dim#{value}"
			@dimval = value
		else clog "ERROR: Bad dim value: #{value}"
			# TODO: Error message back to API user

	fade: (params) ->
		target = params[0]
		duration_seconds = params[1] ? 0.4
		if isNaN(target)
			throw "Fade target #{target} is not a number."
		max_target = 16
		if target < 0 or target > max_target
			throw "Fade target #{target} must be an integer between 0 and #{max_target}, inclusive."

		if isNaN(duration_seconds) or duration_seconds < 0 then duration_seconds = 0.4
		if duration_seconds > 655.35 then duration_seconds = 655.35

		device_target = Math.round(255.0 * target / max_target)
		device_duration = Math.round(duration_seconds * 100)

		clog "Telling #{@deviceid} to fade to #{target} over #{duration_seconds} seconds"
		@message "fade #{device_target} #{device_duration}"
		@dimval = device_target
		[target, device_duration / 100.0]

	# Add the action to the history
	store: (action) ->
		x = new Action
			deviceid: @deviceid
			time: new Date().toISOString()
			action: action
			devicestatus: @devicestatus
			dimval: @dimval
		x.save()
		clog "Stored #{action} in database"


##########################################
#	ROUTING FOR THE WEB APP.               #
##########################################

###
# FRONT-END FOR TESTING.
###
app.get '/', (req, res) ->
	res.render 'index.jade', { devices: devices }
		# TBD

###
# GETS.
###

# Routing for 'get status' HTTP requests
app.get '/device/:deviceid', (req, res) ->
	deviceid = req.params.deviceid
	device = devices[deviceid]

	if device?
		clog "Sending status of #{device.deviceid} to client"
		clog device.stringify()
		res.send 200, device.stringify()
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

app.put '/device/:deviceid/fade/:target/:duration_seconds', (req, res) ->
	device = devices[req.params.deviceid]
	if device?
		target = parseInt req.params.target, 10
		duration_seconds = parseFloat req.params.duration_seconds
		try
			[target, duration_seconds] = device.do('fade', [target, duration_seconds])
			res.send 200, "Message sent to #{device.deviceid} to fade to #{target} over #{duration_seconds} seconds"
		catch err
			res.send 400, "Not a valid request. #{err}"
	else
		res.send 404, "No device connected with ID #{req.params.deviceid}"

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
			device.do(action, [param])
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

app.get '/device/:deviceid/history', (req, res) ->
	deviceid = req.params.deviceid

	Action.find { deviceid: deviceid }, (err, actions) ->
		if err
			res.send 404, "Database error."
		else if actions.length is 0
			res.send 404, "No history for that device. Doesn't exist... yet."
		else
			response = {}
			response.deviceid = deviceid
			for action in actions
				do (action) ->
					response[action._id] = {
						time: action.time
						action: action.action
						devicestatus: action.devicestatus
						dimval: action.dimval
					}
			res.send 200, response


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
				device.emit 'remove'
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

	currentdevice = devices[msgobj.deviceid]

	if not currentdevice?
		# well formed input - add device to list of devices
		deviceid = msgobj.deviceid
		devicetype = msgobj.devicetype ? "Light"
		devicestatus = msgobj.devicestatus ? 0
		dimval = msgobj.dimval ? 255

		if devicetype is "Light"
			devices[deviceid] = new Light(deviceid, devicestatus, dimval, socket)
		else
			devices[deviceid] = new Device(deviceid, devicestatus, socket)
		devices[deviceid].emit 'add'
		clog "Added: #{deviceid}"
	else
		if msgobj.devicestatus? then currentdevice.devicestatus = msgobj.devicestatus
		if msgobj.dimval? then currentdevice.dimval = msgobj.dimval
		if socket isnt currentdevice.socket then currentdevice.socket = socket
		currentdevice.emit 'update'
		clog "Updated: #{msgobj.deviceid}"



############################################################################################
#	SOCKET.IO communications                                                                 #
#                                                                                          #
# Perfect for telling developers/apps when a device's status has changed.                  #
# Also gives the developer a list of devices when they connect. Good for testing.          #
# May be implemented in a different way in the future (PubSub?) but this works for now.    #
#                                                                                          #
# Emit function deprecated. Using an emit method in the device instead.                    #
############################################################################################

# When a socket connects, give it a list of devices by adding them in sequence.
io.sockets.on 'connection', (iosocket) ->
	clog "Got new socket"
	for deviceid, device of devices
		clog "Add device #{device.deviceid}"
		device.emit 'add'

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
