'use strict';

var trace = require('./trace');

var memorySamplerId;

function sampleMemory(statsEngine) {
  var mem = process.memoryUsage();
  statsEngine.unscopedStats.byName('Memory/Physical').recordValueInBytes(mem.rss);
}

function recordQueueTime(statsEngine, timer) {
  timer.stop();
  statsEngine.unscopedStats.byName('Events/wait').recordValueInMillis(timer.getDurationInMillis());
}

function checkEvents(statsEngine) {
  var timer = new trace.Timer();
  setTimeout(recordQueueTime, 0, statsEngine, timer);
}

exports.start = function (statsEngine) {
  if (!memorySamplerId) {
    memorySamplerId = setInterval(sampleMemory, 5*1000, statsEngine);
  }
  setInterval(checkEvents, 15*1000, statsEngine);
};

exports.stop = function () {
  if (memorySamplerId) {
    clearInterval(memorySamplerId);
  }
};
