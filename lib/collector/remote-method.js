'use strict'

var path    = require('path')
  , util    = require('util')
  , url     = require('url')
  , http    = require('http')
  , https   = require('https')
  , deflate = require('zlib').deflate
  , logger  = require('../logger.js')
                .child({component : 'remote_method_invoke'})
  , parse   = require('./parse-response.js')
  , Sink    = require('../util/stream-sink.js')
  , agents  = require('./http-agents.js')


/*
 *
 * CONSTANTS
 *
 */
var PROTOCOL_VERSION        = 12
  , RUN_ID_NAME             = 'run_id'
  , RAW_METHOD_PATH         = '/agent_listener/invoke_raw_method'
  // see job/collector-master/javadoc/com/nr/servlet/AgentListener.html on NR Jenkins
  , USER_AGENT_FORMAT       = "NewRelic-NodeAgent/%s (nodejs %s %s-%s)"
  , ENCODING_HEADER         = 'CONTENT-ENCODING'
  , CONTENT_TYPE_HEADER     = 'Content-Type'
  , DEFAULT_ENCODING        = 'identity'
  , DEFAULT_CONTENT_TYPE    = 'application/json'
  , COMPRESSED_ENCODING     = 'deflate'
  , COMPRESSED_CONTENT_TYPE = 'application/octet-stream'


function RemoteMethod(name, config) {
  if (!name) {
    throw new TypeError("Must include name of method to invoke on collector.")
  }

  this.name = name
  this._config = config
}

/**
 * The primary operation on RemoteMethod objects. If you're calling anything on
 * RemoteMethod objects aside from invoke (and you're not writing test code),
 * you're doing it wrong.
 *
 * @param object   payload    Serializable payload.
 * @param Function callback   What to do next. Gets passed any error.
 */
RemoteMethod.prototype.invoke = function call(payload, callback) {
  if (!payload) payload = []

  var serialized
  try {
    serialized = JSON.stringify(payload)
  }
  catch (error) {
    logger.error(error, "Unable to serialize payload for method %s.", this.name)
    return process.nextTick(function cb_nextTick() {
      return callback(error)
    })
  }

  this._post(serialized, callback)
}

/**
 * Take a serialized payload and create a response wrapper for it before
 * invoking the method on the collector.
 *
 * @param string   methodName Name of method to invoke on collector.
 * @param string   data       Serialized payload.
 * @param Function callback   What to do next. Gets passed any error.
 */
RemoteMethod.prototype._post = function _post(data, callback) {
  var method = this

  // set up standard response handling
  function onResponse(response) {
    response.on('end', function handle_end() {
      logger.debug(
        "Finished receiving data back from the collector for %s.",
        method.name
      )
    })

    response.setEncoding('utf8')
    response.pipe(new Sink(parse(method.name, response, callback)))
  }

  // IF FLAG: proxy
  if (this._config.feature_flag && this._config.feature_flag.proxy) {

  var options = {
    port       : this._config.port,
    host       : this._config.host,
    compressed : this._shouldCompress(data),
    path       : this._path(),
    onError    : callback,
    onResponse : onResponse
  }

  } else { // IF NOT FLAG: proxy

  var options = {
    port       : this._config.proxy_port || this._config.port,
    host       : this._config.proxy_host || this._config.host,
    compressed : this._shouldCompress(data),
    path       : this._path(),
    onError    : callback,
    onResponse : onResponse
  }

  } // END FLAG: proxy

  if (options.compressed) {
    logger.trace("Sending %s on collector API with (COMPRESSED): %s", this.name, data)

    deflate(data, function cb_deflate(err, deflated) {
      if (err) {
        logger.warn(err, "Error compressing JSON for delivery. Not sending.")
        return callback(err)
      }

      options.body = deflated
      method._safeRequest(options)
    })
  }
  else {
    logger.debug("Calling %s on collector API with: %s", this.name, data)

    options.body = data
    this._safeRequest(options)
  }
}

/**
 * http.request does its own DNS lookup, and if it fails, will cause
 * dns.lookup to throw asynchronously instead of passing the error to
 * the callback (which is obviously awesome). To prevent New Relic from
 * crashing people's applications, verify that lookup works and bail out
 * early if not.
 *
 * Also, ensure that all the necessary parameters are set before
 * actually making the request. Useful to put here to simplify test code
 * that calls _request directly.
 *
 * @param object options A dictionary of request parameters.
 */
RemoteMethod.prototype._safeRequest = function _safeRequest(options) {
  if (!options) throw new Error("Must include options to make request!")
  if (!options.host) throw new Error("Must include collector hostname!")
  if (!options.port) throw new Error("Must include collector port!")
  if (!options.onError) throw new Error("Must include error handler!")
  if (!options.onResponse) throw new Error("Must include response handler!")
  if (!options.body) throw new Error("Must include body to send to collector!")
  if (!options.path) throw new Error("Must include URL to request!")

  var protocol = this._config.ssl ? 'https' : 'http'
  logger.trace(
    {body : options.body},
    "Posting to " + protocol + "://%s:%s%s",
    options.host,
    options.port,
    options.path
  )

  this._request(options)
}

