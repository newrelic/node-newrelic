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

  this.agent = agent;
  this.applicationName = agent.config.applications();
  this.localhost = os.hostname();
}
util.inherits(CollectorConnection, events.EventEmitter);

CollectorConnection.prototype.createDataSender = function (methodName, data) {
  var self = this;

  var ds = new DataSender(this.agent.config);
  ds.agentRunId = this.agentRunId;
  if (methodName) {
    ds.on(
      'response',
      function (response) {
        self.emit(methodName + 'Response', response);
      }
    );

    ds.on(
      'error',
      function (error) {
        self.emit(methodName + 'Error', data, error);
      }
    );
  }
  ds.on('error', defaultErrorHandler);

  return ds;
};

CollectorConnection.prototype.connect = function () {
  var self = this;

  var getRedirect = function () {
    var dataSender = self.createDataSender();
    dataSender.on(
      'error',
      function (method, error) {
        self.emit('connectError', error);
      }
    );

    dataSender.on(
      'response',
      function (redirectHost) {
        if (redirectHost) {
          logger.debug("Redirected from " + self.agent.config.host + " to " + redirectHost);
          self.agent.config.host = redirectHost;
        }
        doConnect();
      }
    );
    dataSender.invokeMethod("get_redirect_host", false);
  };

  var connected = function (responseHash) {
    self.config = responseHash;
    self.agentRunId = responseHash.agent_run_id;
    if (self.agentRunId) {
      logger.info("Connected to " + self.agent.config.host + ':' + self.agent.config.port);
      self.emit('connect', responseHash);
    }
  };

  var doConnect = function () {
    var id = self.applicationName[0] + ':nodejs:' + self.localhost;
    if (self.agent.applicationPort) id += ':' + self.agent.applicationPort;

    var options = {
      pid           : process.pid,
      host          : self.localhost,
      language      : 'nodejs',
      identifier    : id,
      app_name      : self.applicationName,
      agent_version : self.agent.version,
      environment   : self.agent.environment
    };

    var dataSender = self.createDataSender();
    dataSender.on('response', connected.bind(self));
    dataSender.on(
      'error',
      function (method, error) {
        self.emit('connectError', error);
      }
    );
    dataSender.invokeMethod('connect', true, [options]);
  };

  getRedirect();
};

CollectorConnection.prototype.isConnected = function () {
  return this.agentRunId;
};

CollectorConnection.prototype.sendTracedErrors = function (errors) {
  if (errors.length === 0) return;
  var dataSender = this.createDataSender('errorData', errors);
  dataSender.invokeMethod("error_data", true, [this.agentRunId, errors]);
};

CollectorConnection.prototype.sendMetricData = function (beginTimeMillis, endTimeMillis, metricDataArray) {
  if (!this.agentRunId) {
    throw new Error("Not connected");
  }
  // we should always have some metric data (memory metrics)
  var dataSender = this.createDataSender('metricData', metricDataArray);
  dataSender.invokeMethod("metric_data", true, [this.agentRunId, beginTimeMillis, endTimeMillis, metricDataArray]);
};

module.exports = CollectorConnection;
