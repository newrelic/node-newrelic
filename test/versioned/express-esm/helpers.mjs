/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'node:http'

const helpers = Object.create(null)

/**
 * Imports express, creates an express app and returns both as an object
 * @returns { app, express }
 */
helpers.setup = async function setup() {
  const { default: express } = await import('express')
  const app = express()
  return { app, express }
}

/**
 * Makes a http request to endpoint of server
 *
 * @param {http.Server} server
 * @param {string} endpoint URI
 *
 */
helpers.makeRequest = function makeRequest(server, endpoint) {
  const port = server.address().port
  http.request({ port, path: endpoint }).end()
}

/**
 * Listens to express app, makes request, and returns transaction when `transactionFinished` event fires
 *
 * @param {Object} params
 * @param {Object} params.server the underlying core server instance of the
 * express app
 * @param {Object} params.agent mocked agent
 * @param {string} params.endpoint URI
 */
helpers.makeRequestAndFinishTransaction = async function makeRequestAndFinishTransaction({
  server,
  agent,
  endpoint
}) {
  let transactionHandler = null
  const promise = new Promise((resolve) => {
    transactionHandler = function txHandler(transaction) {
      resolve(transaction)
    }
  })

  agent.on('transactionFinished', transactionHandler)

  helpers.makeRequest(server, endpoint)

  return promise
}

export default helpers
