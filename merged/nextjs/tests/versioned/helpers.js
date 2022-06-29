/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helpers = module.exports
const { exec } = require('child_process')
const http = require('http')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')
utils.assert.extendTap(tap)

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
    hostname: 'localhost',
    port,
    allowRetry: true
  })

  await app.prepare()
  return app
}

/**
 * Makes a http GET request to uri specified
 *
 * @param {string} uri make sure to include `/`
 * @param {number} [port=3001]
 * @returns {Promise}
 */
helpers.makeRequest = function (uri, port = 3001) {
  const url = `http://localhost:${port}${uri}`
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
