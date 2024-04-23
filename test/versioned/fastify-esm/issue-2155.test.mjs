/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// We cannot replicate the issue using a dynamic `await import('fastify')`.
// Thus, we cannot write a typical `tap` based test. Instead, we need to rely
// on this script exiting cleanly to represent a successful test.

import assert from 'assert'
import http from 'http'

import fastify from 'fastify'
const server = fastify({
  logger: {
    level: 'silent'
  }
})

server.route({
  method: 'GET',
  path: '/',
  handler(req, res) {
    res.send('ok')
  }
})

const address = await server.listen({ host: '127.0.0.1', port: 0 })
const found = await new Promise((resolve, reject) => {
  const req = http.request(address, (res) => {
    let data = ''
    res.on('data', (d) => {
      data += d.toString()
    })
    res.on('end', () => {
      resolve(data)
    })
  })

  req.on('error', reject)
  req.end()
})

assert.equal(found, 'ok')

await server.close()