/**
 * Generate the request headers and wire up the request. There are many
 * parameters used to make a request:
 *
 * @param string   options.host       Hostname (or proxy hostname) for collector.
 * @param string   options.port       Port (or proxy port) for collector.
 * @param string   options.path       URL path for method being invoked on collector.
 * @param string   options.body       Serialized payload to be sent to collector.
 * @param boolean  options.compressed Whether the payload has been compressed.
 * @param Function options.onError    Error handler for this request (probably the
 *                                    original callback given to .send).
 * @param Function options.onResponse Response handler for this request (created by
 *                                    ._post).
 */
RemoteMethod.prototype._request = function _request(options) {
  var requestOptions = {
    method           : 'POST',
    setHost          : false,         // see below
    host             : options.host,  // set explicitly in the headers
    port             : options.port,
    path             : options.path,
    headers          : this._headers(options.body, options.compressed),
    __NR__connection : true           // who measures the metrics measurer?
  }

  var request

  // FLAG: proxy
  if (this._config.feature_flag && this._config.feature_flag.proxy) {

  var isProxy = !!(
    this._config.proxy      ||
    this._config.proxy_port ||
    this._config.proxy_host
  )

  if (isProxy) {
    // proxy
    requestOptions.agent = agents.proxyAgent(this._config)
    request = https.request(requestOptions)

    // FIXME: The agent keeps this connection open when using the proxy.
    // This will prevent the application from shutting down correctly.
    // Explicitly destroy the socket when the response is completed.
    //
    // This goes against keep-alive, but for now letting the application die
    // gracefully is more important.
    request.on('response', function cb_on_response(sock){
      sock.on('end', function cb_on_end(){
        sock.destroy()
      })
    })
  }
  else if (this._config.ssl) {
    requestOptions.agent = agents.https
    request = https.request(requestOptions)
  }
  else {
    requestOptions.agent = agents.http
    request = http.request(requestOptions)
  }

  }else{ // FLAG: proxy

  if (this._config.ssl) {
    requestOptions.agent = agents.https
    request = https.request(requestOptions)
  }
  else {
    requestOptions.agent = agents.http
    request = http.request(requestOptions)
  }

  }// FLAG: proxy
  request.on('error',    options.onError)
  request.on('response', options.onResponse)

  request.end(options.body)
}

/**
 * See the constants list for the format string (and the URL that explains it).
 */
RemoteMethod.prototype._userAgent = function _userAgent() {
  return util.format(USER_AGENT_FORMAT,
                     this._config.version,
                     process.versions.node,
                     process.platform,
                     process.arch)
}

/**
 * Generate a URL the collector understands.
 *
 * @returns string The URL path to be POSTed to.
 */
RemoteMethod.prototype._path = function _path() {
  var query = {
      marshal_format   : 'json',
      protocol_version : PROTOCOL_VERSION,
      license_key      : this._config.license_key,
      method           : this.name
  }

  if (this._config.run_id) query[RUN_ID_NAME] = this._config.run_id

  var formatted = url.format({
    pathname : RAW_METHOD_PATH,
    query    : query
  })

  return formatted
}

/**
 * @param number  length     Length of data to be sent.
 * @param boolean compressed Whether the data are compressed.
 */
RemoteMethod.prototype._headers = function _headers(body, compressed) {
  var agent = this._userAgent()

  var headers = {
    // select the virtual host on the server end
    'Host'           : this._config.host,
    'User-Agent'     : agent,
    'Connection'     : 'Keep-Alive',
    'Content-Length' : byte_length(body)
  }

  if (compressed) {
    headers[ENCODING_HEADER]     = COMPRESSED_ENCODING
    headers[CONTENT_TYPE_HEADER] = COMPRESSED_CONTENT_TYPE
  }
  else {
    headers[ENCODING_HEADER]     = DEFAULT_ENCODING
    headers[CONTENT_TYPE_HEADER] = DEFAULT_CONTENT_TYPE
  }

  return headers
}

/**
 * FLN pretty much decided on his own recognizance that 64K was a good point
 * at which to compress a server response. There's only a loose consensus that
 * the threshold should probably be much higher than this, if only to keep the
 * load on the collector down.
 *
 * FIXME: come up with a better heuristic
 */
RemoteMethod.prototype._shouldCompress = function _shouldCompress(data) {
  return data && byte_length(data) > 65536
}

function byte_length(data) {
  if(!data) {
    return 0
  } else if(data instanceof Buffer) {
    return data.length
  } else {
    return Buffer.byteLength(data, 'utf8')
  }
}

module.exports = RemoteMethod
