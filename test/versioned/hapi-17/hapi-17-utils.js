'use strict'

exports.getServer = function getServer(cfg) {
  cfg = cfg || {}
  var host = cfg.host || 'localhost'
  var port = cfg.port || 0
  var opts = cfg.options || {}
  var hapi = cfg.hapi || require('hapi')

  // v17
  return new hapi.Server(Object.assign({}, opts, { host: host, port: port }))
}
