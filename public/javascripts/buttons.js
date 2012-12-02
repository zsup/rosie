$(document).ready(function() {
  var api_key = '?api_key=y9c0MbNA7rkS412w'

	$('.btn1').click(function() {
		$.ajax("/device/Elroy/fade/12/1000" + api_key, {
			"type": "PUT"
		});
	});

	$('.btn2').click(function() {
		$.ajax("/device/Elroy/fade/6/2000" + api_key, {
			"type": "PUT"
		});
	});

	$('.btn3').click(function() {
		$.ajax("/device/Elroy/fade/0/1000" + api_key, {
			"type": "PUT"
		});
	});

	$('.btn4').click(function() {
		$.ajax("/device/Elroy/fade/12/10000" + api_key, {
			"type": "PUT"
		});
	});
})
