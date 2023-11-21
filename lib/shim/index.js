/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

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
const SHIM_TYPE_MAP = Object.create(null)
SHIM_TYPE_MAP[constants.MODULE_TYPE.GENERIC] = Shim
SHIM_TYPE_MAP[constants.MODULE_TYPE.CONGLOMERATE] = ConglomerateShim
SHIM_TYPE_MAP[constants.MODULE_TYPE.DATASTORE] = DatastoreShim
SHIM_TYPE_MAP[constants.MODULE_TYPE.MESSAGE] = MessageShim
SHIM_TYPE_MAP[constants.MODULE_TYPE.PROMISE] = PromiseShim
SHIM_TYPE_MAP[constants.MODULE_TYPE.TRANSACTION] = TransactionShim
SHIM_TYPE_MAP[constants.MODULE_TYPE.WEB_FRAMEWORK] = WebFrameworkShim

/**
 *
 * @param {object} params input params
 * @param {string} params.type shim type
 * @param {Agent} params.agent instance of agent
 * @param {string} params.moduleName module name
 * @param {string} params.resolvedName fully resolved name of module
 * @param {string} params.shimName name of shim, used to associate multiple shim instances
 * @param {string} params.pkgVersion version of pkg
 * @returns {Shim} shim instance
 */
function createShimFromType({ type, agent, moduleName, resolvedName, shimName, pkgVersion }) {
  let shim = null
  if (properties.hasOwn(SHIM_TYPE_MAP, type)) {
    const ShimClass = SHIM_TYPE_MAP[type]
    shim = new ShimClass(agent, moduleName, resolvedName, shimName, pkgVersion)
  } else {
    shim = new Shim(agent, moduleName, resolvedName, shimName, pkgVersion)
  }
  return shim
}

exports.constants = constants
exports.Shim = Shim
exports.ConglomerateShim = ConglomerateShim
exports.DatastoreShim = DatastoreShim
exports.MessageShim = MessageShim
exports.PromiseShim = PromiseShim
exports.TransactionShim = TransactionShim
exports.WebFrameworkShim = WebFrameworkShim
exports.createShimFromType = createShimFromType
