'use strict';

var path  = require('path')
  , NAMES = require(path.join(__dirname, 'metrics', 'names'))
  , Timer = require(path.join(__dirname, 'timer'))
  ;

/*
 *
 * CONSTANTS
 *
 */
var TO_MILLIS = 1000;


var samplers = [];

function Sampler(sampler, interval) {
  this.id = setInterval(sampler, interval);
  // timer.unref only in 0.9+
  if (this.id.unref) this.id.unref();
}

Sampler.prototype.stop = function () {
  clearInterval(this.id);
};

function recordQueueTime(agent, timer) {
  timer.end();
  agent.metrics.measureMilliseconds(NAMES.EVENTS.WAIT, null, timer.getDurationInMillis());
}

var sampler = module.exports = {
  sampleMemory : function sampleMemory(agent) {
    var mem = process.memoryUsage();
    agent.metrics.measureBytes(NAMES.MEMORY.PHYSICAL, mem.rss);
  },

  checkEvents : function checkEvents(agent) {
    var timer = new Timer();
    timer.begin();
    setTimeout(recordQueueTime.bind(null, agent, timer), 0);
  },

  start : function start(agent) {
    samplers.push(new Sampler(sampler.sampleMemory.bind(null, agent), 5 * TO_MILLIS));
    samplers.push(new Sampler(sampler.checkEvents.bind(null, agent), 15 * TO_MILLIS));
  },

  stop : function stop() {
    samplers.forEach(function (sampler) { sampler.stop(); });
    samplers = [];
  }
};
