/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helpers = module.exports
const { exec } = require('child_process')
const http = require('http')
const nextPkg = require('next/package.json')
const semver = require('semver')
const newServerResponse = semver.gte(nextPkg.version, '13.3.0')
const noServerClose = semver.gte(nextPkg.version, '13.4.15')
// In 14.1.0 they removed handling exit event to close server.
// SIGTERM existed for a few past versions but not all the way back to 13.4.15
// just emit SIGTERM after 14.1.0
const closeEvent = semver.gte(nextPkg.version, '14.1.0') ? 'SIGTERM' : 'exit'
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

/**
 * Builds a Next.js app
 * @param {sting} dir directory to run next cli in
 * @param {string} [path=app] path to app
 * @returns {Promise}
 *
 */
helpers.build = function build(dir, path = 'app') {
  return new Promise((resolve, reject) => {
    exec(
      `./node_modules/.bin/next build ${path}`,
      {
        cwd: dir
      },
      function cb(err, data) {
        if (err) {
          reject(err)
        }

        resolve(data)
      }
    )
  })
}

/**
 * Bootstraps and starts the Next.js app
 * @param {sting} dir directory to run next cli in
 * @param {string} [path=app] path to app
 * @param {number} [port=3001]
 * @returns {Promise}
 */
helpers.start = async function start(dir, path = 'app', port = 3001) {
  // Needed to support the various locations tests may get loaded from (versioned VS tap <file> VS IDE debugger)
  const fullPath = `${dir}/${path}`

  const { startServer } = require(`${dir}/node_modules/next/dist/server/lib/start-server`)
  const app = await startServer({
    dir: fullPath,
    hostname: '0.0.0.0',
    port,
    allowRetry: true
  })

  if (noServerClose) {
    // 13.4.15 updated startServer to have no return value, so we have to use an event emitter instead for cleanup to fire
    // See: https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/start-server.ts#L192
    return { close: () => process.emit(closeEvent) }
  }

  if (newServerResponse) {
    // app is actually a shutdown function, so wrap it for convenience
    return { close: app }
  }

  await app.prepare()
  return app.options.httpServer
}

/**
 * Makes a http GET request to uri specified
 *
 * @param {string} uri make sure to include `/`
 * @param {number} [port=3001]
 * @returns {Promise}
 */
helpers.makeRequest = function (uri, port = 3001) {
  const url = `http://0.0.0.0:${port}${uri}`
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        resolve(res)
      })
      .on('error', reject)
  })
}

/**
 * Registers all instrumentation for Next.js
 *
 * @param {Agent} agent
 */
helpers.registerInstrumentation = function (agent) {
  const hooks = require('../../nr-hooks')
  hooks.forEach(agent.registerInstrumentation)
}

helpers.findSegmentByName = function (root, name) {
  if (root.name === name) {
    return root
  } else if (root.children && root.children.length) {
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i]
      const found = helpers.findSegmentByName(child, name)
      if (found) {
        return found
      }
    }
  }

  return null
}

helpers.getTransactionEventAgentAttributes = function getTransactionEventAgentAttributes(
  transaction
) {
  return transaction.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
}

helpers.getTransactionIntrinsicAttributes = function getTransactionIntrinsicAttributes(
  transaction
) {
  return transaction.trace.intrinsics
}

helpers.getSegmentAgentAttributes = function getSegmentAgentAttributes(transaction, name) {
  const segment = helpers.findSegmentByName(transaction.trace.root, name)
  if (segment) {
    return segment.attributes.get(DESTINATIONS.SPAN_EVENT)
  }

  return {}
}

// since we setup agent in before we need to remove
// the transactionFinished listener between tests to avoid
// context leaking
helpers.setupTransactionHandler = function setupTransactionHandler({
  t,
  agent,
  expectedCount = 1
}) {
  const transactions = []
  return new Promise((resolve) => {
    function txHandler(transaction) {
      transactions.push(transaction)
      if (expectedCount === transactions.length) {
        resolve(transactions)
      }
    }

    agent.on('transactionFinished', txHandler)

    t.teardown(() => {
      agent.removeListener('transactionFinished', txHandler)
    })
  })
}
