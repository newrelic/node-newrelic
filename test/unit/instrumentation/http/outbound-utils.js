/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const http = require('http')
const https = require('https')
const nock = require('nock')
const helper = require('../../../lib/agent_helper')

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
  const host = 'www.newrelic.com'
  const port = ''
  const path = '/index.html'
  const leftPart = `${nodule}://${host}`
  const _url = `${leftPart}${path}`

  // Setup the arguments and the test name
  const args = [] // Setup arguments to the get/request function
  const names = [] // Capture parameters for the name of the test

  // See if a URL argument is being used
  if (urlType === 'string') {
    args.push(_url)
    names.push('URL string')
  } else if (urlType === 'object') {
    args.push(global.URL ? new global.URL(_url) : _url)
    names.push('URL object')
  }

  // See if an options argument should be used
  const opts = {}
  if (headers) {
    opts.headers = { test: 'test' }
    names.push('options')
  }
  // If options specifies a hostname, it will override the url parameter
  if (swapHost) {
    opts.hostname = 'www.google.com'
    names.push('options with different hostname')
  }
  if (Object.keys(opts).length > 0) {
    args.push(opts)
  }

  // If the callback argument should be setup, just add it to the name for now, and
  // setup within the it() call since the callback needs to access the done() function
  if (callback) {
    names.push('callback')
  }

  // Name the test and start it
  const testName = names.join(', ')

  await t.test(testName, function (t, end) {
    const { agent, contextManager } = t.nr
    // If testing the options overriding the URL argument, set up nock differently
    if (swapHost) {
      nock(`${nodule}://www.google.com`).get(path).reply(200, 'Hello from Google')
    } else {
      nock(leftPart).get(path).reply(200, 'Hello from New Relic')
    }

    // Setup a function to test the response.
    const callbackTester = (res) => {
      testResult({ res, headers, swapHost, end, host, port, path, contextManager })
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

function testResult({ res, headers, swapHost, end, host, port, path, contextManager }) {
  let external = `External/${host}${port}${path}`
  let str = 'Hello from New Relic'
  if (swapHost) {
    external = `External/www.google.com${port}/index.html`
    str = 'Hello from Google'
  }

  const segment = contextManager.getContext()

  assert.equal(segment.name, external)
  assert.equal(res.statusCode, 200)

  res.on('data', (data) => {
    if (headers) {
      assert.equal(res.req.headers.test, 'test')
    }
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
