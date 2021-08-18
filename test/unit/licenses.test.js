/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const a = require('async')
const fs = require('fs')
const licenses = require('./licenses')
const path = require('path')
const pkg = require('../../package.json')

const MODULE_DIR = path.resolve(__dirname, '../../node_modules')

const LICENSE_MESSAGE =
  'If licenses are out of date: along with licenses.json, please ' +
  'update LICENSE file and license info on docs site: ' +
  'https://docs.newrelic.com/docs/licenses/license-information/agent-licenses/nodejs-agent-licenses'

test('should all be accounted for in LICENSES object', { timeout: 5000 }, (t) => {
  const deps = Object.keys(pkg.dependencies || {})
  deps.push.apply(deps, Object.keys(pkg.optionalDependencies || {}))

  a.map(
    deps,
    function (dep, cb) {
      a.waterfall(
        [
          function (depCb) {
            fs.readFile(path.join(MODULE_DIR, dep, 'package.json'), { encoding: 'utf8' }, depCb)
          },
          function (depPackage, depsCb) {
            try {
              const parsedPackage = JSON.parse(depPackage)
              const license = parsedPackage.license || parsedPackage.licenses
              setImmediate(function () {
                depsCb(null, [dep, license])
              })
            } catch (e) {
              depsCb(e)
            }
          }
        ],
        cb
      )
    },
    function (err, depLicensesArray) {
      t.error(err)

      const depLicenses = depLicensesArray.reduce(function (obj, dep) {
        obj[dep[0]] = dep[1]
        return obj
      }, {})

      t.same(depLicenses, licenses, LICENSE_MESSAGE)
      t.end()
    }
  )
})
