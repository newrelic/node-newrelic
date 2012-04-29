var http   = require('http')
  , os     = require('os')
  , events = require('events')
  , util   = require('util')
  , logger = require('./logger')
  , url    = require('url')
  ;

var PROTOCOL_VERSION = 9;

// FIXME add compression
// FIXME support proxies
function DataSender(fileConfig) {
  events.EventEmitter.call(this);
  this.config = fileConfig;

  this._uri = url.format({
    pathname : '/agent_listener/invoke_raw_method',
    query    : {
      marshal_format   : 'json',
      protocol_version : PROTOCOL_VERSION,
      license_key      : this.config.license_key
    }
  });

  this.client = http.createClient(this.config.proxy_port || this.config.port,
                                  this.config.proxy_host || this.config.host);
  this.client.__NEWRELIC = true;
}
util.inherits(DataSender, events.EventEmitter);

DataSender.prototype.send = function (method, uri, compress, params, timeoutInMillis) {
  var self = this;
  logger.debug("Send with uri: " + uri);

  // FIXME add compression
  var encoding = "identity";
  if (!params) {
    params = [];
  }

  var data = JSON.stringify(params);
  var contentLength = Buffer.byteLength(data,'utf8');

  // as per https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/servlet/AgentListener.html
  var userAgent = util.format("NewRelic-NodeAgent/%s (nodejs %s %s-%s)",
                              self.config.version,
                              process.versions.node,
                              process.platform,
                              process.arch);

  var headers = {
    "CONTENT-ENCODING" : encoding,
    "Content-Length"   : contentLength,
    "Connection"       : "Keep-Alive",
    "host"             : this.config.host,
    "Content-Type"     : 'application/json', // "application/octet-stream",
    "User-Agent"       : userAgent
  };

  logger.debug("Headers: ", headers);
  logger.debug("Data[" + method + "]: ", data);

  if (this.config.proxy_host !== null) {
    uri = 'http://' + this.config.host + ':' + this.config.port + uri;
  }

  var request = this.client.request("POST", uri, headers) ; //, {'host' : siteUrl.host})

  this.client.on('error', function (error) {
    // Error handling here
    logger.info("Error invoking " + method + " method: " + error);
    self.emit('error', method, error);
  });

  var responseMsg = '';
  request.on('response', function (response) {
    response.setEncoding('utf8');
    response.on('data', function (chunk) {
      if (response.statusCode === 200) {
        // Add this chunk to the message we're building.
        // TODO: Make sure we see all 2XX responses as valid.
        responseMsg += chunk;
      }
      else {
        // Emit an error for now.
        self.emit('error',response);
      }
    });
    response.on('end', function () {

      // No more data messages will be received. We should have a valid JSON response, let's parse it.
      var returnHash = JSON.parse(responseMsg);

      var exception = returnHash.exception;
      if (exception) return self.throwException(method, exception);

      var returnValue = returnHash.return_value;
      logger.debug('Response[' + method + "]: ", responseMsg);
      self.emit('response', returnValue);
    });
  });


  request.write(data);
  request.end();
};

DataSender.prototype.invokeMethod = function (method, compress, params, timeoutInMillis) {
  var url = this._uri + "&method=" + method;
  if (this.agentRunId) {
    url += "&agent_run_id=" + this.agentRunId;
  }
  this.send(method, url, compress, params, timeoutInMillis);
};

DataSender.prototype.throwException = function (method, exception) {
  // FIXME
  logger.debug("Received Exception from server");
  logger.debug(JSON.stringify(exception));
  var message = exception.message;
  var errorType = exception.error_type;

  if (message && errorType) {
    exception = new Error(message);
    exception.errorType = errorType;
  }

  // FIXME parse exception
  this.emit('error', method, exception);
};

function defaultErrorHandler(method, exception) {
  logger.info("An error occurred invoking method: " + method);
  logger.debug(exception);
}

function NewRelicService(agent, fileConfig) {
  events.EventEmitter.call(this);

  var self = this;

  var applicationName = agent.config.applications();
  var localhost = os.hostname();

  var agentRunId = null;

  function createDataSender(methodName, data) {
    var ds = new DataSender(fileConfig);
    ds.agentRunId = agentRunId;
    if (methodName) {
      ds.on('response', function (response) {
        self.emit(methodName + 'Response', response);
      });
      ds.on('error', function (error) {
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
    return {
      "pid"           : process.pid,
      "host"          : localhost,
      "language"      : "nodejs",
      "identifier"    : getIdentifier(),
      "app_name"      : applicationName,
      "agent_version" : agent.version,
      "environment"   : agent.environment
    };
  }

  this.isConnected = function () {
    return agentRunId;
  };

  function connected(responseHash) {
    self.config = responseHash;
    agentRunId = responseHash.agent_run_id;
    if (agentRunId) {
      logger.info("Connected to " + fileConfig.host + ':' + fileConfig.port);
      self.emit('connect', responseHash);
    }
  }

  function doConnect() {
    var dataSender = createDataSender();
    dataSender.on('response', connected);
    dataSender.on('error',function (method, error) {
      self.emit('connectError', error);
    });
    dataSender.invokeMethod("connect", true, [getConnectOptions()]);
  }

  this.connect = function () {
    var dataSender = createDataSender();
    dataSender.on('error', function (method, error) {
      self.emit('connectError', error);
    });
    dataSender.on('response',
                  function (redirectHost) {
                    if (redirectHost) {
                      logger.debug("Redirected from " + fileConfig.host + " to " + redirectHost);
                      fileConfig.host = redirectHost;
                    }
                    doConnect();
                  });
    dataSender.invokeMethod("get_redirect_host", false);
  };

  this.sendTracedErrors = function (errors) {
    if (errors.length === 0) return;
    var dataSender = createDataSender('errorData', errors);
    dataSender.invokeMethod("error_data", true, [agentRunId, errors]);
  };

  this.sendMetricData = function (beginTimeMillis, endTimeMillis, metricDataArray) {
    if (!agentRunId) {
      throw new Error("Not connected");
    }
    // we should always have some metric data (memory metrics)
    var dataSender = createDataSender('metricData', metricDataArray);
    dataSender.invokeMethod("metric_data", true, [agentRunId, beginTimeMillis, endTimeMillis, metricDataArray]);
  };
}
util.inherits(NewRelicService, events.EventEmitter);


exports.createNewRelicService = function (agent, config) {
  return new NewRelicService(agent, config);
};
