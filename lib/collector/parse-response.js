'use strict'

var format = require('util').format
var logger = require('../logger').child({component: 'new_relic_response'})

var RESPONSE_VALUE_NAME = 'return_value'


/**
 * The collector has many ways of indicating failure, and isn't
 * necessarily consistent. Because there can either be a failure at
 * the network level, a nonstandard HTTP status code on the response,
 * or a JSON-encoded exception in the response body, there's a lot of
 * conditional logic in here that tries to grab as much information
 * about errors as possible, and to parse out the return value as often
 * as possible.
 *
 * @param string         name     Remote method name that was invoked.
 * @param ServerResponse response HTTP response stream
 * @param Function       callback Function that will be called with any
 *                                error, the value returned by the server
 *                                (if any), and the raw JSON of the
 *                                server's response.
 *
 * @returns Function Another callback that is meant to be invoked with
 *                   any errors from reading the response stream, as
 *                   well as a string containing the full response.
 */
module.exports = function parse(name, response, callback) {
  if (!callback) {
    throw new TypeError('callback required!')
  }
  if (!name) {
    return callback(new TypeError('collector method name required!'))
  }
  if (!response) {
    return callback(new TypeError('HTTP response required!'))
  }

  return function parser(inError, body) {
    /* jshint maxdepth:4 */

    var code = response.statusCode
    var errors = []
    var json
    var returned


    if (code !== 200) logger.debug("Got %s as a response code from the collector.", code)

    if (inError) errors.push(inError)

    if (body) {
      try {
        json = JSON.parse(body)

        // Can be super verbose, but useful for debugging.
        logger.trace({response: json}, "Deserialized from collector:")

        // If we get messages back from the collector, be polite and pass them along.
        returned = json[RESPONSE_VALUE_NAME]
        if (returned && returned.messages) {
          returned.messages.forEach(function logMessage(element) {
            logger.info(element.message)
          })
        }
      } catch (error) {
        logger.trace(error, 'Could not parse response from the collector: %s', body)
        errors.push(error)
      }
    } else {
      errors.push(new Error(format('No body found in response to %s.', name)))
    }

    if (code !== 200) {
      errors.push(new Error(format('Got HTTP %s in response to %s.', code, name)))
    }

    var error
    if (errors.length > 0) {
      error = errors.shift()
      error.statusCode = code
      error.laterErrors = (errors.length > 0) ? errors : undefined
    }

    // Raw json is useful for testing and logging.
    process.nextTick(function fireCallback() {
      callback(error, returned, json)
    })
  }
}
