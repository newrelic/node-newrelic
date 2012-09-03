'use strict';

var path       = require('path')
  , os         = require('os')
  , events     = require('events')
  , util       = require('util')
  , logger     = require(path.join(__dirname, '..', 'logger'))
  , DataSender = require(path.join(__dirname, 'data-sender'))
  ;

function CollectorConnection(agent) {
  events.EventEmitter.call(this);

  this.agent = agent;
  this.applicationName = agent.config.applications();
  this.localhost = os.hostname();
}
util.inherits(CollectorConnection, events.EventEmitter);

CollectorConnection.prototype.createDataSender = function (methodName, data) {
  var self = this;

  var errorCallback = function errorCallback(method, error) {
    logger.info("An error occurred invoking method:", method);
    logger.debug(util.inspect(error));
  };

  var ds = new DataSender(this.agent.config, this.agentRunId);
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
  ds.on('error', errorCallback);

  return ds;
};

CollectorConnection.prototype.connect = function () {
  var self = this;

  var errorCallback = function errorCallback(method, error) {
    self.emit('connectError', error);
  };

  var connectCallback = function connectCallback(responseHash) {
    self.config = responseHash;
    self.agentRunId = responseHash.agent_run_id;
    if (self.agentRunId) {
      logger.info("Connected to " + self.agent.config.host +
                  ":" + self.agent.config.port);
      self.emit('connect', responseHash);
    }
  };

  var establishHandshake = function establishHandshake() {
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
    dataSender.on('error', errorCallback);
    dataSender.on('response', connectCallback);
    dataSender.invokeMethod('connect', true, [options]);
  };

  var redirectCallback = function redirectCallback(redirectHost) {
    if (redirectHost) {
      logger.debug("Redirected from " + self.agent.config.host +
                   " to " + redirectHost);
      self.agent.config.host = redirectHost;
    }
    establishHandshake();
  };

  var dataSender = self.createDataSender();
  dataSender.on('error', errorCallback);
  dataSender.on('response', redirectCallback);
  dataSender.invokeMethod("get_redirect_host", false);
};

CollectorConnection.prototype.isConnected = function () {
  return this.agentRunId ? true : false;
};

CollectorConnection.prototype.sendTracedErrors = function (errors) {
  if (!errors || errors.length === 0) {
    return logger.debug("No errors to send.");
  }

  if (!this.agentRunId) return logger.warn("Not connected to collector. " +
                                           "Not trying to send traced errors.");

  var dataSender = this.createDataSender('errorData', errors);
  dataSender.invokeMethod('error_data', true, [this.agentRunId, errors]);
};

CollectorConnection.prototype.sendMetricData = function (beginTimeMillis,
                                                         endTimeMillis,
                                                         metricData) {
  if (!metricData || metricData.length === 0) {
    return logger.debug("No metric data to send.");
  }

  if (!this.agentRunId) return logger.warn("Not connected to collector. " +
                                           "Not trying to send metric data.");

  // we should always have some metric data (memory metrics)
  var dataSender = this.createDataSender('metricData', metricData);
  dataSender.invokeMethod('metric_data', true, [this.agentRunId,
                                                beginTimeMillis, endTimeMillis,
                                                metricData]);
};

CollectorConnection.prototype.sendTransactionTraces = function (traces) {
  if (!traces || traces.length === 0) {
    return logger.debug("No transaction traces to send.");
  }

  if (!this.agentRunId) return logger.warn("Not connected to collector. " +
                                           "Not trying to send transaction traces.");

  // we should always have some metric data (memory metrics)
  var dataSender = this.createDataSender('transactionSampleData', traces);
  dataSender.invokeMethod('transaction_sample_data', true, [this.agentRunId, traces]);
};

CollectorConnection.prototype.sendSQLTraces = function (sqls) {
  if (!sqls || sqls.length === 0) {
    return logger.debug("No SQL traces to send.");
  }

  if (!this.agentRunId) return logger.warn("Not connected to collector. " +
                                           "Not trying to send SQL traces.");

  // we should always have some metric data (memory metrics)
  var dataSender = this.createDataSender('sqlTraceData', sqls);
  dataSender.invokeMethod('sql_trace_data', true, sqls);
};

module.exports = CollectorConnection;
