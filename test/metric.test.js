var metric = require('../lib/metric');
var stats = require('../lib/stats');

function Agent(apdexT) {
    this.getApdexT = function() {
        return apdexT;
    };
}

var normalizer = new metric.MetricNormalizer();

exports['recordWebTransactionMetrics satisfying'] = function(beforeExit, assert) {
    var agent = new Agent(0.06);
    var s = new stats.StatsCollection(agent);
    metric.recordWebTransactionMetrics(normalizer, s, '/test', 55, 200);
    assert.equal('{"WebTransaction/Uri/test":[1,0.055,0,0.055,0.055,0.003025],"Apdex/Uri/test":[1,0,0,0,0,0],"Apdex":[1,0,0,0,0,0],"WebTransaction":[1,0.055,0.055,0.055,0.055,0.003025],"HttpDispatcher":[1,0.055,0.055,0.055,0.055,0.003025]}', JSON.stringify(s));
};


exports['recordWebTransactionMetrics tolerating'] = function(beforeExit, assert) {
    var agent = new Agent(0.05);
    var s = new stats.StatsCollection(agent);
    metric.recordWebTransactionMetrics(normalizer, s, '/test', 55, 200);
    assert.equal('{"WebTransaction/Uri/test":[1,0.055,0,0.055,0.055,0.003025],"Apdex/Uri/test":[0,1,0,0,0,0],"Apdex":[0,1,0,0,0,0],"WebTransaction":[1,0.055,0.055,0.055,0.055,0.003025],"HttpDispatcher":[1,0.055,0.055,0.055,0.055,0.003025]}', JSON.stringify(s));
};

exports['recordWebTransactionMetrics frustrating'] = function(beforeExit, assert) {
    var agent = new Agent(0.01);
    var s = new stats.StatsCollection(agent);
    metric.recordWebTransactionMetrics(normalizer, s, '/test', 55, 200);
    assert.equal('{"WebTransaction/Uri/test":[1,0.055,0,0.055,0.055,0.003025],"Apdex/Uri/test":[0,0,1,0,0,0],"Apdex":[0,0,1,0,0,0],"WebTransaction":[1,0.055,0.055,0.055,0.055,0.003025],"HttpDispatcher":[1,0.055,0.055,0.055,0.055,0.003025]}', JSON.stringify(s));
};

exports['recordWebTransactionMetrics 404'] = function(beforeExit, assert) {
    var agent = new Agent(0.01);
    var s = new stats.StatsCollection(agent);
    metric.recordWebTransactionMetrics(normalizer, s, '/test', 55, 404);
    assert.equal('{"WebTransaction/StatusCode/404":[1,0.055,0,0.055,0.055,0.003025],"Apdex/StatusCode/404":[0,0,1,0,0,0],"Apdex":[0,0,1,0,0,0],"WebTransaction":[1,0.055,0.055,0.055,0.055,0.003025],"HttpDispatcher":[1,0.055,0.055,0.055,0.055,0.003025]}', JSON.stringify(s));
};

exports['recordWebTransactionMetrics 400'] = function(beforeExit, assert) {
    var agent = new Agent(0.01);
    var s = new stats.StatsCollection(agent);
    metric.recordWebTransactionMetrics(normalizer, s, '/test', 55, 400);
//    console.log(JSON.stringify(s));
    assert.equal('{"WebTransaction/StatusCode/400":[1,0.055,0,0.055,0.055,0.003025],"Apdex/StatusCode/400":[0,0,1,0,0,0],"Apdex":[0,0,1,0,0,0],"WebTransaction":[1,0.055,0.055,0.055,0.055,0.003025],"HttpDispatcher":[1,0.055,0.055,0.055,0.055,0.003025]}', JSON.stringify(s));
};

exports['recordWebTransactionMetrics 414'] = function(beforeExit, assert) {
    var agent = new Agent(0.01);
    var s = new stats.StatsCollection(agent);
    metric.recordWebTransactionMetrics(normalizer, s, '/test', 55, 414);
    assert.equal('{"WebTransaction/StatusCode/414":[1,0.055,0,0.055,0.055,0.003025],"Apdex/StatusCode/414":[0,0,1,0,0,0],"Apdex":[0,0,1,0,0,0],"WebTransaction":[1,0.055,0.055,0.055,0.055,0.003025],"HttpDispatcher":[1,0.055,0.055,0.055,0.055,0.003025]}', JSON.stringify(s));
};

exports['recordWebTransactionMetrics 500'] = function(beforeExit, assert) {
    var agent = new Agent(0.1);
    var s = new stats.StatsCollection(agent);
    metric.recordWebTransactionMetrics(normalizer, s, '/test', 1, 500);
    //console.log(JSON.stringify(s));
    assert.equal('{"WebTransaction/Uri/test":[1,0.001,0,0.001,0.001,0.000001],"Apdex/Uri/test":[0,0,1,0,0,0],"Apdex":[0,0,1,0,0,0],"WebTransaction":[1,0.001,0.001,0.001,0.001,0.000001],"HttpDispatcher":[1,0.001,0.001,0.001,0.001,0.000001]}', JSON.stringify(s));
};