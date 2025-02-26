/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const http = require('node:http')

async function createAwsLambdaApiServer() {
  const server = http.createServer(httpRequestHandler)

  let hostname
  let port
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => {
      if (error) return reject(error)
      hostname = server.address().address
      port = server.address().port
      resolve()
    })
  })

  return { server, hostname, port }
}

function httpRequestHandler(req, res) {
  const url = new URL(`http://localhost${req.url}`)
  const path = url.pathname

  switch (true) {
    case path === '/2018-06-01/runtime/init/error': {
      // Receives POST messages when there was some error initializing
      // the Lambda function.
      res.writeHead(202)
      res.end('error received')
      break
    }

    case path === '/2018-06-01/runtime/invocation/next': {
      // Receives GET requests that need details on the next invocation.
      // Should return an "invocation object" that contains the body as
      // json and the headers hash, e.g. `{ bodyJson, headers }`.
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        jsonBody: JSON.stringify({ hello: 'world' }),
        headers: {
          one: 'one'
        }
      }))
      break
    }

    case path.endsWith('/response') === true: {
      // Receive POST messages to initiate returning of a response from a
      // handler back to the Lambda API.
      res.writeHead(202)
      res.end('handling response')
      break
    }

    default: {
      res.writeHead(500)
      res.end('new phone. who dis?')
    }
  }
}

function createAwsResponseStream({ hostname, port }) {
  const headers = {
    'Lambda-Runtime-Function-Response-Mode': 'streaming',
    trailer: 'Lambda-Runtime-Function-Error-Type, Lambda-Runtime-Function-Error-Body',
    'content-type': 'application/octet-stream'
  }

  let responseDoneResolve
  let responseDoneReject
  const responseDonePromise = new Promise((resolve, reject) => {
    responseDoneResolve = resolve
    responseDoneReject = reject
  })

  let headersDoneResolve
  let headersDoneReject
  const headersDonePromise = new Promise((resolve, reject) => {
    headersDoneResolve = resolve
    headersDoneReject = reject
  })

  const request = http.request(
    {
      hostname,
      port,
      method: 'POST',
      path: '/2018-06-01/runtime/invocation/invocation-id-123/response',
      headers
    },

    res => {
      headersDoneResolve({
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers
      })

      let result = ''
      res.on('data', chunk => {
        result += chunk
      })

      res.on('aborted', error => {
        if (responseDoneReject) responseDoneReject(error)
        request.destroy(error)
      })

      res.on('end', () => {
        responseDoneResolve(result)
      })
    }
  )

  request.on('error', error => {
    if (headersDoneReject) headersDoneReject(error)
    if (responseDoneReject) responseDoneReject(error)
    request.destroy(error)
  })

  // It's not clear why AWS is doing this, but we replicate it here for
  // completeness sake.
  const origEnd = request.end.bind(request)
  request.end = function (cb) { origEnd(cb) }

  // AWS adds this custom method to the stream. Without it, the handler
  // will fail.
  request.setContentType = function (contentType) {
    // We're skipping the STATUS_READY block here because we do not intend
    // to replicate the customized `write` method. If we need to implement
    // that method, then we should also update this one.
    request.setHeader('content-type', contentType)
  }

  return {
    request,
    headersDone: headersDonePromise,
    responseDone: responseDonePromise
  }
}

module.exports = { createAwsLambdaApiServer, createAwsResponseStream }
