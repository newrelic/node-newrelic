/* eslint-env es6 */
'use strict'

var tap = require('tap')
var utils = require('@newrelic/test-utilities')
var http = require('http')

tap.test('Koa v1', function(t) {
  var helper = null
  var app = null
  var server = null

  helper = utils.TestAgent.makeInstrumented()
  helper.registerInstrumentation({
    moduleName: 'koa',
    type: 'web-framework',
    onRequire: require('../../lib/instrumentation')
  })
  var koa = require('koa')
  app = koa()

  t.tearDown(function() {
    server && server.close()
    app = null
    helper && helper.unload()
  })

  t.test('is not instrumented', function(t) {
    app.use(function* main() {
      this.body = 'done'
    })

    helper.agent.on('transactionFinished', function(tx) {
      var segment = tx.trace.root.children[0]
      t.equal(segment.name, 'WebTransaction/NormalizedUri/*')
      t.end()
    })

    run()
  })

  t.autoend()

  function run() {
    server = app.listen(0, function() {
      http.get({port: server.address().port}, function(res) {
        if (res.body) {
          t.equal(res.body, 'done')
        }
      }).end()
    })
  }
})
