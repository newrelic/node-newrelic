var assert = require('assert');
var stats = require('../lib/stats');
var winston = require('winston');

var logger = new (winston.Logger)({
        transports: [ new (winston.transports.Console)()]
      });


function verifyStats(stats, callCount, totalTime, totalExclusive, min, max) {
    var data = stats.toJSON();
    assert.equal(callCount, data[0]);
    assert.equal(totalTime, data[1]);
    assert.equal(totalExclusive, data[2]);
    assert.equal(min, data[3]);
    assert.equal(max, data[4]);
}

exports['test stats'] = function(beforeExit, assert) {
    var s = stats.createStats();
    s.recordValueInMillis(51);
    s.recordValueInMillis(120, 34);
    s.recordValueInMillis(120, 34);
    
    verifyStats(s, 3, 0.291, 0.119, 0.051, 0.120);
};

exports['test stats2'] = function(beforeExit, assert) {
    var s = stats.createStats();
    s.recordValueInMillis(120, 0);
    s.recordValueInMillis(120, 0);
    
    verifyStats(s, 2, 0.240, 0.0, 0.120, 0.120);
};


exports['test stats merge'] = function(beforeExit, assert) {
    var s = stats.createStats();
    s.recordValueInMillis(51);
    s.recordValueInMillis(120, 34);
    s.recordValueInMillis(120, 34);
    
    verifyStats(s, 3, 0.291, 0.119, 0.051, 0.120);
    
    var s2 = stats.createStats();
    s2.recordValueInMillis(1120);
    s2.recordValueInMillis(6, 3);
    s2.recordValueInMillis(56, 2);
    
    s.merge(s2);
    
    verifyStats(s, 6, 1.473, 1.244, 0.006, 1.120);
};

exports['test statsengine no apdex'] = function(beforeExit, assert) {
    var s = stats.createStatsEngine(logger);
    s.getUnscopedStats().getApdexStats('test').incrementFrustrating();
    assert.equal(0, Object.keys(s.getUnscopedStats().toJSON()).length);
};

exports['test statsengine with apdex'] = function(beforeExit, assert) {
    var s = stats.createStatsEngine(logger);
    s.onConnect({'apdex_t' : 0.666 });    
    s.getUnscopedStats().getApdexStats('test').incrementFrustrating();
    assert.equal(1, Object.keys(s.getUnscopedStats().toJSON()).length);
};

exports['test statsengine parseMetricIds'] = function(beforeExit, assert) {
    var s = stats.createStatsEngine(logger);
    s.onConnect({'apdex_t' : 0.666 });    
    s.getUnscopedStats().getApdexStats('test').incrementFrustrating();
    s.getUnscopedStats().getStats('Dispatcher').recordValue(5);
    s.getScopedStats('Dispatcher').getStats('call').recordValue(5);
    
    var md = s.getMetricData();
    var data = JSON.stringify(md);
    assert.equal('[[{"name":"test"},[0,0,1,0,0,0]],[{"name":"Dispatcher"},[1,5,5,5,5,25]],[{"name":"call","scope":"Dispatcher"},[1,5,5,5,5,25]]]', data);
    
    s.parseMetricIds([[{'name' : 'test'}, 45], [{'name' : 'call', 'scope':'Dispatcher'}, 55]]);
    s.mergeMetricData(md);
    
    var data = JSON.stringify(s.getMetricData());
    assert.equal('[[45,[0,0,1,0,0,0]],[{"name":"Dispatcher"},[1,5,5,5,5,25]],[55,[1,5,5,5,5,25]]]', data);
};

exports['test statsengine mergeMetricData'] = function(beforeExit, assert) {
    var s = stats.createStatsEngine(logger);
    
    s.getUnscopedStats().getStats('Dispatcher').recordValue(5);
    s.getScopedStats('Dispatcher').getStats('call').recordValue(5);
    
    var md = s.getMetricData();
    
    s.getUnscopedStats().getStats('Dispatcher').recordValue(5);
    s.mergeMetricData(md);
    
    var data = JSON.stringify(s.getMetricData());
    assert.equal('[[{"name":"Dispatcher"},[2,10,10,5,5,50]],[{"name":"call","scope":"Dispatcher"},[1,5,5,5,5,25]]]', data);
};


