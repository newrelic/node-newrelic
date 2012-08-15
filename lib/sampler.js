'use strict';

var path = require('path')
  , Timer = require(path.join(__dirname, 'timer'))
  ;

var memorySamplerId;

var sampler = module.exports = {
  sampleMemory : function sampleMemory(agent) {
    var mem = process.memoryUsage();
    agent.metrics.measureSizeUnscoped('Memory/Physical', mem.rss);
  },

  recordQueueTime : function recordQueueTime(agent, timer) {
    timer.end();
    agent.metrics.measureDurationUnscoped('Events/wait', timer.getDurationInMillis());
  },

  checkEvents : function checkEvents(agent) {
    var timer = new Timer();
    timer.begin();
    setTimeout(sampler.recordQueueTime, 0, agent, timer);
  },

  start : function start(agent) {
    if (!memorySamplerId) {
      memorySamplerId = setInterval(sampler.sampleMemory, 5 * 1000, agent);
    }
    setInterval(sampler.checkEvents, 15 * 1000, agent);
  },

  stop : function stop() {
    if (memorySamplerId) {
      clearInterval(memorySamplerId);
    }
  }
};
