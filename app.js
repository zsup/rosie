var net = require('net');
var http = require('http');

// Create the http server to communicate with apps.
http.createServer(function(request, response) {
  response.writeHead(200, {"Content-Type": "text/plain"});
  response.write("Hello World");
  response.end();
}).listen(8888);

// Create the telnet server to communicate with the Arduino.
var server = net.createServer(function(c) { //'connection' listener
  console.log('server connected');
  c.on('end', function() {
    console.log('server disconnected');
  });
  c.write('hello\r\n');
  c.pipe(c);
});

server.listen(1307, function() { //'listening' listener
  console.log('server bound');
});