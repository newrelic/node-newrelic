'use strict';

var path       = require('path')
  , os         = require('os')
  , events     = require('events')
  , util       = require('util')
  , logger     = require(path.join(__dirname, '..', 'logger')).child({component : 'connection'})
  , DataSender = require(path.join(__dirname, 'data-sender'))
  ;

function isRestart(error) {
  return error &&
    error.error_type &&
    error.error_type === 'NewRelic::Agent::ForceRestartException';
}

function CollectorConnection(agent) {
  events.EventEmitter.call(this);

  this.agent = agent;
  this.applicationName = agent.config.applications();
  this.localhost = os.hostname();
  this.on('end', this.destroy.bind(this));
}
util.inherits(CollectorConnection, events.EventEmitter);

CollectorConnection.prototype.createDataSender = function (methodName, data,
                                                           responseCallback,
                                                           errorCallback) {
  var sender = new DataSender(this.agent.config, this.agentRunId);

  if (methodName) {
    sender.on('response', function (response) {
      this.emit(methodName + 'Response', response);
    }.bind(this));

    sender.on('error', function (error) {
      this.emit(methodName + 'Error', data, error);
    }.bind(this));
  }

  if (responseCallback) sender.on('response', responseCallback);

  if (errorCallback) {
    sender.on('error', errorCallback);
  }
  else {
    sender.on('error', function errorCallback(method, error) {
      if (typeof error === 'object') {
        logger.info(error, "An error occurred invoking method %s:", method);
      }
      else {
        logger.info("An error occurred invoking method %s: %s", method, error);
      }
    }.bind(this));
  }

  return sender;
};

CollectorConnection.prototype.invokeMethod = function (methodName, remoteName, data,
                                                       responseCallback, errorCallback) {
  var sender = this.createDataSender(methodName, data, responseCallback, errorCallback);

  // a restart can come in response to any method invocation
  sender.on('error', function restartHandler(method, error) {
    if (isRestart(error) && !this.finished) {
      logger.debug("New Relic wants the agent to reconnect.");
      this.agent.emit('restart');
      this.emit('end');
    }
  }.bind(this));

  sender.invokeMethod(remoteName, data);
};

CollectorConnection.prototype.connect = function () {
  var errorCallback = function errorCallback(method, error) {
    this.emit('connectError', error);
  }.bind(this);

  var connectCallback = function connectCallback(responseHash) {
    this.config = responseHash;
    this.agentRunId = responseHash.agent_run_id;
    if (this.agentRunId) {
      logger.info("Connected to %s:%d.",
                  this.agent.config.host,
                  this.agent.config.port);
      this.emit('connect', responseHash);
    }
  }.bind(this);

  var establishHandshake = function establishHandshake() {
    var id = this.applicationName[0] + ':nodejs:' + this.localhost;
    if (this.agent.applicationPort) id += ':' + this.agent.applicationPort;

    var options = {
      pid           : process.pid,
      host          : this.localhost,
      language      : 'nodejs',
      identifier    : id,
      app_name      : this.applicationName,
      agent_version : this.agent.version,
      environment   : this.agent.environment
    };

    this.invokeMethod(null, 'connect', [options],
                      connectCallback, errorCallback);
  }.bind(this);

  var redirectCallback = function redirectCallback(redirectHost) {
    if (redirectHost) {
      logger.debug("Redirected from %s to %s.",
                   this.agent.config.host,
                   redirectHost);
      this.agent.config.host = redirectHost;
    }
    establishHandshake();
  }.bind(this);

  this.invokeMethod(null, 'get_redirect_host', null,
                    redirectCallback, errorCallback);
};

CollectorConnection.prototype.isConnected = function () {
  return this.agentRunId ? true : false;
};

CollectorConnection.prototype.destroy = function () {
  logger.info("Shutting down New Relic connection with run ID %s.", this.agentRunId);
  delete this.agentRunId;
  this.finished = true;
};

CollectorConnection.prototype.sendTracedErrors = function (errors) {
  if (!errors || errors.length === 0) {
    return logger.debug("No errors to send.");
  }

  if (!this.agentRunId) return logger.warn("Not connected to collector. " +
                                           "Not trying to send traced errors.");

  this.invokeMethod('errorData', 'error_data', [this.agentRunId, errors]);
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
  this.invokeMethod('metricData', 'metric_data',
                    [this.agentRunId, beginTimeMillis, endTimeMillis, metricData]);
};

CollectorConnection.prototype.sendTransactionTraces = function (traces) {
  if (!traces || traces.length === 0 || !traces[0]) {
    return logger.debug("No transaction traces to send.");
  }

  if (!this.agentRunId) return logger.warn("Not connected to collector. " +
                                           "Not trying to send transaction traces.");

  this.invokeMethod('transactionSampleData', 'transaction_sample_data',
                    [this.agentRunId, traces]);
};

CollectorConnection.prototype.sendSQLTraces = function (sqls) {
  if (!sqls || sqls.length === 0) {
    return logger.debug("No SQL traces to send.");
  }

  if (!this.agentRunId) return logger.warn("Not connected to collector. " +
                                           "Not trying to send SQL traces.");

  // we should always have some metric data (memory metrics)
  this.invokeMethod('sqlTraceData', 'sql_trace_data', sqls);
};

CollectorConnection.prototype.sendShutdown = function () {
  var sender = this.createDataSender('shutdown', null, null,
                                     function (method, error) {
    if (isRestart(error)) {
      logger.info("Connection to New Relic terminated.");
    }
    else {
      logger.warn("Unexpected response on shutdown: %s", error);
    }
  });
  sender.invokeMethod('shutdown');
};

module.exports = CollectorConnection;
