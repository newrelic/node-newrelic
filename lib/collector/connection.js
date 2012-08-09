'use strict';

var path       = require('path')
  , os         = require('os')
  , events     = require('events')
  , util       = require('util')
  , logger     = require(path.join(__dirname, '..', 'logger'))
  , DataSender = require(path.join(__dirname, 'data-sender'))
  ;

function defaultErrorHandler(method, exception) {
  logger.info("An error occurred invoking method:", method);
  logger.debug(exception);
}

function CollectorConnection(agent) {
  events.EventEmitter.call(this);

  var self = this;

  var applicationName = agent.config.applications();
  var localhost = os.hostname();

  var agentRunId = null;

  function createDataSender(methodName, data) {
    var ds = new DataSender(agent.config);
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
      logger.info("Connected to " + agent.config.host + ':' + agent.config.port);
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
                      logger.debug("Redirected from " + agent.config.host + " to " + redirectHost);
                      agent.config.host = redirectHost;
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
util.inherits(CollectorConnection, events.EventEmitter);

exports.createCollectorConnection = function (agent) {
  return new CollectorConnection(agent);
};
