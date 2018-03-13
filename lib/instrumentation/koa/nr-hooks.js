'use strict'

module.exports = [{
  type: 'web-framework',
  moduleName: 'koa',
  onRequire: require('./lib/instrumentation') // TODO: update file name
}, {
  type: 'web-framework',
  moduleName: 'koa-router',
  onRequire: require('./lib/router-instrumentation')
}]
