var trace = require('./trace');

var memorySamplerId;

function sampleMemory(statsEngine) {
  var mem = process.memoryUsage();
  statsEngine.getUnscopedStats().getStats('Memory/Physical').recordValueInBytes(mem.heapUsed);
}

function recordQueueTime(statsEngine, timer) {
  timer.stop();
  statsEngine.getUnscopedStats().getStats('Events/wait').recordTimer(timer);
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
