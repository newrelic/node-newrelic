'use strict'

var concat = require('concat-stream')
var http = require('http')
var logger = require('../logger').child({component: 'utilization-request'})
var fs = require('fs')
var properties = require('../util/properties')


exports.checkValueString = checkValueString
function checkValueString(str) {
  if (!str || !str.length || Buffer.byteLength(str) > 255) {
    return false
  }

  var len = str.length
  var validCharacters = /[0-9a-zA-Z_ ./-]/
  for (var i = 0; i < len; ++i) {
    if (str.charCodeAt(i) < 128 && !validCharacters.test(str[i])) {
      return false
    }
  }
  return true
}

exports.getKeys = function getKeys(data, keys) {
  if (!data) {
    return null
  }

  var results = {}
  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i]
    if (!properties.hasOwn(data, key) || !data[key]) {
      logger.debug('Key %s missing from metadata', key)
      return null
    }
    var value = data[key]
    if (typeof value === 'number') {
      value = value.toString()
    }

    // If any value is invalid, the whole thing must be trashed.
    if (!checkValueString(value)) {
      logger.debug('Invalid metadata value found: %s -> %s', key, value)
      return null
    }
    results[key] = value
  }

  return results
}

exports.request = function request(opts, agent, cb) {
  var req = http.get(opts, function awsRequest(res) {
    res.pipe(concat(respond))
    function respond(data) {
      agent.removeListener('errored', abortRequest)
      agent.removeListener('stopped', abortRequest)

      if (res.statusCode !== 200) {
        logger.debug(
          'Got %d %s from metadata request %j',
          res.statusCode, res.statusMessage || '<n/a>', opts
        )
        return cb(new Error('Request for metadata failed.'))
      } else if (!data) {
        logger.debug('Got no response data?')
        return cb(new Error('No reponse data received.'))
      }

      cb(null, data.toString('utf8'))
    }
  })

  req.setTimeout(1000, function requestTimeout() {
    logger.debug('Request for metadata %j timed out', opts)
    cb(new Error('Timeout'))
  })
  req.on('error', function requestError(err) {
    logger.debug('Message for metadata %j: %s', opts, err.message)
    cb(err)
  })

  agent.once('errored', abortRequest)
  agent.once('stopped', abortRequest)

  function abortRequest() {
    logger.debug('Aborting request for metadata at %j', opts)
    req.abort()
    agent.removeListener('errored', abortRequest)
    agent.removeListener('stopped', abortRequest)
  }
}

exports.readProc = readProc
function readProc(path, callback) {
  fs.readFile(path, function readProcFile(err, data) {
    if (err) {
      logger.error(err, 'Error when trying to read %s', path)
      callback(err, null)
    } else {
      callback(null, data.toString())
    }
  })
}
