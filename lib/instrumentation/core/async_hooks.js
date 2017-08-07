'use strict'
module.exports = initialize

function initialize(agent, asyncHooks) {
  // this map is reused to track the segment that was active when
  // the before callback is called to be replaced in the after callback
  //
  // this assumes that init/before/after will all be called exactly
  // once.
  var segmentMap = {}
  module.exports._segmentMap = segmentMap

  asyncHooks.createHook({
    init: function initHook(id, type, triggerAsyncId) {
      var transaction = agent.getTransaction()
      if (!transaction || type !== 'PROMISE') {
        return
      }

      segmentMap[id] = {}
      segmentMap[id][triggerAsyncId] = agent.tracer.segment
    },
    before: function beforeHook(id) {
      var triggerObj = segmentMap[id]
      var triggerAsyncId = asyncHooks.triggerAsyncId()
      var hookSegment = triggerObj && triggerObj[triggerAsyncId]

      if (!hookSegment) {
        return
      }

      triggerObj[triggerAsyncId] = agent.tracer.segment
      agent.tracer.segment = hookSegment
    },
    after: function afterHook(id) {
      var triggerObj = segmentMap[id]
      var triggerAsyncId = asyncHooks.triggerAsyncId()
      var hookSegment = triggerObj && triggerObj[triggerAsyncId]

      // hookSegment is the segment that was active before the promise
      // executed. If the promise is executing before a segment has been
      // restored, hookSegment will be null and should be restored. Thus
      // undefined is the only invalid value here.
      if (hookSegment === undefined) {
        return
      }

      delete triggerObj[triggerAsyncId]
      agent.tracer.segment = hookSegment
    },
    destroy: function destHook(id) {
      delete segmentMap[id]
    }
  }).enable()
}
