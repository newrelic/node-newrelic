'use strict'

var logger = require('../../logger').child({component: 'async_hooks'})
var promInit = require('../promise')

module.exports = initialize

/**
 * The spec for the native `Promise` class.
 */
var STATIC_PROMISE_METHODS = ['accept', 'all', 'defer', 'race', 'reject', 'resolve']
var NATIVE_PROMISE_SPEC = {
  name: 'global',
  constructor: 'Promise',
  executor: true,
  $proto: {
    then: ['then', 'chain'],
    catch: ['catch']
  },
  $static: {
    $copy: STATIC_PROMISE_METHODS,
    cast: STATIC_PROMISE_METHODS
  }
}

function initialize(agent) {
  var enableHooks = agent.config.checkAsyncHookStatus()
  if (enableHooks && tryAsyncHooks(agent)) {
    logger.debug('Using async_hooks.')
  } else {
    logger.debug('Using promise instrumentation.')
    promInit(agent, global, NATIVE_PROMISE_SPEC)
  }
}

function tryAsyncHooks(agent) {
  var asyncHooks = null
  try {
    asyncHooks = require('async_hooks')
  } catch (e) {
    logger.info(e, 'Not using async_hooks module.')
    return false
  }

  // this map is reused to track the segment that was active when
  // the before callback is called to be replaced in the after callback
  var segmentMap = new Map()
  module.exports.segmentMap = segmentMap

  var hook = asyncHooks.createHook({
    init: function initHook(id, type, triggerId, promiseWrap) {
      var transaction = agent.getTransaction()
      var parentSegment = segmentMap.get(triggerId)

      if (!parentSegment && !transaction || type !== 'PROMISE') {
        return
      }

      var activeSegment = agent.tracer.getSegment() || parentSegment
      if (promiseWrap && promiseWrap.promise) {
        promiseWrap.promise.__NR_id = id
      }
      segmentMap.set(id, activeSegment)
    },

    before: function beforeHook(id) {
      var hookSegment = segmentMap.get(id)

      if (!hookSegment) {
        return
      }

      segmentMap.set(id, agent.tracer.getSegment())
      agent.tracer.segment = hookSegment
    },
    after: function afterHook(id) {
      var hookSegment = segmentMap.get(id)

      // hookSegment is the segment that was active before the promise
      // executed. If the promise is executing before a segment has been
      // restored, hookSegment will be null and should be restored. Thus
      // undefined is the only invalid value here.
      if (hookSegment === undefined) {
        return
      }

      segmentMap.set(id, agent.tracer.getSegment())
      agent.tracer.segment = hookSegment
    },
    destroy: function destHook(id) {
      segmentMap.delete(id)
    }
  }).enable()

  agent.on('unload', function disableHook() {
    hook.disable()
  })

  return true
}
