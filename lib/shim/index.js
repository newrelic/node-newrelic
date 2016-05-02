'use strict'

var Shim = require('./shim')
var DatastoreShim = require('./DatastoreShim')

exports.Shim = Shim
exports.DatastoreShim = DatastoreShim

exports.extend = function extendAgent(agent) {
  agent.instrument = function instrument(name, spec) {
    agent.onLoad(name, _onLoad(Shim, spec))
  }

  agent.instrumentDatastore = function instrumentDatastore(name, spec) {
    agent.onLoad(name, _onLoad(DatastoreShim, spec))
  }

  function _onLoad(ShimType, spec) {
    return function onLoadHandler(nodule) {
      var shim = new ShimType(agent)
      shim.execute(nodule, spec)
    }
  }
}
