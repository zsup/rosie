jQuery(document).ready(function($) {
	$('a').click(function(e)) {
		e.preventDefault();
		toggleLights();
	}
});

var lightsOn = false;

function toggleLights() {
	if (lightsOn) {
		$.ajax('/devices/Elroy/turnOff', {
			// More stuff here
		});
		lightsOn = false;
	} else {
		$.ajax('/devices/Elroy/turnOn', {
			// More stuff here
		});
		lightsOn = true;
	}
}