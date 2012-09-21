'use strict';

var path = require('path')
  , Timer = require(path.join(__dirname, 'timer'))
  ;

var samplers = [];

function Sampler(sampler, interval) {
  this.id = setInterval(sampler, interval);
}

Sampler.prototype.stop = function () {
  clearInterval(this.id);
};

function recordQueueTime(agent, timer) {
  timer.end();
  agent.metrics.measureDurationUnscoped('Events/wait', timer.getDurationInMillis());
}

var sampler = module.exports = {
  sampleMemory : function sampleMemory(agent) {
    var mem = process.memoryUsage();
    agent.metrics.measureSizeUnscoped('Memory/Physical', mem.rss);
  },

  checkEvents : function checkEvents(agent) {
    var timer = new Timer();
    timer.begin();
    setTimeout(recordQueueTime.bind(null, agent, timer), 0);
  },

  start : function start(agent) {
    samplers.push(new Sampler(sampler.sampleMemory.bind(null, agent), 5 * 1000));
    samplers.push(new Sampler(sampler.checkEvents.bind(null, agent), 15 * 1000));
  },

  stop : function stop() {
    samplers.forEach(function (sampler) { sampler.stop(); });
    samplers = [];
  }
};
