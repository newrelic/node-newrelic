/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const http = require('http')
const https = require('https')
const helper = require('#testlib/agent_helper.js')

function getMethodFromName(nodule, method) {
  let _nodule

  if (nodule === 'http') {
    _nodule = http
  }
  if (nodule === 'https') {
    _nodule = https
  }

  return _nodule[method]
}

async function testSignature(testOpts) {
  const { nodule, urlType, headers, callback, swapHost, t, method } = testOpts
  const path = '/index.html'

  // Name the test. The URL/options construction depends on the real server's
  // address, which only exists once `beforeEach` has run for this specific
  // child test -- so that part happens inside the `t.test()` callback below,
  // not here.
  const names = []
  if (urlType === 'string') {
    names.push('URL string')
  } else if (urlType === 'object') {
    names.push('URL object')
  }
  if (headers) {
    names.push('options')
  }
  if (swapHost) {
    names.push('options with different hostname')
  }
  if (callback) {
    names.push('callback')
  }
  const testName = names.join(', ')

  await t.test(testName, function (t, end) {
    const { agent, server, tracer } = t.nr
    const { address: host, port } = server.address()
    // For `swapHost`, the URL string names a host that cannot resolve --
    // `.invalid` is reserved by RFC 2606 to never resolve in DNS -- while
    // `opts.hostname` names the real server. If the agent (and Node's own
    // http client) didn't actually honor `opts.hostname` over the URL's own
    // host, the request would simply fail to connect rather than produce a
    // mismatched segment name, so a passing test is real proof opts won.
    const leftPart = swapHost ? `${nodule}://external-test.invalid:${port}` : `${nodule}://${host}:${port}`
    const _url = `${leftPart}${path}`

    // Setup the arguments to the get/request function
    const args = []
    if (urlType === 'string') {
      args.push(_url)
    } else if (urlType === 'object') {
      args.push(global.URL ? new global.URL(_url) : _url)
    }

    const opts = {}
    if (headers) {
      opts.headers = { test: 'test' }
    }
    // If options specifies a hostname, it will override the url parameter
    if (swapHost) {
      opts.hostname = host
    }
    if (Object.keys(opts).length > 0) {
      args.push(opts)
    }

    // Setup a function to test the response.
    const callbackTester = (res) => {
      testResult({ res, end, host, port, path, tracer })
    }

    // Add callback to the arguments, if used
    if (callback) {
      args.push(callbackTester)
    }

    helper.runInTransaction(agent, function () {
      // Methods have to be retrieved within the transaction scope for instrumentation
      const request = getMethodFromName(nodule, method)
      const clientRequest = request(...args)
      clientRequest.end()

      // If not using a callback argument, setup the callback on the 'response' event
      if (!callback) {
        clientRequest.on('response', callbackTester)
      }
    })
  })
}

function testResult({ res, end, host, port, path, tracer }) {
  // Whether or not `swapHost` was in play, the agent should have named the
  // segment after whatever host/port actually got dialed -- which is always
  // the real local server (see the comment in `testSignature` above).
  const external = `External/${host}:${port}${path}`
  const str = 'Hello from New Relic'

  const segment = tracer.getSegment()

  assert.equal(segment.name, external)
  assert.equal(res.statusCode, 200)

  res.on('data', (data) => {
    assert.equal(data.toString(), str)
    end()
  })
}

// Iterates through the given module and method, testing each signature combination. For
// testing the http/https modules and get/request methods.
module.exports = async function testSignatures(nodule, method, t) {
  await testSignature({
    nodule,
    t,
    method,
    urlType: 'object'
  })

  await testSignature({
    nodule,
    t,
    method,
    urlType: 'string'
  })

  await testSignature({
    nodule,
    t,
    method,
    urlType: 'string',
    headers: true
  })

  await testSignature({
    nodule,
    t,
    method,
    urlType: 'object',
    headers: true
  })

  await testSignature({
    nodule,
    t,
    method,
    urlType: 'string',
    callback: true
  })

  await testSignature({
    nodule,
    t,
    method,
    urlType: 'object',
    callback: true
  })

  await testSignature({
    nodule,
    t,
    method,
    urlType: 'string',
    headers: true,
    callback: true
  })

  await testSignature({
    nodule,
    t,
    method,
    urlType: 'object',
    headers: true,
    callback: true
  })

  await testSignature({
    nodule,
    t,
    method,
    urlType: 'string',
    headers: true,
    callback: true,
    swapHost: true
  })

  await testSignature({
    nodule,
    t,
    method,
    urlType: 'object',
    headers: true,
    callback: true,
    swapHost: true
  })
}
