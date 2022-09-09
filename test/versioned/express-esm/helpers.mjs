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
  /**
   * This rule is not fully fleshed out and the library is no longer maintained
   * See: https://github.com/mysticatea/eslint-plugin-node/issues/250
   * Fix would be to migrate to use https://github.com/weiran-zsd/eslint-plugin-node
   */

  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  const expressExport = await import('express')
  const express = expressExport.default
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
 * @param {Object} params.app express instance
 * @param {Object} params.t tap test
 * @param {Object} params.agent mocked agent
 * @param {string} params.endpoint URI
 */
helpers.makeRequestAndFinishTransaction = async function makeRequestAndFinishTransaction({
  app,
  t,
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

  const server = app.listen(function () {
    helpers.makeRequest(this, endpoint)
  })
  t.teardown(() => {
    server.close()
    agent.removeListener('transactionFinished', transactionHandler)
  })

  return promise
}

export default helpers
