/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// XXX We are not instrumenting bluebird's cancellation feature because it seems
// rather like an edge case feature. It is not enabled by default and has strange
// effects on the interface. If our lack of support for cancellation becomes an
// issue we can revisit this decision.
//
// http://bluebirdjs.com/docs/api/cancellation.html

module.exports = function initialize(agent, bluebird, moduleName, shim) {
  const Promise = bluebird.Promise
  const proto = Promise && Promise.prototype
  if (!proto) {
    shim.logger.debug('Could not find promise prototype, not instrumenting.')
    return false
  }

  shim.setClass(Promise)

  // _resolveFromResolver is in bluebird 2.x
  // _execute is in bluebird 3.x
  shim.wrapExecutorCaller(proto, ['_execute', '_resolveFromResolver'])
  shim.wrapThen(proto, [
    'asCallback',
    'done',
    'each',
    'filter',
    'finally',
    'lastly',
    'map',
    'mapSeries',
    'nodeify',
    'reduce',
    'spread',
    'tap',
    'tapCatch',
    'then'
  ])
  shim.wrapCatch(proto, ['catch', 'caught', 'error'])
  shim.wrapCast(proto, [
    'all',
    'any',
    'bind',
    'call',
    'catchReturn',
    'catchThrow',
    'delay',
    'get',
    'props',
    'race',
    'reflect',
    'return',
    'some',
    'thenReturn',
    'thenThrow',
    'throw',
    'timeout'
  ])

  shim.wrapCast(Promise, [
    'all',
    'allSettled',
    'any',
    'attempt',
    'bind',
    'cast',
    'delay',
    'each',
    'filter',
    'fromCallback',
    'fromNode',
    'fulfilled',
    'join',
    'map',
    'mapSeries',
    'props',
    'race',
    'reduce',
    'reject',
    'rejected',
    'resolve',
    'some',
    'try'
  ])
  shim.wrapPromisify(Promise, ['coroutine', 'method', 'promisify'])

  // Using `getNewLibraryCopy` needs to trigger re-instrumenting.
  shim.wrap(bluebird.Promise, 'getNewLibraryCopy', function wrapNewCopy(shim, original) {
    return function wrappedNewCopy() {
      shim.logger.trace('Instrumenting new library copy...')
      const copy = original.apply(this, arguments)
      module.exports(agent, copy, moduleName, shim)
      return copy
    }
  })

  // Need to copy over `coroutine.addYieldHandler`
  const coroutine = Promise && Promise.coroutine
  if (shim.isWrapped(coroutine)) {
    const original = shim.getOriginal(coroutine)
    coroutine.addYieldHandler = original && original.addYieldHandler
  }
}
