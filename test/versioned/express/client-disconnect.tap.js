/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')
const http = require('http')

function generateApp(t) {
  const express = require('express')
  const bodyParser = require('body-parser')

  const app = express()
  app.use(bodyParser.json())

  app.post('/test', function controller(req, res) {
    const timeout = setTimeout(() => {
      const err = new Error('should not hit this as request was aborted')
      t.error(err)

      res.status(200).send('OK')
    }, req.body.timeout)

    res.on('close', () => {
      t.comment('cancelling setTimeout')
      clearTimeout(timeout)
    })
  })

  return app
}

tap.test('Client Premature Disconnection', (t) => {
  t.setTimeout(3000)
  const agent = helper.instrumentMockedAgent()
  const server = generateApp(t).listen(0)
  const { port } = server.address()

  t.teardown(() => {
    server.close()
    helper.unloadAgent(agent)
  })

  agent.on('transactionFinished', (transaction) => {
    t.doesNotThrow(function () {
      metrics.assertSegments(
        transaction.trace.root,
        [
          'WebTransaction/Expressjs/POST//test',
          [
            'Nodejs/Middleware/Expressjs/query',
            'Nodejs/Middleware/Expressjs/expressInit',
            'Nodejs/Middleware/Expressjs/jsonParser',
            'Expressjs/Route Path: /test',
            ['Nodejs/Middleware/Expressjs/controller', ['timers.setTimeout']]
          ]
        ],
        { exact: true }
      )
    }, 'should have expected segments')

    t.equal(agent.getTransaction(), null, 'should have ended the transaction')
    t.end()
  })

  const postData = JSON.stringify({ timeout: 1500 })
  const request = http.request(
    {
      hostname: 'localhost',
      port: port,
      method: 'POST',
      path: '/test',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    },
    function () {}
  )
  request.on('error', () => t.comment('swallowing request error'))
  request.write(postData)
  request.end()

  setTimeout(() => {
    t.comment('aborting request')
    request.destroy()
  }, 100)
})
