$(document).ready(function() {
	$('.btn1').click(function() {
		$.ajax("/device/Elroy/fade/12/1000", {
			"type": "PUT"
		});
	});

	$('.btn2').click(function() {
		$.ajax("/device/Elroy/fade/6/2000", {
			"type": "PUT"
		});
	});

	$('.btn3').click(function() {
		$.ajax("/device/Elroy/fade/0/1000", {
			"type": "PUT"
		});
	});

	$('.btn4').click(function() {
		$.ajax("/device/Elroy/fade/12/10000", {
			"type": "PUT"
		});
	});
})