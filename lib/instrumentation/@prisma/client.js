/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/**
 * Instruments the `prisma/client` module, function that is
 * passed to `onRequire` when instantiating instrumentation.
 *
 * @param {object} _agent - NewRelic agent
 * @param {object} prismaClient - The prismaClient library definition
 * @param prisma
 * @param Prisma
 * @param {string} _moduleName - String representation of require/import path
 * @param {object} shim - shim for instrumentation
 */
module.exports = function initialize(_agent, prisma, _moduleName, shim) {
  shim.setDatastore(shim.PRISMA)
  shim.setParser(queryParser)

  if (!shim.isWrapped(prisma, 'PrismaClient')) {
    shim.wrapReturn(prisma, 'PrismaClient', (shim, fn, fnName, client) => {
      clientPostConstructor.call(client, shim)
    })
  }

  function clientPostConstructor(shim) {
    // Do not know the way testing recordOperation
    // shim.recordOperation(this, ['$connect', '$disconnect'], { callback: shim.LAST })
    shim.recordQuery(this, '_request', prismaClientQueryWrapper)
  }
}

function queryParser(method) {
  const [model, action] = method.split('.')

  return {
    collection: model,
    operation: action
  }
}
function prismaClientQueryWrapper(shim, _, __, queryArgs) {
  return {
    callback: shim.LAST,
    promise: true,
    query: queryArgs[0].clientMethod
  }
}
