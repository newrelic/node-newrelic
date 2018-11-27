'use strict'

const CollectorResponse = require('./response')
const logger = require('../logger').child({component: 'collector_response_codes'})

module.exports = {
  /**
   * Bad request -- discard
   */
  400: (err, returned, method, cb) => {
    logger.error(
      err,
      'Bad request to New Relic %s method; discarding data',
      method.name
    )
    cb(null, CollectorResponse.success(returned))
  },
  /**
   * Authentication failure -- restart
   */
  401: (err, returned, method, cb, api) => {
    logger.error(
      err,
      'Your New Relic license key appears to be invalid. Please double-check it:'
    )
    return api._restart(function onRestart() {
      cb(null, CollectorResponse.success(returned))
    })
  },
  /**
   * Forbidden -- discard
   */
  403: (err, returned, method, cb) => {
    cb(null, CollectorResponse.success(returned))
  },
  /**
   * Not found -- discard
   */
  404: (err, returned, method, cb) => {
    logger.error(
      err,
      'Unable to find requested resource in %s call; discarding data',
      method.name
    )
    cb(null, CollectorResponse.success(returned))
  },
  /**
   * Method not allowed -- discard
   */
  405: (err, returned, method, cb) => {
    logger.error(
      err,
      'Invalid HTTP method for %s call; discarding data',
      method.name
    )
    cb(null, CollectorResponse.success(returned))
  },
  /**
   * Proxy authentication required -- discard
   */
  407: (err, returned, method, cb) => {
    logger.error(
      err,
      'New Relic returned a response that requires proxy authentication. ' +
      'Please check your proxy configuration.'
    )
    cb(null, CollectorResponse.success(returned))
  },
  /**
   * Request timeout -- retain
   */
  408: (err, returned, method, cb) => {
    logger.warn(
      'Request to New Relic has timed out. Review your network settings. ' +
      'If this regularly occurs, reach out to New Relic support.'
    )
    cb(null, CollectorResponse.error(returned))
  },
  /**
   * Conflict -- discard
   */
  409: (err, returned, method, cb, api) => {
    logger.info(
      err,
      'The New Relic collector requested a connection restart on %s:',
      method.name
    )
    return api._restart(function onRestart() {
      cb(null, CollectorResponse.success(returned))
    })
  },
  /**
   * Gone -- discard and shutdown
   */
  410: (err, returned, method, cb, api) => {
    logger.error(err, `The New Relic collector is shutting down this agent:`)

    return api._agent.stop(function onShutdown() {
      cb(null, CollectorResponse.fatal(returned))
    })
  },
  /**
   * Length required -- discard
   */
  411: (err, returned, method, cb) => {
    logger.warn(
      'New Relic %s call was missing required Content-Length header.',
      method.name
    )
    cb(null, CollectorResponse.error(returned))
  },
  /**
   * Request entity too large -- discard
   */
  413: (err, returned, method, cb) => {
    logger.error(
      err,
      'This call of %s sent New Relic too much data; discarding (%s):',
      method.name,
      413
    )
    cb(null, CollectorResponse.success(returned))
  },
  /**
   * Request URI too long -- discard
   */
  414: (err, returned, method, cb) => {
    logger.warn('New Relic %s request URI too long; discarding data', method.name)
    cb(null, CollectorResponse.success(returned))
  },
  /**
   * Unsupported media type -- discard
   */
  415: (err, returned, method, cb) => {
    logger.error(
      err,
      `The New Relic collector couldn't deserialize data; discarding for %s (%s):`,
      method,
      415
    )
    cb(null, CollectorResponse.success(returned))
  },
  /**
   * Expectation failed -- discard
   */
  417: (err, returned, method, cb) => {
    logger.warn('New Relic %s expectation failed; discarding data', method.name)
    cb(null, CollectorResponse.success(returned))
  },
  /**
   * Too many requests -- retain
   */
  429: (err, returned, method, cb) => {
    logger.warn(
      'New Relic %s endpoint experiencing too many requests; reattempting',
      method.name
    )
    cb(null, CollectorResponse.retry(0, returned)) // TODO: how much delay?
  },
  /**
   * Request header fields too large -- discard
   */
  431: (err, returned, method, cb) => {
    logger.warn('New Relic %s request headers too large; discarding data', method.name)
    cb(null, CollectorResponse.success(returned))
  },
  /**
   * Internal server error -- retain
   */
  500: (err, returned, method, cb) => {
    logger.error(
      err,
      `New Relic's servers encountered a severe internal error on %s (%s):`,
      method.name,
      500
    )
    cb(null, CollectorResponse.error(returned))
  },
  /**
   * Service unavailable -- retain
   */
  503: (err, returned, method, cb) => {
    logger.debug(
      err,
      'New Relic is experiencing a spot of bother; please hold on (%s):',
      503
    )
    cb(null, CollectorResponse.error(returned))
  }
}
