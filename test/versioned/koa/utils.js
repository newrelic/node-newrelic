/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const utils = module.exports
const http = require('node:http')

utils.run = function run({ path = '/123', context }) {
  context.server = context.app.listen(0, function () {
    http
      .get({
        port: context.server.address().port,
        path
      })
      .end()
  })
}

utils.startServer = async function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

utils.makeRequest = async function makeRequest(params) {
  return new Promise((resolve, reject) => {
    const req = http.request(params, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`Status Code: ${res.statusCode}`))
        return
      }

      const data = []

      res.on('data', (chunk) => {
        data.push(chunk)
      })

      res.on('end', () => resolve(Buffer.concat(data).toString()))
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.end()
  })
}
