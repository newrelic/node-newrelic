'use strict'

var recordExternal = require('../../metrics/recorders/http_external')
var NAMES = require('../../metrics/names')
var urltils = require('../../util/urltils')
var hashes = require('../../util/hashes')
var logger = require('../../logger').child({component: 'outbound'})
var shimmer = require('../../shimmer')

const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 80
const DEFAULT_SSL_PORT = 443

/**
 * Instruments an outbound HTTP request.
 *
 * @param {Agent} agent
 * @param {object} opts
 * @param {function} makeRequest
 *
 * @return {http.ClientRequest} The instrumented outbound request.
 */
module.exports = function instrumentOutbound(agent, opts, makeRequest) {
  let hostname = opts.hostname || opts.host || DEFAULT_HOST
  let port = opts.port || opts.defaultPort
  if (!port) {
    port = (!opts.protocol || opts.protocol === 'http:') ? DEFAULT_PORT : DEFAULT_SSL_PORT
  }

  if (!hostname || port < 1) {
    logger.warn(
      'Invalid host name (%s) or port (%s) for outbound request.',
      hostname, port
    )
    return makeRequest()
  }

  // Technically we shouldn't append the port if this is an https request on 443
  // but due to legacy issues we can't do that without moving customer's cheese.
  //
  // TODO: Move customers cheese by not appending the default port for https.
  if (port && port !== DEFAULT_PORT) {
    hostname += ':' + port
  }

  const name = NAMES.EXTERNAL.PREFIX + hostname

  return agent.tracer.addSegment(
    name,
    recordExternal(hostname, 'http'),
    null,
    false,
    instrumentRequest
  )

  function instrumentRequest(segment) {
    segment.start()
    const request = makeRequest()
    const parsed = urltils.scrubAndParseParameters(request.path)
    const proto = parsed.protocol || opts.protocol || 'http:'
    segment.name += parsed.path
    request.__NR_segment = segment

    if (parsed.parameters) {
      // Scrub and parse returns on object with a null prototype.
      for (let key in parsed.parameters) { // eslint-disable-line guard-for-in
        segment.parameters[`request.parameters.${key}`] = parsed.parameters[key]
      }
    }
    segment.parameters.url = `${proto}//${hostname}${parsed.path}`

    // Wrap the emit method. We're doing a special wrapper instead of using
    // `tracer.bindEmitter` because we want to do some logic based on certain
    // events.
    shimmer.wrapMethod(request, 'request.emit', 'emit', function wrapEmit(emit) {
      const boundEmit = agent.tracer.bindFunction(emit, segment)
      return function wrappedRequestEmit(evnt, arg) {
        if (evnt === 'error') {
          segment.end()
          handleError(segment, request, arg)
        } else if (evnt === 'response') {
          handleResponse(segment, hostname, request, arg)
        }

        return boundEmit.apply(this, arguments)
      }
    })
    _makeNonEnumerable(request, 'emit')

    return request
  }
}

/**
 * Notices the given error if there is no listener for the `error` event on the
 * request object.
 *
 * @param {TraceSegment} segment
 * @param {http.ClientRequest} req
 * @param {Error} error
 *
 * @return {bool} True if the error will be collected by New Relic.
 */
function handleError(segment, req, error) {
  if (req.listenerCount('error') > 0) {
    logger.trace(
      error,
      'Not capturing outbound error because user has already handled it.'
    )
    return false
  }

  logger.trace(error, 'Captured outbound error on behalf of the user.')
  const tx = segment.transaction
  tx.agent.errors.add(tx, error)
  return true
}

/**
 * Ties the response object to the request segment.
 *
 * @param {TraceSegment} segment
 * @param {string} hostname
 * @param {http.ClientRequest} req
 * @param {http.IncomingMessage} res
 */
function handleResponse(segment, hostname, req, res) {
  // If CAT is enabled, grab those headers!
  const agent = segment.transaction.agent
  if (
    agent.config.cross_application_tracer.enabled &&
    !agent.config.feature_flag.distributed_tracing
  ) {
    pullCatHeaders(agent.config, segment, hostname, res.headers['x-newrelic-app-data'])
  }

  // Again a custom emit wrapper because we want to watch for the `end` event.
  shimmer.wrapMethod(res, 'response', 'emit', function wrapEmit(emit) {
    var boundEmit = agent.tracer.bindFunction(emit, segment)
    return function wrappedResponseEmit(evnt) {
      if (evnt === 'end') {
        segment.end()
      }
      return boundEmit.apply(this, arguments)
    }
  })
  _makeNonEnumerable(res, 'emit')
}

function pullCatHeaders(config, segment, host, obfAppData) {
  if (!config.encoding_key) {
    logger.trace('config.encoding_key is not set - not parsing response CAT headers')
    return
  }

  if (!config.trusted_account_ids) {
    logger.trace(
      'config.trusted_account_ids is not set - not parsing response CAT headers'
    )
    return
  }

  // is our downstream request CAT-aware?
  if (!obfAppData) {
    logger.trace('Got no CAT app data in response header x-newrelic-app-data')
  } else {
    var appData = null
    try {
      appData = JSON.parse(hashes.deobfuscateNameUsingKey(obfAppData,
                                                          config.encoding_key))
    } catch (e) {
      logger.warn('Got an unparsable CAT header x-newrelic-app-data: %s', obfAppData)
      return
    }
    // Make sure it is a trusted account
    if (appData.length && typeof appData[0] === 'string') {
      var accountId = appData[0].split('#')[0]
      accountId = parseInt(accountId, 10)
      if (config.trusted_account_ids.indexOf(accountId) === -1) {
        logger.trace('Response from untrusted CAT header account id: %s', accountId)
      } else {
        segment.catId = appData[0]
        segment.catTransaction = appData[1]
        segment.name = NAMES.EXTERNAL.TRANSACTION + host + '/' +
                       segment.catId + '/' + segment.catTransaction
        if (appData.length >= 6) {
          segment.parameters.transaction_guid = appData[5]
        }
        logger.trace('Got inbound response CAT headers in transaction %s',
          segment.transaction.id)
      }
    }
  }
}

function _makeNonEnumerable(obj, prop) {
  try {
    var desc = Object.getOwnPropertyDescriptor(obj, prop)
    desc.enumerable = false
    Object.defineProperty(obj, prop, desc)
  } catch (e) {
    logger.debug(e, 'Failed to make %s non enumerable.', prop)
  }
}
