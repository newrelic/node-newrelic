/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fork = require('child_process').fork
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')

function generateApp() {
  const express = require('express')
  const bodyParser = require('body-parser')

  const app = express()
  app.use(bodyParser.json())

  app.post('/test', async function controller(req, res) {
    try {
      await new Promise((resolve) =>
        setTimeout(() => {
          resolve()
        }, req.body.timeout)
      )

      res.status(200).send('OK')
    } catch (err) {
      res.status(500).send('Err')
    }
  })

  return app
}

tap.test('Client Premature Disconnection', (t) => {
  t.setTimeout(3000)
  const agent = helper.instrumentMockedAgent()
  const server = generateApp().listen(0)
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

  const forkedRequest = fork(`${__dirname}/helpers/request.js`)
  forkedRequest.send(port)
})
