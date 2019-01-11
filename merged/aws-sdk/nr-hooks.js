'use strict'

module.exports = [{
  type: 'conglomerate',
  moduleName: 'aws-sdk',
  onRequire: require('./lib/instrumentation')
}]
