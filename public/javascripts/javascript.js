$(document).ready(function() {

	$('a.togbutton').click(bindToggle);
	$('a.flashbutton').click(bindFlash);
	$('a.stopflashbutton').click(bindStopFlash);

	var socket = io.connect('http://localhost', {
		reconnect: false
	});

	socket.on('connect', function () {
		$('.srvr').addClass('srvrok');
	});
	
	socket.on('statuschange', function (statusobj) {
		devicename = statusobj["devicename"];
		devicestatus = statusobj["devicestatus"];
		$('td[devicename="'+devicename+'"]').attr('devicestatus', devicestatus)
	});
	
	socket.on('flashstatuschange', function (statusobj) {
		devicename = statusobj["devicename"];
		flashstatus = statusobj["flashstatus"];
		if (flashstatus == "Flashing") {
			fbutton = $('a.fbutton[devicename="'+devicename+'"]')
			fbutton.removeClass('flashbutton');
			fbutton.addClass('stopflashbutton');
			fbutton.text("StopFlash");
			fbutton.unbind('click');
			fbutton.click(bindStopFlash)
		}
		else {
			fbutton = $('a.fbutton[devicename="'+devicename+'"]')
			fbutton.removeClass('stopflashbutton');
			fbutton.addClass('flashbutton');
			fbutton.text("Flash");
			fbutton.unbind('click');
			fbutton.click(bindFlash)
		};
	});

	socket.on('adddevice', function (deviceobj) {
		last = $('tr').last()
    	var newrow = last.clone();
    	
    	devicon = newrow.find('td.devicon')
    	devicon.attr('devicename', deviceobj.devicename)
    	devicon.attr('devicestatus', deviceobj.devicestatus)
    	devicon.text(deviceobj.devicename)
    	
    	togbutton = newrow.find('a.togbutton')
    	togbutton.attr('devicename', deviceobj.devicename)
    	togbutton.click(bindToggle)
    	
		fbutton = newrow.find('a.fbutton')
    	fbutton.attr('devicename', deviceobj.devicename)
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

    	last.before(newrow)
	});

	socket.on('removedevice', function (deviceobj) {
		devicename = deviceobj["devicename"];
		$('td[devicename="'+devicename+'"]').parent().remove()
	});

	socket.on('disconnect', function() {
		$('body').css('background-color', "#f00");
	})

});

function bindToggle(e) {
	e.preventDefault();
	devicename = $(this).attr('devicename');
	$.ajax('/device/' + devicename + '/toggle');		
};

function bindFlash(e) {
	e.preventDefault();
	devicename = $(this).attr('devicename');
	$.ajax('/device/' + devicename + '/flash');		
};

function bindStopFlash(e) {
	e.preventDefault();
	devicename = $(this).attr('devicename');
	$.ajax('/device/' + devicename + '/stopflash');		
};