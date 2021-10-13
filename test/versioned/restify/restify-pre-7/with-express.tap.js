/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const request = require('request')
const helper = require('../../../lib/agent_helper')

const MAX_PORT_ATTEMPTS = 5

tap.test("restify shouldn't affect express query parsing middleware", function (t) {
  t.plan(2)

  const agent = helper.instrumentMockedAgent()
  const express = require('express')
  const restify = require('restify') // eslint-disable-line no-unused-vars
  const app = express()
  const server = require('http').createServer(app)

  app.get('/', (req, res) => {
    t.same(req.query, { test: 'success' }, 'express req.query property is correct')
    res.sendStatus(200)
  })

  let attempts = 0
  server.on('error', (e) => {
    // server port not guranteed to be not in use
    if (e.code === 'EADDRINUSE') {
      if (attempts >= MAX_PORT_ATTEMPTS) {
        // eslint-disable-next-line no-console
        console.log('Exceeded max attempts (%s), bailing out.', MAX_PORT_ATTEMPTS)
        throw new Error('Unable to get unused port')
      }

      attempts++

      // eslint-disable-next-line no-console
      console.log('Address in use, retrying...')
      setTimeout(() => {
        server.close()

        // start the server using a random port
        server.listen()
      }, 1000)
    }
  })

  // start the server using a random port
  server.listen()

  server.on('listening', () => {
    const port = server.address().port

    request.get(`http://localhost:${port}/?test=success`, function (err, response) {
      if (err) {
        return t.fail(err)
      }

      t.equal(200, response.statusCode)
    })
  })

  t.teardown(() => {
    server.close()
    helper.unloadAgent(agent)
  })
})
