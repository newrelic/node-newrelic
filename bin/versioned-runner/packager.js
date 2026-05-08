/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const https = require('https')
const semver = require('semver')

function Packager() {
  this._cache = {}
}

Packager.prototype.get = function get(name, wantedVersion) {
  return this._cache[name].filter((v) => semver.satisfies(v, wantedVersion))
}

Packager.prototype.load = function load(name) {
  return new Promise((resolve, reject) => {
    const self = this
    https.get(
      {
        host: 'registry.npmjs.org',
        path: '/' + name.replace('/', encodeURIComponent),
        headers: { accept: 'application/json' }
      },
      function handleRes(response) {
        // Accumulate the response.
        let body = ''
        response.on('data', (data) => {
          body += data.toString('utf8')
        })
        response.on('end', () => {
          // Attempt to parse the reponse.
          let info = null
          try {
            info = JSON.parse(body)
          } catch (e) {
            return reject(e)
          }

          self._cache[name] = Object.keys(info.versions)
          resolve(info.versions)
        })
      }
    )
  })
}

module.exports = new Packager()
