/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const crypto = require('node:crypto')
const path = require('node:path')
const os = require('node:os')
const helper = require('../../../lib/agent_helper')
const { removeModules } = require('../../../lib/cache-buster')

const nodeMajor = parseInt(process.version.split('.')[0].replace('v', ''), 10)

tap.beforeEach((t) => {
  t.context.agent = helper.instrumentMockedAgent()
  t.context.fs = require('node:fs')
})

tap.afterEach((t) => {
  helper.unloadAgent(t.context.agent)
  removeModules(['node:fs'])
})

tap.test('stat method gets instrumented', (t) => {
  const { agent, fs } = t.context
  const tmpdir = os.tmpdir()
  const tmpfile = path.join(tmpdir, crypto.randomBytes(16).toString('hex'))
  t.teardown(() => fs.unlinkSync(tmpfile))

  fs.writeFileSync(tmpfile, 'foo')

  helper.runInTransaction(agent, (tx) => {
    fs.stat(tmpfile, (error) => {
      t.error(error)
      const segment = tx.trace.root.children.find((child) => child.name === 'Filesystem/stat')
      t.ok(segment, 'has stat segment')

      tx.end()
      t.end()
    })
  })
})

tap.test('glob method gets instrumented', { skip: nodeMajor < 22 }, (t) => {
  const { agent, fs } = t.context
  const tmpdir = os.tmpdir()
  const tmpfileName = crypto.randomBytes(16).toString('hex')
  const tmpfile = path.join(tmpdir, tmpfileName)
  t.teardown(() => fs.unlinkSync(tmpfile))

  fs.writeFileSync(tmpfile, 'foo')

  helper.runInTransaction(agent, (tx) => {
    fs.glob(`${tmpdir}${path.sep}*`, (error, matches) => {
      t.error(error)

      const match = matches.find((m) => m.includes(tmpfileName))
      t.ok(match, 'glob found file')

      const segment = tx.trace.root.children.find((child) => child.name === 'Filesystem/glob')
      t.ok(segment, 'has glob segment')

      tx.end()
      t.end()
    })
  })
})
