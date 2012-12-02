$(document).ready(function() {
	
	var api_key = '?api_key=y9c0MbNA7rkS412w'
  var knobvars = {
		'min': 0 ,
		'max': 255 ,
		'width': 100 ,
		'height': 100 ,
		'thickness': .4,
		'fgColor' : "#00AEEF" ,
		'displayInput' : false ,
		'release': function (value, did) {
			$.ajax('device/' + did + '/dim/' + value + api_key, {type: "PUT"});
		},
		'clicked': function (did) {
			$.ajax('device/' + did + '/toggle' + api_key, {type: "PUT"});
		},
		'turnon': function (did) {
			$.ajax('device/' + did + '/turnOn' + api_key, {type: "PUT"});
		},
		'turnoff': function (did) {
			$.ajax('device/' + did + '/turnOff' + api_key, {type: "PUT"});
		}
	};
	
	// Knobby function. Makes a pretty sweet knob.
	$('.dial').knob(knobvars);

	var socket = io.connect('/', {
		reconnect: false
	});

	// New simplified socket.io functions. Need to write these.
	socket.on('add', function (device) {});
	socket.on('remove', function (device) {});
	socket.on('update', function (device) {});
	
	// Old complex socket.io functions. Use only for reference.
	/*
	socket.on('statuschange', function (statusobj) {
		//alert('got a status change for ' + statusobj['deviceid']+" to be " + statusobj["devicestatus"]);
		var deviceid = statusobj["deviceid"];
		devicestatus = statusobj["devicestatus"];
		$('.deviconbg[deviceid="'+deviceid+'"]').attr('devicestatus', devicestatus)
	});
	
	socket.on('dimstatuschange', function (statusobj) {
		//alert('got a status change for ' + statusobj['deviceid']+" to be " + statusobj["devicestatus"]);
		var deviceid = statusobj["deviceid"];
		var dimval = statusobj["dimval"];
		
		// TODO: Fix this for the knob
		$('.dial[deviceid="'+deviceid+'"]').val(dimval).trigger('configure')
	});

	socket.on('adddevice', function (deviceobj) {
		var cloner = $('.clone');
    	var newpanel = cloner.clone();
		newpanel.removeClass('clone');
		
		newpanel.attr('deviceid', deviceobj.deviceid);

		var devtitle = newpanel.find('.devtitle');
		devtitle.text(deviceobj.deviceid);
		
		var devtype = newpanel.find('.devtype');
		devtype.text(deviceobj.devicetype);
    	
    	var togbutton = newpanel.find('a.togbutton')
    	togbutton.attr('deviceid', deviceobj.deviceid)
    	togbutton.click(bindToggle)
    	
		var fbutton = newpanel.find('a.fbutton')
    	fbutton.attr('deviceid', deviceobj.deviceid);
    	if (deviceobj.flashstatus == 1) {
			fbutton.addClass('active');
		}
		fbutton.click(bindFlash);

		var dial = newpanel.find('.clone-dial');
		var dialdiv = newpanel.find('.dial-div')
		if (deviceobj.devicetype === "LED" || deviceobj.devicetype === "Light") {
			dial.val(deviceobj.dimval);
			dial.attr('deviceid', deviceobj.deviceid);
			dial.removeClass('clone-dial');
			dial.addClass('dial');
			dial.knob(knobvars);
		}
		else {
			dialdiv.remove();
		}
		
		newpanel.css({
			'opacity' : 0,
			'top' : '-20px',
		});
    	cloner.before(newpanel);
		newpanel.animate({
			'opacity' : 1,
			'top' : '0px'
		},800);
	});
	
	socket.on('updatedevice', function (deviceobj) {
		var deviceid = deviceobj.deviceid;
		var row = $(".row[deviceid=\"" + deviceid + "\"]");
		
		var devtype = row.find('.devtype');
		devtype.text(deviceobj.devicetype);
    	
    	var togbutton = row.find('a.togbutton');
    	togbutton.attr('deviceid', deviceobj.deviceid);
	});

	socket.on('removedevice', function (deviceobj) {
		var deviceid = deviceobj.deviceid;
		var oldrow = $(".panel[deviceid=\"" + deviceid + "\"]");
		oldrow.animate({
			'opacity' : 0,
			'top' : '-20px',
		}, 400, 'linear', function() {
			oldrow.hide(400, function() {
				oldrow.remove();
			});
		});
	});

	socket.on('disconnect', function() {
		// TBD
	})

*/

});

// Old binding functions. Use only for reference.
/*
function bindToggle(e) {
	e.preventDefault();
	deviceid = $(this).attr('deviceid');
	$.ajax('/device/' + deviceid + '/toggle');		
};

function bindFlash(e) {
	e.preventDefault();
	deviceid = $(this).attr('deviceid');
	$.ajax('/device/' + deviceid + '/flash');		
};

function bindSendDim(e) {
	e.preventDefault();
	deviceid = $(this).attr('deviceid');
	dimval = $(this).attr('dimval');
	$.ajax('/device/' + deviceid + '/dim/' + dimval);		
};
*/
