'use strict'

var logger = require('../../logger').child({component: 'async_hooks'})
var promInit = require('../promise')
var semver = require('semver')

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

var nativeTracer = null

function initialize(agent) {
  var enableHooks = agent.config.checkAsyncHookStatus()
  if (enableHooks && tryAsyncHooks(agent)) {
    logger.debug('Using async_hooks.')
  } else if (enableHooks && tryNative(agent)) {
    logger.debug('Using native promise hooks.')
  } else if (semver.satisfies(process.version, '>=0.12')) {
    logger.debug('Using promise instrumentation.')
    promInit(agent, global, NATIVE_PROMISE_SPEC)
  }
}

function tryNative(agent) {
  if (!agent.config.transaction_tracer.enable_native) {
    return false
  }

  try {
    if (!nativeTracer) {
      nativeTracer = require('@newrelic/native-tracer').initialize(agent.tracer)
    }

    nativeTracer.bind()
    agent.once('unload', function onDebugUnload() {
      nativeTracer.unbind()
    })

    return true
  } catch (e) {
    logger.info(e, 'Not adding native promise hooks.')
    return false
  }
}

function tryAsyncHooks(agent) {
  if (!agent.config.transaction_tracer.enable_hooks) {
    return false
  }

  var asyncHooks = null
  try {
    asyncHooks = require('async_hooks')
  } catch (e) {
    logger.info(e, 'Not using async_hooks module.')
    return false
  }

  // this map is reused to track the segment that was active when
  // the before callback is called to be replaced in the after callback
  var segmentMap = {}
  module.exports._segmentMap = segmentMap

  asyncHooks.createHook({
    init: function initHook(id, type) {
      var transaction = agent.getTransaction()

      if (!transaction || type !== 'PROMISE') {
        return
      }

      segmentMap[id] = agent.tracer.getSegment()
    },

    before: function beforeHook(id) {
      var hookSegment = segmentMap[id]

      if (!hookSegment) {
        return
      }

      segmentMap[id] = agent.tracer.getSegment()
      agent.tracer.segment = hookSegment
    },
    after: function afterHook(id) {
      var hookSegment = segmentMap[id]

      // hookSegment is the segment that was active before the promise
      // executed. If the promise is executing before a segment has been
      // restored, hookSegment will be null and should be restored. Thus
      // undefined is the only invalid value here.
      if (hookSegment === undefined) {
        return
      }

      segmentMap[id] = agent.tracer.getSegment()
      agent.tracer.segment = hookSegment
    },
    destroy: function destHook(id) {
      delete segmentMap[id]
    }
  }).enable()

  return true
}
