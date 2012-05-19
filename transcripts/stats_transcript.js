var stats = require('./lib/stats');
var logger = require('./lib/logger');
var engine = stats.engine;

var SCOPE = "TEST";
var NAME  = "Custom/Test/events";

var unscoped = new stats.Collection(engine);
engine.statsByScope(SCOPE).byName(NAME).recordValueInMillis(1200, 1000);

var mds = new stats.MetricDataSet(unscoped, engine.scopedStats, {});
