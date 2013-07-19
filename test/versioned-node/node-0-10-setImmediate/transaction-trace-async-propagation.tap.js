'use strict';

var path   = require('path')
  , tap    = require('tap')
  , test   = tap.test
  , helper = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper'))
  ;

test("c. async transaction with setImmediate (0.9+)", function (t) {
  t.plan(1);

  var agent = helper.loadMockedAgent();
  function handler() {
    t.ok(agent.getTransaction(), "transaction should be visible");
  }

  helper.runInTransaction(agent, setImmediate.bind(null, handler));
});

test("h. two overlapping executions of an async transaction with setImmediate (0.9+)",
     {timeout : 5000},
     function (t) {
  t.plan(5);

  var first
    , second
    , agent = helper.loadMockedAgent()
    ;

  function handler(id) {
    t.ok(agent.getTransaction(), "transaction should be visible");
    t.equal(agent.getTransaction().id, id, "transaction matches");
  }

  helper.runInTransaction(agent, function () {
    first = agent.getTransaction().id;
    setImmediate(handler.bind(null, first));
  });

  setImmediate(function () {
    helper.runInTransaction(agent, function () {
      second = agent.getTransaction().id;
      t.notEqual(first, second, "different transaction IDs");
      setImmediate(handler.bind(null, second));
    });
  });
});

test("m. async transaction with an async subsidiary handler with setImmediate (0.9+)",
     {timeout : 5000},
     function (t) {
  t.plan(5);

  var agent = helper.loadMockedAgent();
  function inner(callback) {
    setImmediate(function () {
      t.ok(agent.getTransaction(), "transaction should -- yep -- still be visible");
      callback();
    });
  }

  function outer() {
    t.ok(agent.getTransaction(), "transaction should be visible");
    setImmediate(function () {
      t.ok(agent.getTransaction(), "transaction should still be visible");
      inner(function () {
        t.ok(agent.getTransaction(), "transaction should even still be visible");
      });
    });
  }

  t.notOk(agent.getTransaction(), "transaction should not yet be visible");
  helper.runInTransaction(agent, setImmediate.bind(null, outer));
});
