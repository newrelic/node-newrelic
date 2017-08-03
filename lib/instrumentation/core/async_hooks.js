'use strict'
module.exports = initialize

function initialize(agent, asyncHooks) {
  // this map is reused to track the segment that was active when
  // the before callback is called to be replaced in the after callback
  //
  // this assumes that init/before/after will all be called exactly
  // once.
  var segmentMap = {}
  var triggerIdMethod = asyncHooks.triggerId || asyncHooks.triggerAsyncId

  asyncHooks.createHook({
    init: function initHook(id, type, triggerAsyncId) {
      var transaction = agent.getTransaction()
      if (!transaction || type !== 'PROMISE') {
        return
      }

      var key = [id, triggerAsyncId].join(',')
      segmentMap[key] = agent.tracer.segment
    },
    before: function beforeHook(id) {
      var triggerAsyncId = triggerIdMethod.apply(asyncHooks)
      var key = [id, triggerAsyncId].join(',')
      var hookSegment = segmentMap[key]

      if (!hookSegment) {
        return
      }

      segmentMap[key] = agent.tracer.segment
      agent.tracer.segment = hookSegment
    },
    after: function afterHook(id) {
      var triggerAsyncId = triggerIdMethod.apply(asyncHooks)
      var key = [id, triggerAsyncId].join(',')
      var hookSegment = segmentMap[key]

      // hookSegment is the segment that was active before the promise
      // executed. If the promise is executing before a segment has been
      // restored, hookSegment will be null and should be restored. Thus
      // undefined is the only invalid value here.
      if (hookSegment === undefined) {
        return
      }

      delete segmentMap[key]
      agent.tracer.segment = hookSegment
    },
    destroy: function destHook(id) {
      var triggerAsyncId = triggerIdMethod.apply(asyncHooks)
      var key = [id, triggerAsyncId].join(',')
      delete segmentMap[key]
    }
  }).enable()
}
