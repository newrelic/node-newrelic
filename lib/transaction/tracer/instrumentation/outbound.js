'use strict'

var recordExternal = require('../../../metrics/recorders/http_external.js')
var NAMES = require('../../../metrics/names.js')
var urltils = require('../../../util/urltils.js')
var hashes = require('../../../util/hashes')
var logger = require('../../../logger').child({component: 'outbound'})

var DEFAULT_PORT = 80

function instrumentOutbound(agent, hostname, port, makeRequest) {
  if (!hostname) throw new Error('hostname must be defined!')
  if (!port || port < 1) throw new Error('port must be defined!')
  if (port && port !== DEFAULT_PORT) hostname = hostname + ':' + port

  var transaction = agent.tracer.getTransaction()
  var name = NAMES.EXTERNAL.PREFIX + hostname

  return agent.tracer.addSegment(
    name,
    recordExternal(hostname, 'http'),
    null,
    false,
    instrumentRequest
  )

  function instrumentRequest(segment) {
    var request = makeRequest()
    segment.start()
    segment.name += urltils.scrub(request.path)

    var params = urltils.parseParameters(request.path)
    urltils.copyParameters(agent.config, params, segment.parameters)

    // may trace errors multiple times, make that the error tracer's problem
    request.once('error', function handleError(error) {
      segment.end()

      var hasListener = (
        (Array.isArray(request._events.error) && request._events.error.length)
        || (!Array.isArray(request._events.error) && request._events.error)
      )

      if (hasListener) {
        logger.trace(
          error,
          'Not capturing outbound error because user has already handled it.'
        )
        return
      }

      /* we should be calling request.emit('error', error) here. We currently
       * do not do this because the agent has historically swallowed these
       * errors, re enabling them may cause unexpected errors to buble up in
       * code that depends on this behavior.
       */
      logger.trace(
        error,
        'Captured outbound error on behalf of the user (normally an uncaught exception).'
      )
      agent.errors.add(transaction, error)
    })

    // Pop off the listeners so we can make sure our response handler happens
    // first. This is to prevent a case where the transaction ends before our
    // response handler has had a chance to pull data it needs for segment
    // metrics.
    var existingListeners = request.listeners('response').slice()
    request.removeAllListeners('response')

    request.on('response', function handle_response(res) {
      // FLAG: cat
      if (agent.config.feature_flag.cat) {
        pullCatHeaders(
          agent.config,
          segment,
          hostname,
          res.headers['x-newrelic-app-data']
        )
      }
      agent.tracer.bindEmitter(res)
      res.on('end', segment.end.bind(segment))
    })

    // Push the listeners we popped off back onto the event. See above for
    // explanation of why.
    for (var i = 0; i < existingListeners.length; i++) {
      request.on('response', existingListeners[i])
    }

    // ensure listeners are evaluated in correct transactional scope
    agent.tracer.bindEmitter(request)
    return request
  }
}

function pullCatHeaders(config, segment, host, obfAppData) {
  if (config.encoding_key && config.trusted_account_ids) {
    // is our downstream request CAT-aware?
    if (obfAppData) {
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
        if (config.trusted_account_ids.indexOf(accountId) !== -1) {
          segment.catId = appData[0]
          segment.catTransaction = appData[1]
          segment.name = NAMES.EXTERNAL.TRANSACTION + host + '/' +
                         segment.catId + '/' + segment.catTransaction
          if (appData.length >= 6) {
            segment.parameters.transaction_guid = appData[5]
          }
        }
      }
    }
  }
}

module.exports = instrumentOutbound
