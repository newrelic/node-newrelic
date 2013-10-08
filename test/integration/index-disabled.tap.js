'use strict';

var path = require('path')
  , test = require('tap').test
  ;

test("loading the application via index.js with agent disabled", function (t) {
  t.plan(2);

  process.env.NEW_RELIC_ENABLED = 'false';
  var api = require(path.join(__dirname, '..', '..', 'index.js'));

  t.ok(api, "have an API");
  t.notOk(api.agent, "no associated agent");
});
