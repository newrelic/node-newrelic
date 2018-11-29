'use strict'

const CollectorResponse = require('./response')
const logger = require('../logger').child({component: 'collector_response_codes'})

const CollectorResponseRestart = new Set([401, 409])
const CollectorResponseFailureSaveData = new Set([408, 429, 500, 503])
const CollectorResponseFailureDiscardData = new Set(
  [400, 403, 404, 405, 407, 411, 413, 414, 415, 417, 431]
)

function logError(err, endpoint, code, action) {
  logger.error(err, 'Agent endpoint %s returned %s status. %s', endpoint, code, action)
}

function handleErrorCode(err, returned, endpoint, cb, api) {
  const code = err.statusCode

  if (CollectorResponseRestart.has(code)) {
    logError(err, endpoint, code, 'Restarting.')

    api._restart(() => {})
    return setImmediate(() => cb(null, CollectorResponse.success(returned)))
  } else if (CollectorResponseFailureDiscardData.has(code)) {
    logError(err, endpoint, code, 'Discarding harvest data.')

    return setImmediate(() => cb(null, CollectorResponse.success(returned)))
  } else if (CollectorResponseFailureSaveData.has(code)) {
    logError(err, endpoint, code, 'Retaining data for next harvest.')

    return setImmediate(() => cb(null, CollectorResponse.error(returned)))
  } else if (code === 410) {
    logError(err, endpoint, code, 'Disconnecting from New Relic.')

    return api._agent.stop(function onShutdown() {
      cb(null, CollectorResponse.fatal(returned))
    })
  }

  logger.error(
    err,
    'Agent endpoint %s returned unexpected status %s.',
    endpoint,
    code
  )
  return setImmediate(() => cb(null, CollectorResponse.success(returned)))
}

module.exports = handleErrorCode
