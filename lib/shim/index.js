'use strict'

const constants = require('./constants')

const Shim = require('./shim')
const ConglomerateShim = require('./conglomerate-shim')
const DatastoreShim = require('./datastore-shim')
const MessageShim = require('./message-shim')
const PromiseShim = require('./promise-shim')
const TransactionShim = require('./transaction-shim')
const WebFrameworkShim = require('./webframework-shim')
const properties = require('../util/properties')

function createShimFromType(type, agent, moduleName, resolvedName) {
  var shim = null
  if (properties.hasOwn(SHIM_TYPE_MAP, type)) {
    var ShimClass = SHIM_TYPE_MAP[type]
    shim = new ShimClass(agent, moduleName, resolvedName)
  } else {
    shim = new Shim(agent, moduleName, resolvedName)
  }
  return shim
}

var SHIM_TYPE_MAP = Object.create(null)
SHIM_TYPE_MAP[constants.MODULE_TYPE.GENERIC] = Shim
SHIM_TYPE_MAP[constants.MODULE_TYPE.CONGLOMERATE] = ConglomerateShim
SHIM_TYPE_MAP[constants.MODULE_TYPE.DATASTORE] = DatastoreShim
SHIM_TYPE_MAP[constants.MODULE_TYPE.MESSAGE] = MessageShim
SHIM_TYPE_MAP[constants.MODULE_TYPE.PROMISE] = PromiseShim
SHIM_TYPE_MAP[constants.MODULE_TYPE.TRANSACTION] = TransactionShim
SHIM_TYPE_MAP[constants.MODULE_TYPE.WEB_FRAMEWORK] = WebFrameworkShim

exports.constants = constants
exports.Shim = Shim
exports.ConglomerateShim = ConglomerateShim
exports.DatastoreShim = DatastoreShim
exports.MessageShim = MessageShim
exports.PromiseShim = PromiseShim
exports.TransactionShim = TransactionShim
exports.WebFrameworkShim = WebFrameworkShim
exports.createShimFromType = createShimFromType
