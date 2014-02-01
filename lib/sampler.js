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
var TO_MILLIS = 1e3;


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

function sampleMemory(agent) {
  return function memorySampler() {
    var mem = process.memoryUsage();
    agent.metrics.measureBytes(NAMES.MEMORY.PHYSICAL, mem.rss);
  };
}

function checkEvents(agent) {
  return function eventSampler() {
    var timer = new Timer();
    timer.begin();
    setTimeout(recordQueueTime.bind(null, agent, timer), 0);
  };
}

var sampler = module.exports = {
  state        : 'stopped',
  sampleMemory : sampleMemory,
  checkEvents  : checkEvents,

  start : function start(agent) {
    samplers.push(new Sampler(sampleMemory(agent), 5 * TO_MILLIS));
    samplers.push(new Sampler(checkEvents(agent), 15 * TO_MILLIS));
    sampler.state = 'running';
  },

  stop : function stop() {
    samplers.forEach(function (sampler) { sampler.stop(); });
    samplers = [];
    sampler.state = 'stopped';
  }
};
