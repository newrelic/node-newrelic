/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const request = require('request').defaults({ json: true })
const helper = require('../../../lib/agent_helper')
const API = require('../../../../api')

tap.test('Restify router introspection', function (t) {
  t.plan(3)

  const agent = helper.instrumentMockedAgent()
  const server = require('restify').createServer()
  const api = new API(agent)

  agent.config.application_id = '12345'
  agent.config.browser_monitoring.browser_key = '12345'
  agent.config.browser_monitoring.js_agent_loader = 'function(){}'

  t.teardown(() => {
    server.close(() => {
      helper.unloadAgent(agent)
    })
  })

  server.get('/test/:id', function (req, res, next) {
    const rum = api.getBrowserTimingHeader()
    t.equal(rum.substr(0, 7), '<script')
    res.send({ status: 'ok' })
    next()
  })

  server.listen(0, function () {
    const port = server.address().port
    request.get('http://localhost:' + port + '/test/31337', function (error, res, body) {
      t.equal(res.statusCode, 200, 'nothing exploded')
      t.same(body, { status: 'ok' }, 'got expected respose')
      t.end()
    })
  })
})
