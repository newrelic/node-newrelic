/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../../lib/agent_helper')

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const randomNumber = () => Math.floor(Math.random() * 1000)

const getRandomNumber = async () => {
  const number = randomNumber()
  await wait(number / 10)
  return number
}

tap.test('Restify instrumentation', (t) => {
  t.autoend()

  let agent = null
  let restify = null
  let server = null
  const numbers = []
  let i = 0

  t.before(() => {
    agent = helper.instrumentMockedAgent()
    restify = require('restify')
    server = restify.createServer()

    const useSyncMiddleware = (req, res, next) => {
      numbers[i] = randomNumber()
      i++
      const txn = agent.getTransaction()
      t.ok(txn, `sync middleware should be in transaction context`)
      return next()
    }

    const useAsyncMiddleware = async () => {
      const txn = agent.getTransaction()
      t.ok(txn, 'async middleware should be in transaction context')
      numbers[i] = await getRandomNumber()
      i++
    }

    const handler = (req, res, next) => {
      const txn = agent.getTransaction()
      t.ok(txn, 'sync handler should be in transaction context')
      res.send({ message: 'done with handler', numbers })
      return next()
    }

    const asyncHandler = async (req, res) => {
      const txn = agent.getTransaction()
      t.ok(txn, 'async handler should be in transaction context')
      numbers[i] = await getRandomNumber()
      i++
      res.send(JSON.stringify({ message: 'done with handler', numbers }))
    }

    server.use(useSyncMiddleware)
    server.use(useAsyncMiddleware)

    server.get('/sync/:handler', handler)
    server.put('/sync/:handler', handler)

    server.get('/async/:handler', asyncHandler)
    server.put('/async/:handler', asyncHandler)

    server.listen(0, function () {})
  })

  t.teardown(() => {
    server.close()
    helper.unloadAgent(agent)
  })

  t.test('should instrument sync GET requests', (t) => {
    const port = server.address().port
    const url = `http://localhost:${port}/sync/handler`

    helper.makeGetRequest(url, {}, function (error, res) {
      t.notOk(error)
      t.ok(res)
      t.end()
    })
  })
  t.test('Should instrument async GET requests', async (t) => {
    const port = server.address().port
    const url = `http://localhost:${port}/async/handler`

    await new Promise((resolve) => {
      helper.makeGetRequest(url, {}, async function (error, res) {
        t.notOk(error)
        t.ok(res)
        resolve()
      })
    })
    t.end()
  })
  t.test('Should instrument sync PUT requests', (t) => {
    const port = server.address().port
    const url = `http://localhost:${port}/sync/handler`

    helper.makeRequest(
      url,
      { method: 'PUT', body: JSON.stringify({ message: 'hi' }) },
      function (error, res) {
        t.notOk(error)
        t.ok(res)
        t.end()
      }
    )
  })
  t.test('Should instrument async PUT requests', async (t) => {
    const port = server.address().port
    const url = `http://localhost:${port}/async/handler`

    await new Promise((resolve) => {
      helper.makeRequest(
        url,
        { method: 'PUT', body: JSON.stringify({ message: 'hi' }) },
        function (error, res) {
          t.notOk(error)
          t.ok(res)
          resolve()
        }
      )
    })
    t.end()
  })
})
