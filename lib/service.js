var http = require('http')
var events = require('events');
var _agent = require('newrelic_agent');

// FIXME add compression
// FIXME support proxies
function DataSender(host, port, licenseKey) {
    events.EventEmitter.call(this);
    var self = this;
    logger = _agent.getLogger();
    
    var PROTOCOL_VERSION = 9;
    var uri = "/agent_listener/invoke_raw_method?marshal_format=json&protocol_version=" + PROTOCOL_VERSION + "&license_key=";
    var agentRunId = null;
    
    this.createClient = function() {
        return http.createClient(port, host);
    }
    
    this.setAgentRunId = function(id) {
        agentRunId = id;
    }
    
    function throwException(method, exception) {
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
        self.emit('error', method, exception);
    }
    
    
    this.send = function(method, uri, encoding, params, timeoutInMillis) {
        var c = this.createClient();
        logger.debug("Send with uri: " + uri);
        if (!encoding) {
            encoding = "identity";
        }
        if (!params) {
            params = [];
        }

        var data = JSON.stringify(params);
        var contentLength = Buffer.byteLength(data,'utf8')
        var userAgent = "NewRelic-NodeAgent/0.1";
        
        headers = {"CONTENT-ENCODING" : encoding, 
                "Content-Length" : contentLength, 
                "Connection" : "Keep-Alive", 
                "host" : host, 
                "Content-Type" : 'application/json', // "application/octet-stream", 
                "User-Agent" : userAgent};

        logger.debug("Headers: ", headers);
        logger.debug("Data: ", data);
        
        var request = c.request("POST", uri, headers) ; //, {'host' : siteUrl.host})

        c.on('error', function(error) {
          // Error handling here
          logger.info("Error invoking " + method + " method: " + error);
          self.emit('error', method, error);
        });

        request.on('response', function(response) {
            response.setEncoding('utf8');
            response.on('data', function(chunk) {
                if (response.statusCode == 200) {
                    var returnHash = JSON.parse(chunk);
                    
                    var exception = returnHash["exception"];
                    if (exception) {
                        throwException(method, exception);
                        return;
                    }
                    
                    var returnValue = returnHash["return_value"];
                    logger.debug(method + " return value", returnValue);
                    self.emit('response', returnValue);
                } else {
                    // FIXME handle error cases
                }
            });
        });
        
        request.write(data);
        request.end();
    }
    
    this.invokeMethod = function(method, encoding, params, timeoutInMillis) {
        var url = uri + licenseKey + "&method=" + method;
        if (agentRunId) {
            url += "&agent_run_id=" + agentRunId;
        }
        this.send(method, url, encoding, params, timeoutInMillis);
    }
}

DataSender.super_ = events.EventEmitter;
DataSender.prototype = Object.create(events.EventEmitter.prototype, {
    constructor: {
        value: DataSender,
        enumerable: false
    }
});

function NewRelicService(agent, licenseKey, host, port) {
    events.EventEmitter.call(this);
    var self = this;
    var logger = _agent.getLogger();
    
    var applicationName = ["My App"];
    var localhost = "localhost"; // FIXME!!
    
    var agentRunId;
    var config;
    
    function defaultErrorHandler(method, exception) {
        logger.info("An error occurred invoking method: " + method);
        logger.debug(exception);
    }
    
    function createDataSender() {
        var ds = new DataSender(host, port, licenseKey);
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
        return options
    }
    
    this.isConnected = function() {
        return agentRunId;
    }
    
    function connected(responseHash) {
        config = responseHash;
        agentRunId = responseHash['agent_run_id'];
        if (agentRunId) {
            logger.debug("Connected to " + host);
            self.emit('connect', responseHash);
        }        
    }
    
    function doConnect() {
        var dataSender = createDataSender();
        dataSender.on('response', connected);
        dataSender.invokeMethod("connect", "identity", [getConnectOptions()]);
    }
    
    this.getConfig = function() {
        return config;
    }
    
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
        dataSender.invokeMethod("get_redirect_host");
    }
    
    this.sendMetricData = function(beginTimeMillis, endTimeMillis, metricDataArray) {
        if (!agentRunId) {
            throw new Error("Not connected");
        }
        var dataSender = createDataSender();
        dataSender.on('response', function(response) {
            self.emit('metricDataResponse', response);
        });
        dataSender.on('error', function(error) {
            self.emit('metricDataError', metricDataArray);
        });

        dataSender.invokeMethod("metric_data", "identity", [agentRunId, beginTimeMillis, endTimeMillis, metricDataArray]);
    }
}

NewRelicService.super_ = events.EventEmitter;
NewRelicService.prototype = Object.create(events.EventEmitter.prototype, {
    constructor: {
        value: NewRelicService,
        enumerable: false
    }
});


exports.createNewRelicService = function(agent, licenseKey, host, port) {
  return new NewRelicService(agent, licenseKey, host, port);
};

