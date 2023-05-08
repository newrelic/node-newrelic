/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-env es6 */
'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const http = require('http')
const hooks = require('../../nr-hooks')

tap.test('Koa v1', function (t) {
  let helper = null
  let app = null
  let server = null

  helper = utils.TestAgent.makeInstrumented()
  helper.registerInstrumentation(hooks[0])
  const koa = require('koa')
  app = koa()

  t.tearDown(function () {
    server && server.close()
    app = null
    helper && helper.unload()
  })

  t.test('is not instrumented', function (t) {
    app.use(function* main() {
      this.body = 'done'
    })

    helper.agent.on('transactionFinished', function (tx) {
      const segment = tx.trace.root.children[0]
      t.equal(segment.name, 'WebTransaction/NormalizedUri/*')
      t.end()
    })

    run()
  })

  t.autoend()

  function run() {
    server = app.listen(0, function () {
      http
        .get({ port: server.address().port }, function (res) {
          if (res.body) {
            t.equal(res.body, 'done')
          }
        })
        .end()
    })
  }
})
