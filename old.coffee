loadDevices = (req, res, next) ->
	if devices?
		req.devices = devices
		next()

# Load the core site
app.get '/', loadDevices, (req, res) ->
	res.render 'index',
		title: "SWITCH"
		devices: devices
