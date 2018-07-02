'use strict'

module.exports = [{
  type: 'generic',
  moduleName: 'superagent',
  onRequire: require('./lib/instrumentation')
}]
