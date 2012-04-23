$(document).ready(function() {

	$('a.togbutton').click(bindToggle);
	$('a.flashbutton').click(bindFlash);
	$('a.stopflashbutton').click(bindStopFlash);
	$('a.dimbutton').click(bindSendDim);

	var slideparam = {
			value:255,
			min: 0,
			max: 256,
			step: 4,
			slide: function( event, ui ) {
				var deviceid = $(this).attr("deviceid")
				$('.dimvalp[deviceid="'+deviceid+'"]').text(ui.value);
				$.ajax('/device/' + deviceid + '/dim'+ui.value);
			}
	}

	$('.dimslider').slider(slideparam);
	$('.dimslider').each( function() {
		var initval = $(this).attr("initval");
		if (initval) {
			$(this).slider("value", initval);
		}
	});

	var socket = io.connect('/', {
		reconnect: false
	});

	socket.on('connect', function () {
		$('.srvr').addClass('srvrok');
	});
	
	socket.on('statuschange', function (statusobj) {
		//alert('got a status change for ' + statusobj['deviceid']+" to be " + statusobj["devicestatus"]);
		var deviceid = statusobj["deviceid"];
		devicestatus = statusobj["devicestatus"];
		$('td[deviceid="'+deviceid+'"]').attr('devicestatus', devicestatus)
	});
	
	socket.on('dimstatuschange', function (statusobj) {
		//alert('got a status change for ' + statusobj['deviceid']+" to be " + statusobj["devicestatus"]);
		var deviceid = statusobj["deviceid"];
		var dimval = statusobj["dimval"];
		$('.dimvalp[deviceid="'+deviceid+'"]').text(dimval);
		$('.dimslider[deviceid="'+deviceid+'"]').slider("value", dimval)
	});

	socket.on('flashstatuschange', function (statusobj) {
		deviceid = statusobj["deviceid"];
		flashstatus = statusobj["flashstatus"];
		if (flashstatus == "Flashing") {
			fbutton = $('a.fbutton[deviceid="'+deviceid+'"]')
			fbutton.removeClass('flashbutton');
			fbutton.addClass('stopflashbutton');
			fbutton.text("StopFlash");
			fbutton.unbind('click');
			fbutton.click(bindStopFlash)
		}
		else {
			fbutton = $('a.fbutton[deviceid="'+deviceid+'"]')
			fbutton.removeClass('stopflashbutton');
			fbutton.addClass('flashbutton');
			fbutton.text("Flash");
			fbutton.unbind('click');
			fbutton.click(bindFlash)
		};
	});

	socket.on('adddevice', function (deviceobj) {
		var last = $('tr').last()
    	var newrow = last.clone();
    	
    	var devicon = newrow.find('td.devicon')
    	devicon.attr('deviceid', deviceobj.deviceid)
    	devicon.attr('devicestatus', deviceobj.devicestatus)
    	devicon.text(deviceobj.deviceid)
    	
    	var togbutton = newrow.find('a.togbutton')
    	togbutton.attr('deviceid', deviceobj.deviceid)
    	togbutton.click(bindToggle)
    	
		var fbutton = newrow.find('a.fbutton')
    	fbutton.attr('deviceid', deviceobj.deviceid)
    	if (deviceobj.flashstatus == "Flashing") {
			fbutton.addClass('stopflashbutton');
			fbutton.text("StopFlash")
			fbutton.click(bindStopFlash)
		}
		else {
			fbutton.addClass('flashbutton');
			fbutton.text("Flash")
			fbutton.click(bindFlash)
		};

		var dimslider = newrow.find('.dimslider');
		dimslider.attr('deviceid', deviceobj.deviceid)
		dimslider.slider(slideparam);

		var dimvalp = newrow.find('.dimvalp');
		dimvalp.attr('deviceid', deviceobj.deviceid)

    	last.before(newrow)
	});

	socket.on('removedevice', function (deviceobj) {
		deviceid = deviceobj["deviceid"];
		$('td[deviceid="'+deviceid+'"]').parent().remove()
	});

	socket.on('disconnect', function() {
		$('body').css('background-color', "#f00");
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

function bindStopFlash(e) {
	e.preventDefault();
	deviceid = $(this).attr('deviceid');
	$.ajax('/device/' + deviceid + '/stopflash');		
};

function bindSendDim(e) {
	e.preventDefault();
	deviceid = $(this).attr('deviceid');
	dimval = $(this).attr('dimval');
	$.ajax('/device/' + deviceid + '/dim'+dimval);		
};