/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('#testlib/agent_helper.js')

// This lives in its own file, separate from http-outbound.test.js, because
// `nock` must be loaded there at module scope (so its interception survives
// across that file's many instrumentMockedAgent()/unloadAgent() cycles), but
// nock 14's `@mswjs/interceptors` crashes on a proxy-style request (where
// `path` is an absolute URL) once loaded. Keeping this real-server, no-nock
// test in its own process sidesteps that conflict entirely.
test('should recognize requests via proxy correcly', async function (t) {
  const plan = tspl(t, { plan: 2 })
  const agent = helper.instrumentMockedAgent()
  const http = require('http')

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const proxyUrl = 'https://www.google.com/proxy/path'
  const proxyServer = http.createServer(function onRequest(req, res) {
    plan.equal(req.url, proxyUrl)
    req.resume()
    res.end('ok')
  })
  t.after(() => proxyServer.close())

  proxyServer.listen(0)

  helper.runInTransaction(agent, function inTransaction() {
    const opts = {
      host: 'localhost',
      port: proxyServer.address().port,
      path: proxyUrl,
      protocol: 'http:'
    }

    const req = http.get(opts, function onResponse(res) {
      res.resume()
      res.once('end', function () {
        const { trace } = agent.tracer.getTransaction()
        const [segment] = trace.getChildren(trace.root.id)
        plan.equal(
          segment.name,
          'External/www.google.com/proxy/path',
          'should name segment as an external service'
        )
      })
    })

    req.on('error', function onError(err) {
      plan.fail('Request should not error: ' + err.message)
    })
  })

  await plan.completed
})
