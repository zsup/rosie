$(document).ready(function() {
	$('a').click(function(e) {
		e.preventDefault();
		toggleLights();
	});
	
	var lightsOn = false;

	function toggleLights() {
		if (lightsOn) {
			$.ajax('/device/Elroy/turnOff', {
				// More stuff here
			});
			lightsOn = false;
		} else {
			$.ajax('/device/Elroy/turnOn', {
				// More stuff here
			});
			lightsOn = true;
		}
	} 
});

