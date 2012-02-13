var http = require('http');
var events = require('events');
var util = require('util');
var logger = require('./logger').getLogger();

var PROTOCOL_VERSION = 9;

// FIXME add compression
// FIXME support proxies
function DataSender(host, port, licenseKey) {
    events.EventEmitter.call(this);
    
    this._uri = "/agent_listener/invoke_raw_method?marshal_format=json&protocol_version=" + PROTOCOL_VERSION + "&license_key=" + licenseKey;
    
    this.client = http.createClient(port, host);
    this.client.__NEWRELIC = true;
}
util.inherits(DataSender, events.EventEmitter);

DataSender.prototype.send = function(method, uri, compress, params, timeoutInMillis) {
	var self = this;
    logger.debug("Send with uri: " + uri);
	
	// FIXME add compression
	var encoding = "identity";
    if (!params) {
        params = [];
    }

    var data = JSON.stringify(params);
    var contentLength = Buffer.byteLength(data,'utf8');
    var userAgent = "NewRelic-NodeAgent/0.1";
    
    headers = {"CONTENT-ENCODING" : encoding, 
            "Content-Length" : contentLength, 
            "Connection" : "Keep-Alive", 
            "host" : this.client.host, 
            "Content-Type" : 'application/json', // "application/octet-stream", 
            "User-Agent" : userAgent};

    logger.debug("Headers: ", headers);
    logger.debug("Data[" + method + "]: ", data);
    
    var request = this.client.request("POST", uri, headers) ; //, {'host' : siteUrl.host})

    this.client.on('error', function(error) {
      // Error handling here
      logger.info("Error invoking " + method + " method: " + error);
      this.emit('error', method, error);
    });

    request.on('response', function(response) {
        response.setEncoding('utf8');
        response.on('data', function(chunk) {
            if (response.statusCode == 200) {
                var returnHash = JSON.parse(chunk);
                
                var exception = returnHash["exception"];
                if (exception) {
                    this.throwException(method, exception);
                    return;
                }
                
                var returnValue = returnHash["return_value"];
                logger.debug('Response[' + method + "]: ", chunk);
                self.emit('response', returnValue);
            } else {
                // FIXME handle error cases
            }
        });
    });
    
    request.write(data);
    request.end();
};

DataSender.prototype.invokeMethod = function(method, compress, params, timeoutInMillis) {
    var url = this._uri + "&method=" + method;
    if (this.agentRunId) {
        url += "&agent_run_id=" + this.agentRunId;
    }
    this.send(method, url, compress, params, timeoutInMillis);
};

DataSender.prototype.throwException = function(method, exception) {
    // FIXME
    logger.debug("Received Exception from server");
    logger.debug(JSON.stringify(exception));
    var message = exception['message'];
    var errorType = exception['error_type'];
    
    if (message && errorType) {
        exception = new Error(message);
        exception.errorType = errorType;
    }

    // FIXME parse exception
    this.emit('error', method, exception);
};


function NewRelicService(agent, licenseKey, host, port) {
    events.EventEmitter.call(this);
    var self = this;
    var logger = agent.getLogger();
    
    var applicationName = agent.getConfig().getApplications();
    var localhost = "localhost"; // FIXME node doesn't have an api to tell us the hostname
    
    var agentRunId = null;
    var config = null;
    
    function defaultErrorHandler(method, exception) {
        logger.info("An error occurred invoking method: " + method);
        logger.debug(exception);
    }
    
    function createDataSender(methodName, data) {
        var ds = new DataSender(host, port, licenseKey);
        ds.agentRunId = agentRunId;
        if (methodName) {
        	ds.on('response', function(response) {
        		self.emit(methodName + 'Response', response);
        	});
        	ds.on('error', function(error) {
        		self.emit(methodName + 'Error', data, error);
        	});
        } 
        ds.on('error', defaultErrorHandler);

        return ds;
    }
        
    function getIdentifier() {        
        var id = applicationName[0] + ":nodejs:" + localhost;
        if (agent.applicationPort) {
            id += ':' + agent.applicationPort;
        }
        return id;
    }
    
    function getConnectOptions() {
        options = {
            "pid" : process.pid,
            "host" : localhost,
            "language" : "nodejs",
            "identifier" : getIdentifier(),
            "app_name" : applicationName,
            "agent_version" : agent.getVersion()
        };
        return options;
    }
    
    this.isConnected = function() {
        return agentRunId;
    };
    
    function connected(responseHash) {
        config = responseHash;
        agentRunId = responseHash['agent_run_id'];
        if (agentRunId) {
            logger.info("Connected to " + host + ':' + port);
            self.emit('connect', responseHash);
        }        
    }
    
    function doConnect() {
        var dataSender = createDataSender();
        dataSender.on('response', connected);
        dataSender.on('error',function(method, error) {
            self.emit('connectError', error);
        });
        dataSender.invokeMethod("connect", true, [getConnectOptions()]);
    }
    
    this.getConfig = function() {
        return config;
    };
    
    this.connect = function() {
        var dataSender = createDataSender();
        dataSender.on('error',function(method, error) {
            self.emit('connectError', error);
        });
        dataSender.on('response',
            function(redirectHost) {
                if (redirectHost) {
                    logger.debug("Redirected from " + host + " to " + redirectHost);
                    host = redirectHost;
                }
                doConnect();
            });
        dataSender.invokeMethod("get_redirect_host", false);
    };
    
    this.sendTracedErrors = function(errors) {
    	if (errors.length == 0) {
    		return;
    	}
        var dataSender = createDataSender('errorData', errors);
        dataSender.invokeMethod("error_data", true, [agentRunId, errors]);
    };
    
    this.sendMetricData = function(beginTimeMillis, endTimeMillis, metricDataArray) {
        if (!agentRunId) {
            throw new Error("Not connected");
        }
        // we should always have some metric data (memory metrics)
        var dataSender = createDataSender('metricData', metricDataArray);
        dataSender.invokeMethod("metric_data", true, [agentRunId, beginTimeMillis, endTimeMillis, metricDataArray]);
    };
}

util.inherits(NewRelicService, events.EventEmitter);


exports.createNewRelicService = function(agent, licenseKey, host, port) {
  return new NewRelicService(agent, licenseKey, host, port);
};

