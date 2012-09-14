'use strict';

var path       = require('path')
  , http       = require('http')
  , events     = require('events')
  , util       = require('util')
  , url        = require('url')
  , zlib       = require('zlib')
  , logger     = require(path.join(__dirname, '..', 'logger'))
  , StreamSink = require(path.join(__dirname, '..', 'util', 'stream-sink'))
  ;

var PROTOCOL_VERSION = 9;

// FIXME support proxies
// TODO add configurable timeout to connections
function DataSender(config, agentRunId) {
  events.EventEmitter.call(this);

  this.config     = config;
  this.agentRunId = agentRunId;

  this._url = url.format({
    pathname : '/agent_listener/invoke_raw_method',
    query    : {
      marshal_format   : 'json',
      protocol_version : PROTOCOL_VERSION,
      license_key      : this.config.license_key
    }
  });

  var self = this;
  this.on('error', function (method, error) {
    var hostname = self.config.proxy_host || self.config.host;
    logger.debug("Attempting to send data to collector " + hostname + " failed:");
    logger.debug(util.inspect(error));
  });
}
util.inherits(DataSender, events.EventEmitter);

DataSender.prototype.getUserAgent = function () {
  // as per https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/servlet/AgentListener.html
  return util.format("NewRelic-NodeAgent/%s (nodejs %s %s-%s)",
                     this.config.version,
                     process.versions.node,
                     process.platform,
                     process.arch);
};

DataSender.prototype.canonicalizeURL = function (url) {
  if (this.config.proxy_host) {
    return 'http://' + this.config.host + ':' + this.config.port + url;
  }
  else {
    return url;
  }
};

DataSender.prototype.createHeaders = function (encoding, length, compressed) {
  return {
    "CONTENT-ENCODING" : encoding,
    "Content-Length"   : length,
    "Connection"       : "Keep-Alive",
    "host"             : this.config.host,
    "Content-Type"     : compressed ? 'application/octet-stream' : 'application/json',
    "User-Agent"       : this.getUserAgent()
  };
};

DataSender.prototype.createRequest = function (method, url, headers) {
  var request = http.request({
    __NR__connection : true, // who measures the metrics measurer?
    method           : 'POST',
    port             : this.config.proxy_port || this.config.port,
    host             : this.config.proxy_host || this.config.host,
    path             : this.canonicalizeURL(url),
    headers          : headers
  });

  var self = this;
  request.on('error', function (error) {
    logger.info("Error invoking " + method + " method: " + error);
    self.emit('error', method, error);
  });

  request.on('response', function (response) {
    var VALUE = 'return_value';

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return self.emit('error', method, response.statusCode);
    }

    // if the encoding isn't explicitly set on the response, the chunks will
    // be Buffers and not strings.
    response.setEncoding('utf8');
    response.pipe(new StreamSink(function (error, body) {
      if (error) return self.emit('error', method, response);

      var message = JSON.parse(body);
      if (message.exception) return self.emit('error', method, message.exception);

      self.emit('response', message[VALUE]);
    }));
  });

  return request;
};

DataSender.prototype.sendPlaintext = function sendPlainText(method, url, data) {
  var encoding      = 'identity'
    , contentLength = Buffer.byteLength(data, 'utf8')
    , headers       = this.createHeaders(encoding, contentLength);

  logger.debug("Headers: ", headers);
  logger.debug("Data[" + method + "]: ", data || "(no data)");

  var request = this.createRequest(method, url, headers);

  request.write(data);
  request.end();
};

DataSender.prototype.sendCompressed = function sendCompressed(method, url, data) {
  var self = this;
  zlib.deflate(data, function (err, deflated) {
    if (err) return logger.verboe("Error compressing JSON for delivery: " + err);

    var encoding      = 'deflate'
      , contentLength = deflated.length
      , headers       = self.createHeaders(encoding, contentLength, true); // cmprssd plz

    logger.debug("Headers: ", headers);
    logger.debug("Data[" + method + "] (COMPRESSED): ", data || "(no data)");

    var request = self.createRequest(method, url, headers);

    request.write(deflated);
    request.end();
  });
};

DataSender.prototype.send = function (method, url, compress, params) {
  var self = this;
  logger.debug("Post to URL: " + url);

  if (!params) params = [];
  var data = JSON.stringify(params);

  var contentLength = Buffer.byteLength(data, 'utf8');
  if (compress || contentLength > 65536) {
    this.sendCompressed(method, url, data);
  }
  else {
    this.sendPlaintext(method, url, data);
  }
};

DataSender.prototype.invokeMethod = function (method, compress, params) {
  var url = this._url + "&method=" + method;
  if (this.agentRunId) url += "&agent_run_id=" + this.agentRunId;

  this.send(method, url, compress, params);
};

module.exports = DataSender;
