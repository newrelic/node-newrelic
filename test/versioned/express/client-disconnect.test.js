/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const http = require('http')
const { assertSegments } = require('../../lib/custom-assertions')

function generateApp() {
  const express = require('express')
  const bodyParser = require('body-parser')

  const app = express()
  app.use(bodyParser.json())

  app.post('/test', function controller(req, res) {
    const timeout = setTimeout(() => {
      const err = new Error('should not hit this as request was aborted')
      assert.ok(!err)
      res.status(200).send('OK')
    }, req.body.timeout)

    res.on('close', () => {
      clearTimeout(timeout)
    })
  })

  return app.listen(0)
}

test('Client Premature Disconnection', { timeout: 3000 }, (t, end) => {
  const agent = helper.instrumentMockedAgent()
  const server = generateApp()
  const { port } = server.address()

  t.after(() => {
    server.close()
    helper.unloadAgent(agent)
  })

  agent.on('transactionFinished', (transaction) => {
    assertSegments(
      transaction.trace,
      transaction.trace.root,
      [
        'WebTransaction/Expressjs/POST//test',
        [
          'Nodejs/Middleware/Expressjs/jsonParser',
          'Expressjs/Route Path: /test',
          ['Nodejs/Middleware/Expressjs/controller', ['timers.setTimeout']]
        ]
      ],
      { exact: false }
    )

    assert.equal(agent.getTransaction(), null, 'should have ended the transaction')
    end()
  })

  const postData = JSON.stringify({ timeout: 1500 })
  const request = http.request(
    {
      hostname: 'localhost',
      port,
      method: 'POST',
      path: '/test',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    },
    function () {}
  )
  request.on('error', (err) => {
    assert.equal(err.code, 'ECONNRESET')
  })
  request.write(postData)
  request.end()

  setTimeout(() => {
    request.destroy()
  }, 100)
})
