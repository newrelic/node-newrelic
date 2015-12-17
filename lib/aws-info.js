'use strict'

var logger = require('./logger.js').child({component: 'aws-info'})
var http = require('http')
var NAMES = require('./metrics/names.js')
var concat = require('concat-stream')

module.exports = fetchAWSInfo
module.exports.clearCache = function clearAWSCache() {
  resultDict = null
}

var resultDict

function fetchAWSInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_aws) {
    return callback(null)
  }

  if (resultDict) return callback(resultDict)

  awsQuery('instance-type', agent, function getInstanceType(type) {
    if (type === null) return callback(null)
    awsQuery('instance-id', agent, function getInstanceId(id) {
      if (id === null) return callback(null)
      awsQuery('placement/availability-zone', agent, function getZone(zone) {
        if (zone === null) return callback(null)
        resultDict = {
          type: type,
          id: id,
          zone: zone
        }
        return callback(resultDict)
      })
    })
  })
}


function awsQuery(key, agent, callback) {
  var instanceHost = '169.254.169.254'
  var apiVersion = '2008-02-01'
  var url = ['http:/', instanceHost, apiVersion, 'meta-data', key].join('/')
  var req = http.get(url, function awsRequest(res) {
    res.pipe(concat(respond))
    function respond(data) {
      var valid = checkResponseString(data)
      data = data.toString('utf8')
      if (!valid) {
        var awsError = agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.AWS_ERROR)
        awsError.incrementCallCount()
        logger.debug('Response for attribute ' + key + ': %s'
          , data)
        data = null
      }
      callback(data)
    }
  })
  req.setTimeout(1000, function awsTimeout() {
    logger.debug('Request for attribute ' + key + ' timed out')
    callback(null)
  })
  req.on('error', function awsError(err) {
    logger.debug('Message for attribute ' + key + ': %s'
      , err.message)
    callback(null)
  })
}

function checkResponseString(str) {
  var validCharacters = /[0-9a-zA-Z_ ./-]/
  var valid = str.length <= 255 && str.length > 0

  var i = 0
  var len = str.length

  while (valid && i < len) {
    valid = valid && (str[i] > 127 || String.fromCharCode(str[i]).match(validCharacters))
    i++
  }

  return valid
}
