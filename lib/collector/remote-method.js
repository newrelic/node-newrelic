/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')
const url = require('url')
const https = require('https')
const zlib = require('zlib')
const logger = require('../logger').child({ component: 'remote_method' })
const parse = require('./parse-response')
const stringify = require('json-stringify-safe')
const Sink = require('../util/stream-sink')
const agents = require('./http-agents')
const isValidLength = require('../util/byte-limit').isValidLength
const { DATA_USAGE } = require('../metrics/names')
const symbols = require('../symbols')

function getMetricName(name) {
  return `${DATA_USAGE.PREFIX}/${name}/${DATA_USAGE.SUFFIX}`
}

/*
 *
 * CONSTANTS
 *
 */
const RUN_ID_NAME = 'run_id'
const RAW_METHOD_PATH = '/agent_listener/invoke_raw_method'
// see job/collector-master/javadoc/com/nr/servlet/AgentListener.html on NR Jenkins
const USER_AGENT_FORMAT = 'NewRelic-NodeAgent/%s (nodejs %s %s-%s)'
const ENCODING_HEADER = 'CONTENT-ENCODING'
const DEFAULT_ENCODING = 'identity'

function RemoteMethod(name, agent, endpoint) {
  if (!name) {
    throw new TypeError('Must include name of method to invoke on collector.')
  }
  if (!agent) {
    throw new TypeError('Must include an agent instance.')
  }

  this.name = name
  this._config = agent.config
  this._agent = agent
  this._protocolVersion = 17

  this.endpoint = endpoint
}

RemoteMethod.prototype.updateEndpoint = function updateEndpoint(endpoint) {
  if (!endpoint) {
    return
  }

  this.endpoint = endpoint
}

RemoteMethod.prototype.serialize = function serialize(payload, callback) {
  let res
  try {
    res = stringify(payload, (key, value) => (typeof value === 'bigint' ? value.toString() : value))
  } catch (error) {
    logger.error(error, 'Unable to serialize payload for method %s.', this.name)
    return process.nextTick(function onNextTick() {
      return callback(error)
    })
  }
  return callback(null, res)
}

/**
 * This records the amount of data usage per function call and sends
 * it to the metrics.
 *
 * @param {string} sent        The serialized object we sent
 * @param {object} received    The raw object we got back as a response
 */
RemoteMethod.prototype._reportDataUsage = function reportDataUsage(sent, received) {
  const payloadByteLength = byteLength(sent)
  const responseByteLength = received ? byteLength(JSON.stringify(received)) : 0
  const measurement = [payloadByteLength, responseByteLength, true]
  this._agent.metrics.measureBytes(DATA_USAGE.COLLECTOR, ...measurement)
  this._agent.metrics.measureBytes(getMetricName(this.name), ...measurement)
}

/**
 * The primary operation on RemoteMethod objects. If you're calling anything on
 * RemoteMethod objects aside from invoke (and you're not writing test code),
 * you're doing it wrong.
 *
 * @param {object}   payload           Serializable payload.
 * @param {object}   [nrHeaders=null]  NR request headers from connect response.
 * @param {Function} callback          What to do next. Gets passed any error.
 */
RemoteMethod.prototype.invoke = function invoke(payload, nrHeaders, callback) {
  if (typeof nrHeaders === 'function') {
    callback = nrHeaders
    nrHeaders = null
  }

  if (!payload) {
    payload = []
  }
  logger.trace('Invoking remote method %s', this.name)

  this.serialize(
    payload,
    function onSerialize(err, serialized) {
      if (err) {
        return callback(err)
      }
      this._post(
        serialized,
        nrHeaders,
        function onResponse(error, res) {
          this._reportDataUsage(serialized, res && res.payload)
          callback(error, res)
        }.bind(this)
      )
    }.bind(this)
  )
}

/**
 * Take a serialized payload and create a response wrapper for it before
 * invoking the method on the collector.
 *
 * @param {string}   methodName Name of method to invoke on collector.
 * @param {string}   data       Serialized payload.
 * @param {?object}  nrHeaders  NR request headers from connect response.
 * @param {Function} callback   What to do next. Gets passed any error.
 */
