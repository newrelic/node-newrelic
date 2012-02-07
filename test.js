var agent = require('newrelic_agent');
agent.connect('d67afc830dab717fd163bfcb0b8b88423e9a1a3b', 'staging-collector.newrelic.com', 80);
//agent.connect('bootstrap_newrelic_admin_license_key_000', 'localhost', '8081');

var fs = require('fs');
var http = require('http');
require("events");

//agent.logToConsole();
 
http.createServer(function (request, response) {
	if (request.url == '/favicon.ico') {
		return;
	}
    response.writeHead(200, {'Content-Type': 'text/plain'});

	// add this timeout to force another event hop.  make the timeout random so
	// we get some requests out of order
	setTimeout(function() {
		fs.readdir(request.url, function(err, files) {
			var timeout = 66;
			if (!files) {
				response.statusCode = 404;
			} else {
				timeout = 30 * files.length;
			}
			
//			console.log("REALLY DONE " + err + " files: " + files);
//			console.log("TX: " + request.NRAgent.getTransaction());
			setTimeout(function() {
				response.end('Hello World ' + files + '\n');
				console.log("Request end " + request.url);
			}, timeout);
		});
	}, Math.floor(Math.random()*300));
	
}).listen(8000);
