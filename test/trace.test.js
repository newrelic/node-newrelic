var trace = require('../lib/trace');
var stats = require('../lib/stats');
var util = require('util');
var _agent = require('./test_agent');


var now = new Date();
function FixedTime() {
    return now;
}

exports.testRawStack = function TEST(beforeExit, assert) {
	var stack = trace.getRawStack();
	assert.equal('TEST', stack[0].fun.name);
};
    
exports.testMetricName = function(beforeExit, assert) {
    var agent = _agent.createAgent();
    var tx = trace.createTransaction(agent);
    var tracer = new trace.Tracer(tx, 'Custom/Test');
    tracer.getStartTime = tracer.getEndTime = FixedTime;
    tracer.finish();
    assert.equal(1, agent.transactions.length);

    var stats = agent.transactions[0].getScopedStats().getStats('Custom/Test');
    var data = JSON.stringify(stats);
    assert.equal('[1,0,0,0,0,0]', data);
};


exports.testAfterFinished = function(beforeExit, assert) {
    var agent = _agent.createAgent();
    var tx = trace.createTransaction(agent);

    var tracer = new trace.Tracer(tx, 'Custom/Test2');
    tracer.getStartTime = tracer.getEndTime = FixedTime;
    tracer.finish();
    assert.equal(1, agent.transactions.length);

    var tracer = new trace.Tracer(tx, 'Custom/Test3');
    tracer.getStartTime = tracer.getEndTime = FixedTime;
    tracer.finish();

    assert.equal(1, agent.transactions.length);

    var stats = agent.transactions[0].getScopedStats();
    var data = JSON.stringify(stats.getMetricData());
    assert.equal('[[{"name":"Custom/Test2"},[1,0,0,0,0,0]]]', data);
};
