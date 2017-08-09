'use strict'
module.exports = initialize

function initialize(agent, asyncHooks) {
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

      segmentMap[id] = agent.tracer.segment
    },
    before: function beforeHook(id) {
      var hookSegment = segmentMap[id]

      if (!hookSegment) {
        return
      }

      segmentMap[id] = agent.tracer.segment
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

      segmentMap[id] = agent.tracer.segment
      agent.tracer.segment = hookSegment
    },
    destroy: function destHook(id) {
      delete segmentMap[id]
    }
  }).enable()
}
