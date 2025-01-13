/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')
const MAX_PORT_ATTEMPTS = 5

test("restify shouldn't affect express query parsing middleware", async function (t) {
  const plan = tspl(t, { plan: 2 })

  const agent = helper.instrumentMockedAgent()
  const express = require('express')

  require('restify')

  const app = express()
  const server = require('http').createServer(app)
  t.after(() => {
    server.close()
    helper.unloadAgent(agent)
  })

  app.get('/', (req, res) => {
    // Unforunately, restify has its own issues with Express right now
    // and by modify the prototype ends up chaning query from a property
    // to a function. So we'll double-check the value but express is already borked.
    // https://github.com/restify/node-restify/issues/1540
    // https://github.com/restify/node-restify/blob/master/lib/request.js#L382-L398
    let query = null
    if (req.query && typeof req.query === 'function') {
      query = req.query()
    }

    // The restify function replacement mentioned above also results
    // in a string instead of an object.
    plan.deepEqual(query, 'test=success', 'express req.query property is correct')
    res.sendStatus(200)
  })

  let attempts = 0
  server.on('error', (e) => {
    // server port not guranteed to be not in use
    if (e.code === 'EADDRINUSE') {
      if (attempts >= MAX_PORT_ATTEMPTS) {
        console.log('Exceeded max attempts (%s), bailing out.', MAX_PORT_ATTEMPTS)
        throw new Error('Unable to get unused port')
      }

      attempts++

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

    helper.makeGetRequest(`http://localhost:${port}/?test=success`, function (err, response) {
      if (err) {
        return t.fail(err)
      }

      plan.equal(200, response.statusCode)
    })
  })

  await plan.completed
})
