/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

const http = require('http')

function createEmptyResponseServer() {
  const server = http.createServer(function(req, res) {
    if (
      req.method === 'GET' ||
      req.method === 'POST' ||
      req.method === 'PUT' ||
      req.method === 'HEAD' ||
      req.method === 'DELETE'
    ) {
      handlePost(req, res)
      return
    }

    // sometimes the aws-sdk will obfuscate this error
    // so logging out.
    // eslint-disable-next-line no-console
    console.log('Unhandled request method: ', req.method)

    res.statusCode = 500
    res.end('Unhandled request method')
  })

  return server
}

function handlePost(req, res) {
  req.on('data', () => {})

  req.on('end', () => {
    // currently, some tests do not rely on real responses back.
    // it is enough to return something valid to the client.
    res.end()
  })
}

module.exports = createEmptyResponseServer
