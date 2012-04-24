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
		// $('.brand').addClass('srvrok');
	});
	
	socket.on('statuschange', function (statusobj) {
		//alert('got a status change for ' + statusobj['deviceid']+" to be " + statusobj["devicestatus"]);
		var deviceid = statusobj["deviceid"];
		devicestatus = statusobj["devicestatus"];
		$('div[deviceid="'+deviceid+'"]').attr('devicestatus', devicestatus)
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
			fbutton.addClass('active');
			fbutton.unbind('click');
			fbutton.click(bindStopFlash);
		}
		else {
			fbutton = $('a.fbutton[deviceid="'+deviceid+'"]')
			fbutton.removeClass('stopflashbutton');
			fbutton.addClass('flashbutton');
			fbutton.removeClass('active');
			fbutton.unbind('click');
			fbutton.click(bindFlash);
		};
	});

	socket.on('adddevice', function (deviceobj) {
		var last = $('.row').last();
    	var newrow = last.clone();

		if (newRow.hasClass('clone')) {
			newrow.removeClass('clone');
		}
		
		newrow.attr('deviceid', deviceobj.deviceid);

		var devtitle = newrow.find('.devtitle');
		devtitle.text(deviceobj.deviceid);
		
		var devtype = newrow.find('.devtype');
		devtype.text(deviceobj.devicetype);
    	
    	var devicon = newrow.find('.devicon')
    	devicon.attr('deviceid', deviceobj.deviceid);
    	devicon.attr('devicestatus', deviceobj.devicestatus);
    	
    	var togbutton = newrow.find('a.togbutton')
    	togbutton.attr('deviceid', deviceobj.deviceid)
    	togbutton.click(bindToggle)
    	
		var fbutton = newrow.find('a.fbutton')
    	fbutton.attr('deviceid', deviceobj.deviceid);
    	if (deviceobj.flashstatus == "Flashing") {
			if (newrow.hasClass('flashbutton')) {
				fbutton.removeClass('flashbutton');
				fbutton.addclass('stopflashbutton');
				fbutton.addClass('active');
			}
			fbutton.click(bindStopFlash);
		}
		else {
			if (newrow.hasClass('stopflashbutton')) {
				fbutton.removeClass('stopflashbutton');
				fbutton.addClass('flashbutton');
				fbutton.removeClass('active');
			}
			fbutton.click(bindFlash);
		};

		var dimslider = newrow.find('.dimslider');
		dimslider.attr('deviceid', deviceobj.deviceid);
		dimslider.attr('initval', deviceobj.dimval);
		dimslider.slider(slideparam);

    	last.after(newrow);
		newrow.show();
	});

	socket.on('removedevice', function (deviceobj) {
		deviceid = deviceobj["deviceid"];
		$('.row.'deviceid).remove()
	});

	socket.on('disconnect', function() {
		$('brand').removeClass('pulsar');
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