var trace = require('../lib/trace.js');
var _agent = require('./test_agent.js');


var now = new Date();
function FixedTime() {
	return now;
}

exports['test metricName'] = function(beforeExit, assert) {
	var agent = _agent.createAgent();
	var tx = trace.createTransaction(agent);

	var tracer = new trace.Tracer(tx, 'Custom/Test');
	tracer.getStartTime = tracer.getEndTime = FixedTime;
	tracer.finish();

	var md = agent.getStatsEngine().getMetricData();
	var data = JSON.stringify(md);
	assert.equal('[[{"name":"Custom/Test","scope":"FIXME"},[1,0,0,0,0,0]]]', data);
}

exports['test after finished'] = function(beforeExit, assert) {
	var agent = _agent.createAgent();
	var tx = trace.createTransaction(agent);

	var tracer = new trace.Tracer(tx, 'Custom/Test');
	tracer.getStartTime = tracer.getEndTime = FixedTime;
	tracer.finish();

	var tracer = new trace.Tracer(tx, 'Custom/Test');
	tracer.getStartTime = tracer.getEndTime = FixedTime;
	tracer.finish();

	var md = agent.getStatsEngine().getMetricData();
	var data = JSON.stringify(md);
	assert.equal('[[{"name":"Custom/Test","scope":"FIXME"},[1,0,0,0,0,0]]]', data);

}



