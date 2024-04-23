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
  forceCloseConnections: true,
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

const timeout = setTimeout(() => {
  // eslint-disable-next-line no-process-exit
  process.exit(1)
}, 20_000)

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
clearTimeout(timeout)

// We really shouldn't need this `process.exit`, but on Node.js 18 with our
// versioned tests runner we'll see the runner consistently hang without it.
// To see it, use Node 18 and `npm run versioned:internal fastify-esm`. Note,
// that it must be "versioned:internal" and not "versioned:internal:major".
// eslint-disable-next-line no-process-exit
process.exit(0)
