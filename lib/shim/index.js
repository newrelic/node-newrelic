/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Shim = require('./shim')
const ConglomerateShim = require('./conglomerate-shim')
const DatastoreShim = require('./datastore-shim')
const MessageShim = require('./message-shim')
const PromiseShim = require('./promise-shim')
const TransactionShim = require('./transaction-shim')
const WebFrameworkShim = require('./webframework-shim')
const properties = require('../util/properties')
const InstrumentationDescriptor = require('../instrumentation-descriptor')
const SHIM_TYPE_MAP = Object.create(null)
SHIM_TYPE_MAP[InstrumentationDescriptor.TYPE_GENERIC] = Shim
SHIM_TYPE_MAP[InstrumentationDescriptor.TYPE_CONGLOMERATE] = ConglomerateShim
SHIM_TYPE_MAP[InstrumentationDescriptor.TYPE_DATASTORE] = DatastoreShim
SHIM_TYPE_MAP[InstrumentationDescriptor.TYPE_MESSAGE] = MessageShim
SHIM_TYPE_MAP[InstrumentationDescriptor.TYPE_PROMISE] = PromiseShim
SHIM_TYPE_MAP[InstrumentationDescriptor.TYPE_TRANSACTION] = TransactionShim
SHIM_TYPE_MAP[InstrumentationDescriptor.TYPE_WEB_FRAMEWORK] = WebFrameworkShim

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

exports.Shim = Shim
exports.ConglomerateShim = ConglomerateShim
exports.DatastoreShim = DatastoreShim
exports.MessageShim = MessageShim
exports.PromiseShim = PromiseShim
exports.TransactionShim = TransactionShim
exports.WebFrameworkShim = WebFrameworkShim
exports.createShimFromType = createShimFromType