RemoteMethod.prototype._post = function _post(data, nrHeaders, callback) {
  const method = this
  const options = {
    port: this.endpoint.port,
    host: this.endpoint.host,
    compressed: this._shouldCompress(data),
    path: this._path(),
    onError: callback,
    onResponse,
    nrHeaders
  }

  // Check trace enabled first since we're creating an object for this log message.
  if (logger.traceEnabled()) {
    logger.trace({ data, compressed: options.compressed }, 'Calling %s on collector API', this.name)
  }

  if (options.compressed) {
    // NOTE: gzip and deflate throw immediately in Node 14+ with an invalid argument
    try {
      const useDeflate = this._config.compressed_content_encoding === 'deflate'
      const compressor = useDeflate ? zlib.deflate : zlib.gzip
      compressor(data, function onCompress(err, compressed) {
        if (err) {
          logger.warn(err, 'Error compressing JSON for delivery. Not sending.')
          return callback(err)
        }

        options.body = compressed
        makeRequest()
      })
    } catch (err) {
      logger.warn(err, 'Error compressing JSON for delivery. Not sending.')
      return callback(err)
    }
  } else {
    options.body = data
    makeRequest()
  }

  function makeRequest() {
    try {
      method._safeRequest(options)
    } catch (err) {
      logger.warn(err, 'Failed to prepare request to collector method %s!', method.name)
      callback(err)
    }
  }

  // set up standard response handling
  function onResponse(response) {
    response.on('end', function onEnd() {
      logger.debug('Finished receiving data back from the collector for %s.', method.name)
    })

    response.setEncoding('utf8')
    response.pipe(new Sink(parse(method.name, response, callback)))
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
 * @param {object} options A dictionary of request parameters.
 */
RemoteMethod.prototype._safeRequest = function _safeRequest(options) {
  if (!options) {
    throw new Error('Must include options to make request!')
  }
  if (!options.host) {
    throw new Error('Must include collector hostname!')
  }
  if (!options.port) {
    throw new Error('Must include collector port!')
  }
  if (!options.onError) {
    throw new Error('Must include error handler!')
  }
  if (!options.onResponse) {
    throw new Error('Must include response handler!')
  }
  if (!options.body) {
    throw new Error('Must include body to send to collector!')
  }
  if (!options.path) {
    throw new Error('Must include URL to request!')
  }

  const protocol = 'https'
  const logConfig = this._config.logging
  const auditLog = this._config.audit_log
  const maxPayloadSize = this._config.max_payload_size_in_bytes
  let level = 'trace'

  if (!isValidLength(options.body, maxPayloadSize)) {
    this._agent.metrics
      .getOrCreateMetric(`${DATA_USAGE.PREFIX}/MaxPayloadSizeLimit/${this.name}`)
      .incrementCallCount()
    logger.warn(
      'The payload size %d being sent to method %s exceeded the maximum size of %d',
      Buffer.byteLength(options.body, 'utf8'),
      this.name,
      maxPayloadSize
    )
    throw new Error('Maximum payload size exceeded')
  }

  // If trace level is not explicitly enabled check to see if the audit log is
  // enabled.
  if (
    logConfig != null &&
    logConfig.level !== 'trace' &&
    auditLog.enabled &&
    (auditLog.endpoints.length === 0 || auditLog.endpoints.indexOf(this.name) > -1)
  ) {
    level = 'info'
  }

  const logBody = Buffer.isBuffer(options.body) ? 'Buffer ' + options.body.length : options.body
  logger[level](
    { body: logBody },
    'Posting to %s://%s:%s%s',
    protocol,
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
 * @param {string}   options.host       Hostname (or proxy hostname) for collector.
 * @param {string}   options.port       Port (or proxy port) for collector.
 * @param {string}   options.path       URL path for method being invoked on collector.
 * @param {string}   options.body       Serialized payload to be sent to collector.
 * @param {boolean}  options.compressed Whether the payload has been compressed.
 * @param {object}   options.nrHeaders  NR request headers passed in connect response.
 * @param {Function} options.onError    Error handler for this request (probably the
 *                                      original callback given to .send).
 * @param {Function} options.onResponse Response handler for this request (created by
 *                                      ._post).
 * @param options
 */
RemoteMethod.prototype._request = function _request(options) {
  const requestOptions = {
    method: this._config.put_for_data_send ? 'PUT' : 'POST',
    setHost: false, // See below
    host: options.host, // Set explicitly in the headers
    port: options.port,
    path: options.path,
    headers: this._headers(options),
    agent: agents.keepAliveAgent(),
    [symbols.offTheRecord]: true // don't let the http instrumentation record this request
  }
  let request

  const isProxy = !!(this._config.proxy || this._config.proxy_port || this._config.proxy_host)

  if (isProxy) {
    // proxy
    requestOptions.agent = agents.proxyAgent(this._config)
    request = https.request(requestOptions)
  } else {
    if (this._config.certificates && this._config.certificates.length > 0) {
      requestOptions.ca = this._config.certificates
    }
    request = https.request(requestOptions)
  }

  request.on('error', options.onError)
  request.on('response', options.onResponse)

  request.end(options.body)
}

/**
 * See the constants list for the format string (and the URL that explains it).
 */
RemoteMethod.prototype._userAgent = function _userAgent() {
  return util.format(
    USER_AGENT_FORMAT,
    this._config.version,
    process.versions.node,
    process.platform,
    process.arch
  )
}

/**
 * Generate a URL the collector understands.
 *
 * @returns {string} The URL path to be POSTed to.
 */
RemoteMethod.prototype._path = function _path() {
  const query = {
    marshal_format: 'json',
    protocol_version: this._protocolVersion,
    license_key: this._config.license_key,
    method: this.name
  }

  if (this._config.run_id) {
    query[RUN_ID_NAME] = this._config.run_id
  }

  return url.format({
    pathname: RAW_METHOD_PATH,
    query: query
  })
}

/**
 * @param {object} options
 * @param {number} options.body       - Data to be sent.
 * @param {object} options.nrHeaders  - NR request headers from the connect response.
 * @param {boolean}   options.compressed - The compression method used, if any.
 */
RemoteMethod.prototype._headers = function _headers(options) {
  const agent = this._userAgent()

  const headers = {
    // select the virtual host on the server end
    'Host': this.endpoint.host,
    'User-Agent': agent,
    'Connection': 'Keep-Alive',
    'Content-Length': byteLength(options.body),
    'Content-Type': 'application/json'
  }

  if (options.compressed) {
    headers[ENCODING_HEADER] = this._config.compressed_content_encoding
  } else {
    headers[ENCODING_HEADER] = DEFAULT_ENCODING
  }

  if (options.nrHeaders) {
    Object.assign(headers, options.nrHeaders)
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
 *
 * @param data
 */
RemoteMethod.prototype._shouldCompress = function _shouldCompress(data) {
  return data && byteLength(data) > 65536
}

function byteLength(data) {
  if (!data) {
    return 0
  }

  if (data instanceof Buffer) {
    return data.length
  }

  return Buffer.byteLength(data, 'utf8')
}

module.exports = RemoteMethod
