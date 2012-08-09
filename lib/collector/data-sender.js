'use strict';

var path       = require('path')
  , http       = require('http')
  , events     = require('events')
  , util       = require('util')
  , url        = require('url')
  , logger     = require(path.join(__dirname, '..', 'logger'))
  , StreamSink = require(path.join(__dirname, '..', 'util', 'stream-sink'))
  ;

var PROTOCOL_VERSION = 9;

// FIXME add compression
// FIXME support proxies
function DataSender(fileConfig) {
  events.EventEmitter.call(this);

  var self = this;
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

  this.on('error', function (method, error) {
    var hostname = self.config.proxy_host || self.config.host;
    logger.debug("Received exception from " + hostname);
    logger.debug(util.inspect(error));
  });
}
util.inherits(DataSender, events.EventEmitter);

DataSender.prototype.send = function (method, uri, compress, params, timeoutInMillis) {
  var self = this;
  logger.debug("Send with uri: " + uri);

  // FIXME add compression
  var encoding = "identity";

  if (!params) params = [];
  var data = JSON.stringify(params);

  var contentLength = Buffer.byteLength(data, 'utf8');

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
    "Content-Type"     : 'application/json',
    "User-Agent"       : userAgent
  };

  logger.debug("Headers: ", headers);
  logger.debug("Data[" + method + "]: ", data);

  if (this.config.proxy_host) uri = 'http://' + this.config.host + ':' + this.config.port + uri;

  this.client.on('error', function (error) {
    // Error handling here
    logger.info("Error invoking " + method + " method: " + error);
    self.emit('error', method, error);
  });

  var request = this.client.request("POST", uri, headers);

  request.on('response', function (response) {
    // TODO: Make sure we see all 2XX responses as valid.
    if (response.statusCode !== 200) return self.emit('error', method, response.statusCode);

    // if the encoding isn't explicitly set on the response, the chunks will
    // be Buffers and not strings.
    response.setEncoding('utf8');
    response.pipe(new StreamSink(function (error, body) {
      if (error) return self.emit('error', method, response);

      var message = JSON.parse(body);
      if (message.exception) return self.emit('error', method, message.exception);

      var returnValue = message.return_value;
      self.emit('response', returnValue);
    }));
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

module.exports = DataSender;
