/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../../logger').child({ component: 'async_hooks' })
const asyncHooks = require('async_hooks')

module.exports = initialize

function initialize(agent, shim) {
  if (agent.config.feature_flag.async_local_context) {
    logger.debug(
      'New AsyncLocalStorage context enabled. Not enabling manual async_hooks or promise instrumentation'
    )

    return
  }

  // this map is reused to track the segment that was active when
  // the before callback is called to be replaced in the after callback
  const segmentMap = new Map()
  module.exports.segmentMap = segmentMap

  let hookHandlers = getStandardHooks(segmentMap, agent, shim)

  if (agent.config.feature_flag.new_promise_tracking) {
    logger.info('Enabling new promise tracking style via new_promise_tracking feature flag.')
    hookHandlers = getPromiseResolveStyleHooks(segmentMap, agent, shim)
  }

  const hook = asyncHooks.createHook(hookHandlers)
  hook.enable()

  agent.on('unload', function disableHook() {
    hook.disable()
  })

  return true
}

function getStandardHooks(segmentMap, agent, shim) {
  const hooks = {
    init: function initHook(id, type, triggerId, promiseWrap) {
      if (type !== 'PROMISE') {
        return
      }

      const parentSegment = segmentMap.get(triggerId)

      if (parentSegment && !parentSegment.transaction.isActive()) {
        // Stop propagating if the transaction was ended.
        return
      }

      if (!parentSegment && !agent.getTransaction()) {
        return
      }

      const activeSegment = shim.getActiveSegment() || parentSegment
      if (promiseWrap && promiseWrap.promise) {
        promiseWrap.promise.__NR_id = id
      }
      segmentMap.set(id, activeSegment)
    },

    before: function beforeHook(id) {
      const hookSegment = segmentMap.get(id)

      if (!hookSegment) {
        return
      }

      segmentMap.set(id, shim.getActiveSegment())
      shim.setActiveSegment(hookSegment)
    },
    after: function afterHook(id) {
      const hookSegment = segmentMap.get(id)

      // hookSegment is the segment that was active before the promise
      // executed. If the promise is executing before a segment has been
      // restored, hookSegment will be null and should be restored. Thus
      // undefined is the only invalid value here.
      if (hookSegment === undefined) {
        return
      }

      segmentMap.set(id, shim.getActiveSegment())
      shim.setActiveSegment(hookSegment)
    },
    destroy: function destHook(id) {
      segmentMap.delete(id)
    }
  }

  return hooks
}

function getPromiseResolveStyleHooks(segmentMap, agent, shim) {
  const hooks = {
    init: function initHook(id, type, triggerId, asyncResource) {
      if (type !== 'PROMISE') {
        return
      }

      const parentSegment = segmentMap.get(triggerId)

      if (parentSegment && !parentSegment.transaction.isActive()) {
        // Stop propagating if the transaction was ended.
        return
      }

      if (!parentSegment && !agent.getTransaction()) {
        return
      }

      const activeSegment = shim.getActiveSegment() || parentSegment
      if (asyncResource && asyncResource.promise) {
        asyncResource.promise.__NR_id = id
      }

      segmentMap.set(id, activeSegment)
    },

    before: function beforeHook(id) {
      const hookSegment = segmentMap.get(id)

      if (!hookSegment) {
        return
      }

      segmentMap.set(id, shim.getActiveSegment())
      shim.setActiveSegment(hookSegment)
    },
    after: function afterHook(id) {
      const hookSegment = segmentMap.get(id)

      // hookSegment is the segment that was active before the promise
      // executed. If the promise is executing before a segment has been
      // restored, hookSegment will be null and should be restored. Thus
      // undefined is the only invalid value here.
      if (hookSegment === undefined) {
        return
      }

      segmentMap.set(id, shim.getActiveSegment())
      shim.setActiveSegment(hookSegment)
    },
    promiseResolve: function promiseResolveHandler(id) {
      const hookSegment = segmentMap.get(id)
      segmentMap.delete(id)

      if (hookSegment === undefined) {
        return
      }

      // Because the ID will no-longer be in memory until dispose to propagate the null
      // we need to set it active here or else we may continue to propagate the wrong tree.
      // May be some risk of setting this at the wrong time
      if (hookSegment === null) {
        shim.setActiveSegment(hookSegment)
      }
    }
  }

  // Clean up any unresolved promises that have been destroyed.
  // This defaults to true but does have a significant performance impact
  // when customers have a lot of promises.
  // See: https://github.com/newrelic/node-newrelic/issues/760
  if (agent.config.feature_flag.unresolved_promise_cleanup) {
    logger.info('Adding destroy hook to clean up unresolved promises.')
    hooks.destroy = function destroyHandler(id) {
      segmentMap.delete(id)
    }
  }

  return hooks
}
