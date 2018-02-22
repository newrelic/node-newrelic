'use strict'

module.exports = [{
  type: 'web-framework',
  moduleName: 'koa',
  onRequire: require('./lib/instrumentation') // TODO: update file name
}]
