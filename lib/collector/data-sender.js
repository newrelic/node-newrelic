'use strict';

var path       = require('path')
  , dns        = require('dns')
  , http       = require('http')
  , events     = require('events')
  , util       = require('util')
  , url        = require('url')
  , zlib       = require('zlib')
  , logger     = require(path.join(__dirname, '..', 'logger'))
      .child({component : 'data_sender'})
  , StreamSink = require(path.join(__dirname, '..', 'util', 'stream-sink'))
  ;

/*
 * CONSTANTS
 */
var PROTOCOL_VERSION        = 11
  , RESPONSE_VALUE_NAME     = 'return_value'
  , RUN_ID_NAME             = 'run_id'
  , RAW_METHOD_PATH         = '/agent_listener/invoke_raw_method'
  // https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/servlet/AgentListener.html
  , USER_AGENT_FORMAT       = "NewRelic-NodeAgent/%s (nodejs %s %s-%s)"
  , ENCODING_HEADER         = 'CONTENT-ENCODING'
  , CONTENT_TYPE_HEADER     = 'Content-Type'
  , DEFAULT_ENCODING        = 'identity'
  , COMPRESSED_ENCODING     = 'deflate'
  , DEFAULT_CONTENT_TYPE    = 'application/json'
  , COMPRESSED_CONTENT_TYPE = 'application/octet-stream'
  ;

// TODO add configurable timeout to connections
function DataSender(config) {
  events.EventEmitter.call(this);

  this.config     = config;

  this.on('error', this.onError.bind(this));
}
util.inherits(DataSender, events.EventEmitter);

/**
 * The primary interface to DataSender objects. If you're calling anything on
 * DataSender objects aside from invokeMethod (and you're not writing test
 * code), something is probably awry.
 *
 * @param string message The type of message you want to send the collector.
 * @param object data    Serializable data to be sent.
 */
DataSender.prototype.invokeMethod = function (message, body) {
  if (!message) {
    throw new Error("Can't send the collector a message without a message type.");
  }

  var data = JSON.stringify(body || []);
  if (this.shouldCompress(data)) {
    logger.trace({data : data}, "Sending with %s (COMPRESSED):", message);

    zlib.deflate(data, function (err, deflated) {
      if (err) {
        return logger.verbose(err, "Error compressing JSON for delivery. Not sending.");
      }

      var headers = this.getHeaders(deflated.length, true);
      this.postToCollector(message, headers, deflated);
    }.bind(this));
  }
  else {
    logger.trace({data: data}, "Sending with %s:", message);

    var headers = this.getHeaders(Buffer.byteLength(data, 'utf8'));
    // ensure that invokeMethod is always asynchronous
    process.nextTick(this.postToCollector.bind(this, message, headers, data));
  }
};

/**
 * Send a message to the collector and set up the sender to handle the
 * result.
 *
 * @param string message The message type being sent to the collector.
 * @param object headers The headers for this request.
 * @param string data    The encoded data, ready for delivery.
 */
DataSender.prototype.postToCollector = function (message, headers, data) {
  var port    = this.config.proxy_port || this.config.port
    , host    = this.config.proxy_host || this.config.host
    , urlPath = this.getURL(message)
    ;

  /* Explicitly resolve the address of the collector / collector proxy so
   * errors during lookup can be handled without crashing the agent or
   * the instrumented app. getHeaders() explicitly sets the Host header,
   * so http.request is told not to do it itself.
   *
   * TODO: needs an integration environment to test properly
   */
  dns.lookup(host, function (error, address) {
    if (error) return this.emit('error', message, error);

    logger.debug("Posting %s message to %s:%s at %s.", message, host, port, urlPath);
    var request = http.request({
      method           : 'POST',
      setHost          : false,   // see below
      host             : address, // set explicitly in the headers
      port             : port,
      path             : urlPath,
      headers          : headers,
      __NR__connection : true     // who measures the metrics measurer?
    });

    request.on('error',    this.onError.bind(this, message));
    request.on('response', this.onCollectorResponse.bind(this, message));

    request.end(data);
  }.bind(this));
};

/**
 * ForceRestartExceptions aren't actually errors, don't log them as such.
 */
DataSender.prototype.onError = function (message, error) {
  var hostname = this.config.proxy_host || this.config.host;
  if (error && error.error_type !== 'NewRelic::Agent::ForceRestartException') {
    logger.debug(error,
                 "Attempting to send %s to collector %s failed:",
                 message,
                 hostname);
  }
};

