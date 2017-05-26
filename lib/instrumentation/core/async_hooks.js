'use strict'
module.exports = initialize

function initialize(agent, asyncHooks) {
  // this map is reused to track the segment that was active when
  // the before callback is called to be replaced in the after callback
  //
  // this assumes that init/before/after will all be called exactly
  // once.
  var segmentMap = {}

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
      if (hookSegment === undefined) {
        return
      }
      delete segmentMap[id]
      agent.tracer.segment = hookSegment
    },
    destroy: function destHook(id) {
      delete segmentMap[id]
    }
  }).enable()
}
