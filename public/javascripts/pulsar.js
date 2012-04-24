$(document).ready(function() {
	var properties = {
		opacity: 0.2
	};
	$('.pulsar').pulse(properties,4000,1000,2000);
});

$(function() {
		$( "#slider" ).slider({
			value:100,
			min: 0,
			max: 500,
			step: 50,
			slide: function( event, ui ) {
				$( "#amount" ).val( "$" + ui.value );
			}
		});
		$( "#amount" ).val( "$" + $( "#slider" ).slider( "value" ) );
	});

jQuery.fn.pulse = function( properties, duration, numTimes, interval) {  
   
   if (duration === undefined || duration < 0) duration = 500;
   if (duration < 0) duration = 500;

   if (numTimes === undefined) numTimes = 1;
   if (numTimes < 0) numTimes = 0;

   if (interval === undefined || interval < 0) interval = 0;

   return this.each(function() {
      var $this = jQuery(this);
      var origProperties = {};
      for (property in properties) {
         origProperties[property] = $this.css(property);
      }

      var subsequentTimeout = 0;
      for (var i = 0; i < numTimes; i++) {
        window.setTimeout(function() {
          $this.animate(properties, (duration / 2), "easeInOutSine", function(){
            $this.animate(origProperties, (duration / 2), "easeInOutSine");
          });
        }, (duration + interval) * i);
      }
   });
};