/**
 * Pipe the data from the collector to a response handler.
 *
 * @param string message The message being sent to the collector.
 */
DataSender.prototype.onCollectorResponse = function (message, response) {
  response.on('end', function () {
    logger.debug("Finished receiving data back from the collector for %s.", message);
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    logger.error("Got %s as a response code from the collector.",
                 response.statusCode);
    var error = new Error(util.format("Got HTTP %s in response to %s.",
                                      response.statusCode,
                                      message));
    error.statusCode = response.statusCode;

    return this.emit('error', message, error);
  }

  response.setEncoding('utf8');
  response.pipe(new StreamSink(this.handleMessage.bind(this, message)));
};

/**
 * Responses from the collector follow the convention:
 *
 *   { exception : { <exception JSON> },
 *     return_value : {
 *       messages : [ <messages> ],
 *       <other stuff>
 *     }
 *   }
 *
 * Exceptions are emitted as-is, as errors.
 * Anything associated with return_value is emitted as a response on
 * the DataSender.
 *
 * @param string message The message type sent to the collector.
 * @param error  error   The error, if any, resulting from decoding the
 *                       response.
 * @param string body    The body of the response.
 */
DataSender.prototype.handleMessage = function (message, error, body) {
  if (error) return this.emit('error', message, error);

  var json = JSON.parse(body);
  // can be super verbose, but useful for debugging
  logger.trace({response : json}, "Got back from from collector:");

  // If we get messages back from the collector, be polite and pass them along.
  var returned = json[RESPONSE_VALUE_NAME];
  if (returned && returned.messages) {
    returned.messages.forEach(function (element) {
      logger.info(element.message);
    });
  }

  /* If there's an exception, wait to return it until any messages have
   * been passed along.
   */
  if (json.exception) {
    return this.emit('error', message, json.exception);
  }

  return this.emit('response', returned);
};

/**
 * See the constants list for the format string (and the URL that explains it).
 */
DataSender.prototype.getUserAgent = function () {
  return util.format(USER_AGENT_FORMAT,
                     this.config.version,
                     process.versions.node,
                     process.platform,
                     process.arch);
};

/**
 * This method implies proxy support, but it's completely untested
 * (and mostly undocumented in the config).
 *
 * FIXME tested, more robust proxy support
 * FIXME use the newer "RESTful" URLs
 *
 * @param   string message The message type sent to the collector.
 *
 * @returns string The URL path to be POSTed to.
 */
DataSender.prototype.getURL = function (message) {
  var query = {
      marshal_format   : 'json',
      protocol_version : PROTOCOL_VERSION,
      license_key      : this.config.license_key,
      method           : message
  };

  if (this.config.run_id) query[RUN_ID_NAME] = this.config.run_id;

  var formatted = url.format({
    pathname : RAW_METHOD_PATH,
    query    : query
  });

  if (this.config.proxy_host) {
    return 'http://' + this.config.host + ':' + this.config.port + formatted;
  }
  else {
    return formatted;
  }
};

/**
 *
 * @param number  length     Length of data to be sent.
 * @param boolean compressed Whether the data are compressed.
 */
DataSender.prototype.getHeaders = function (length, compressed) {
  var agent = this.getUserAgent();

  var headers = {
    'User-Agent'       : agent,
    'Connection'       : 'Keep-Alive',
    // select the virtual host on the server end
    'Host'             : this.config.host,
    'Content-Length'   : length
  };

  if (compressed) {
    headers[ENCODING_HEADER]     = COMPRESSED_ENCODING;
    headers[CONTENT_TYPE_HEADER] = COMPRESSED_CONTENT_TYPE;
  }
  else {
    headers[ENCODING_HEADER]     = DEFAULT_ENCODING;
    headers[CONTENT_TYPE_HEADER] = DEFAULT_CONTENT_TYPE;
  }

  return headers;
};

/**
 * FLN pretty much decided on his own recognizance that 64K was a good point
 * at which to compress a server response. There's only a loose consensus that
 * the threshold should probably be much higher than this, if only to keep the
 * load on the collector down.
 *
 * FIXME: come up with a better heuristic
 */
DataSender.prototype.shouldCompress = function (data) {
  return data && Buffer.byteLength(data, 'utf8') > 65536;
};

module.exports = DataSender;
