$(document).ready(function() {

	$('a.togbutton').click(bindToggle);
	$('a.flashbutton').click(bindFlash);
	$('a.dimbutton').click(bindSendDim);
	$('.dial').knob({
		'change': function (e) {
			var deviceid = $(this).attr("deviceid");
			$.ajax('/device/' + deviceid + '/dim/' + e.value);
		}
	});
	
	/* Need to figure out how to get initial values for each one
	$('.dial').each( function() {
		var initval = $(this).attr("initval");
		if (initval) {
			$(this).slider("value", initval);
		}
	});
	*/

	var socket = io.connect('/', {
		reconnect: false
	});

	socket.on('connect', function () {
		// $('.brand').addClass('srvrok');
	});
	
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
		$('.dimslider[deviceid="'+deviceid+'"]').slider("value", dimval)
		$('.deviconbg[deviceid="'+deviceid+'"]').css("opacity", dimval/255)
	});

	socket.on('flashstatuschange', function (statusobj) {
		deviceid = statusobj["deviceid"];
		flashstatus = statusobj["flashstatus"];
		if (flashstatus === "Flashing") {
			fbutton = $('a.fbutton[deviceid=\"'+deviceid+'\"]')
			fbutton.addClass('active');
		}
		else {
			fbutton = $('a.fbutton[deviceid=\"'+deviceid+'\"]')
			fbutton.removeClass('active');
		};
	});

	socket.on('adddevice', function (deviceobj) {
		var cloner = $('.clone');
    	var newrow = cloner.clone();
		newrow.removeClass('clone');
		
		newrow.attr('deviceid', deviceobj.deviceid);

		var devtitle = newrow.find('.devtitle');
		devtitle.text(deviceobj.deviceid);
		
		var devtype = newrow.find('.devtype');
		devtype.text(deviceobj.devicetype);
    	
    	var deviconbg = newrow.find('.deviconbg')
    	deviconbg.attr('deviceid', deviceobj.deviceid);
    	deviconbg.attr('devicestatus', deviceobj.devicestatus);
    	
    	var togbutton = newrow.find('a.togbutton')
    	togbutton.attr('deviceid', deviceobj.deviceid)
    	togbutton.click(bindToggle)
    	
		var fbutton = newrow.find('a.fbutton')
    	fbutton.attr('deviceid', deviceobj.deviceid);
    	if (deviceobj.flashstatus === "Flashing") {
			fbutton.addClass('active');
		}
		fbutton.click(bindFlash);

		var dimslider = newrow.find('.dimslider');
		if (deviceobj.devicetype === "LED") {
			dimslider.attr('deviceid', deviceobj.deviceid);
			dimslider.attr('initval', deviceobj.dimval);
			dimslider.slider(slideparam);
		}
		else {
			dimslider.remove();
		}
		
		newrow.css({
			'opacity' : 0,
			'top' : '-20px',
		});
    	cloner.before(newrow);
		newrow.animate({
			'opacity' : 1,
			'top' : '0px'
		},800);
	});
	
	socket.on('updatedevice', function (deviceobj) {
		var deviceid = deviceobj.deviceid;
		var row = $(".row[deviceid=\"" + deviceid + "\"]");
		
		var devtype = row.find('.devtype');
		devtype.text(deviceobj.devicetype);
    	
    	var deviconbg = row.find('.deviconbg')
    	deviconbg.attr('devicestatus', deviceobj.devicestatus);
    	
    	var togbutton = row.find('a.togbutton');
    	togbutton.attr('deviceid', deviceobj.deviceid);
	});

	socket.on('removedevice', function (deviceobj) {
		deviceid = deviceobj.deviceid;
		var oldrow = $(".row[deviceid=\"" + deviceid + "\"]");
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

});

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