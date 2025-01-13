/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const crypto = require('node:crypto')
const { tspl } = require('@matteo.collina/tspl')

const helper = require('../../lib/agent_helper')
const verifySegments = require('./verify')
const NAMES = require('../../../lib/metrics/names')

const isGlobSupported = require('semver').satisfies(process.version, '>=22.0.0')
const tempDir = path.join(os.tmpdir(), crypto.randomUUID())
fs.mkdirSync(tempDir)
// Set umask before fs tests (for normalizing create mode on OS X and linux)
process.umask('0000')

function checkMetric(names, agent, scope) {
  let res = true
  const agentMetrics = agent.metrics._metrics
  const metrics = scope ? agentMetrics.scoped[scope] : agentMetrics.unscoped
  names.forEach((name) => {
    res = res && metrics[NAMES.FS.PREFIX + name]
  })
  return res
}

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

test('rename', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 13 })
  const name = path.join(tempDir, 'rename-me')
  const newName = path.join(tempDir, 'renamed')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  helper.runInTransaction(agent, function (trans) {
    fs.rename(name, newName, function (err) {
      plan.ok(!err, 'should not error')
      plan.ok(fs.existsSync(newName), 'file with new name should exist')
      plan.ok(!fs.existsSync(name), 'file with old name should not exist')
      plan.equal(
        fs.readFileSync(newName, 'utf8'),
        content,
        'file with new name should have expected contents'
      )
      verifySegments({ agent, name: NAMES.FS.PREFIX + 'rename', assert: plan })

      trans.end()
      plan.ok(
        checkMetric(['rename'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
  await plan.completed
})

test('truncate', async function (t) {
  const plan = tspl(t, { plan: 12 })
  const { agent } = t.nr
  const name = path.join(tempDir, 'truncate-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  helper.runInTransaction(agent, function (trans) {
    // if fs.ftruncate isn't around, it means that fs.truncate uses a file descriptor
    // rather than a path, and won't trigger an 'open' segment due to implementation
    // differences. This is mostly just a version check for v0.8.
    const expectedSegments = ['open', 'truncate']
    fs.truncate(name, 4, function (err) {
      plan.ok(!err, 'should not error')
      plan.equal(fs.readFileSync(name, 'utf8'), content.slice(0, 4), 'content should be truncated')
      verifySegments({
        agent,
        name: NAMES.FS.PREFIX + 'truncate',
        children: [NAMES.FS.PREFIX + 'open'],
        assert: plan
      })

      trans.end()
      plan.ok(
        checkMetric(expectedSegments, agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
  await plan.completed
})

test('ftruncate', async function (t) {
  const plan = tspl(t, { plan: 11 })
  const { agent } = t.nr
  const name = path.join(tempDir, 'ftruncate-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  helper.runInTransaction(agent, function (trans) {
    fs.ftruncate(fd, 4, function (err) {
      plan.ok(!err, 'should not error')
      plan.equal(fs.readFileSync(name, 'utf8'), content.slice(0, 4), 'content should be truncated')
      verifySegments({ agent, name: NAMES.FS.PREFIX + 'ftruncate', assert: plan })

      trans.end()
      plan.ok(
        checkMetric(['ftruncate'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('chown', async function (t) {
  const plan = tspl(t, { plan: 10 })
  const { agent } = t.nr
  const name = path.join(tempDir, 'chown-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const uid = 0
  const gid = 0
  helper.runInTransaction(agent, function (trans) {
    fs.chown(name, uid, gid, function (err) {
      plan.ok(err, 'should error for non root users')
      verifySegments({ agent, name: NAMES.FS.PREFIX + 'chown', assert: plan })

      trans.end()
      plan.ok(
        checkMetric(['chown'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
  await plan.completed
})

test('fchown', async function (t) {
  const plan = tspl(t, { plan: 10 })
  const { agent } = t.nr
  const name = path.join(tempDir, 'chown-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  const uid = 0
  const gid = 0
  helper.runInTransaction(agent, function (trans) {
    fs.fchown(fd, uid, gid, function (err) {
      plan.ok(err, 'should error for non root users')
      verifySegments({ agent, name: NAMES.FS.PREFIX + 'fchown', assert: plan })

      trans.end()
      plan.ok(
        checkMetric(['fchown'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

// Only exists on Darwin currently, using this check to catch if it
// appears in other versions too.
test('lchown', { skip: fs.lchown === undefined }, async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 10 })
  const name = path.join(tempDir, 'chown-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const uid = 0
  const gid = 0
  helper.runInTransaction(agent, function (trans) {
    fs.lchown(name, uid, gid, function (err) {
      plan.ok(err, 'should error for non root users')
      verifySegments({ agent, name: NAMES.FS.PREFIX + 'lchown', assert: plan })

      trans.end()
      const names = ['lchown']
      plan.ok(checkMetric(names, agent, trans.name), 'metric should exist after transaction end')
    })
  })
  await plan.completed
})

test('chmod', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 12 })
  const name = path.join(tempDir, 'chmod-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  plan.equal((fs.statSync(name).mode & 0x1ff).toString(8), '666')
  helper.runInTransaction(agent, function (trans) {
    fs.chmod(name, '0777', function (err) {
      plan.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      plan.equal((fs.statSync(name).mode & 0x1ff).toString(8), '777')
      verifySegments({ agent, name: NAMES.FS.PREFIX + 'chmod', assert: plan })

      trans.end()
      plan.ok(
        checkMetric(['chmod'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

// Only exists on Darwin currently, using this check to catch if it
// appears in other versions too.
// eslint-disable-next-line n/no-deprecated-api
test('lchmod', { skip: fs.lchmod === undefined }, async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 13 })
  const name = path.join(tempDir, 'lchmod-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  plan.equal((fs.statSync(name).mode & 0x1ff).toString(8), '666')
  helper.runInTransaction(agent, function (trans) {
    // eslint-disable-next-line n/no-deprecated-api
    fs.lchmod(name, '0777', function (err) {
      plan.equal(err, null, 'should not error')
      plan.equal((fs.statSync(name).mode & 0x1ff).toString(8), '777')
      verifySegments({
        agent,
        name: NAMES.FS.PREFIX + 'lchmod',
        children: [NAMES.FS.PREFIX + 'open'],
        assert: plan
      })

      trans.end()
      plan.ok(
        checkMetric(['lchmod', 'open'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('fchmod', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 12 })
  const name = path.join(tempDir, 'fchmod-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  plan.equal((fs.statSync(name).mode & 0x1ff).toString(8), '666')
  helper.runInTransaction(agent, function (trans) {
    fs.fchmod(fd, '0777', function (err) {
      plan.equal(err, null, 'should not error')
      plan.equal((fs.statSync(name).mode & 0x1ff).toString(8), '777')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'fchmod' })

      trans.end()
      plan.ok(
        checkMetric(['fchmod'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('stat', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'stat-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  helper.runInTransaction(agent, function (trans) {
    fs.stat(name, function (err, stat) {
      plan.equal(err, null, 'should not error')
      plan.equal((stat.mode & 0x1ff).toString(8), '666')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'stat' })

      trans.end()
      plan.ok(checkMetric(['stat'], agent, trans.name), 'metric should exist after transaction end')
    })
  })

  await plan.completed
})

test('lstat', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'lstat-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  helper.runInTransaction(agent, function (trans) {
    fs.lstat(name, function (err, stat) {
      plan.equal(err, null, 'should not error')
      plan.equal((stat.mode & 0x1ff).toString(8), '666')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'lstat' })

      trans.end()
      plan.ok(
        checkMetric(['lstat'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('fstat', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'fstat-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  helper.runInTransaction(agent, function (trans) {
    fs.fstat(fd, function (err, stat) {
      plan.equal(err, null, 'should not error')
      plan.equal((stat.mode & 0x1ff).toString(8), '666')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'fstat' })

      trans.end()
      plan.ok(
        checkMetric(['fstat'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('link', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'link-to-me')
  const link = path.join(tempDir, 'link-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  helper.runInTransaction(agent, function (trans) {
    fs.link(name, link, function (err) {
      plan.equal(err, null, 'should not error')
      plan.equal(fs.statSync(name).ino, fs.statSync(link).ino, 'should point to the same file')

      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'link' })

      trans.end()
      plan.ok(checkMetric(['link'], agent, trans.name), 'metric should exist after transaction end')
    })
  })

  await plan.completed
})

test('symlink', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'symlink-to-me')
  const link = path.join(tempDir, 'symlink-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  helper.runInTransaction(agent, function (trans) {
    fs.symlink(name, link, function (err) {
      plan.equal(err, null, 'should not error')
      plan.equal(fs.readlinkSync(link), name, 'should point to the same file')

      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'symlink' })

      trans.end()
      plan.ok(
        checkMetric(['symlink'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('readlink', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'readlink')
  const link = path.join(tempDir, 'readlink-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  helper.runInTransaction(agent, function (trans) {
    fs.readlink(link, function (err, target) {
      plan.equal(err, null, 'should not error')
      plan.equal(target, name, 'should point to the same file')

      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'readlink' })

      trans.end()
      plan.ok(
        checkMetric(['readlink'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
  await plan.completed
})

test('realpath', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 12 })
  const name = path.join(tempDir, 'realpath')
  const link = path.join(tempDir, 'link-to-realpath')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  const real = fs.realpathSync(name)
  helper.runInTransaction(agent, function (trans) {
    fs.realpath(link, function (err, target) {
      plan.equal(err, null, 'should not error')
      plan.equal(target, real, 'should point to the same file')

      verifySegments({
        agent,
        assert: plan,
        name: NAMES.FS.PREFIX + 'realpath',
        children: [NAMES.FS.PREFIX + 'lstat'],
        end: afterVerify
      })

      function afterVerify() {
        trans.end()
        const expectedMetrics = ['realpath']
        plan.ok(
          checkMetric(expectedMetrics, agent, trans.name),
          'metric should exist after transaction end'
        )
      }
    })
  })

  await plan.completed
})

test('realpath.native', async (t) => {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'realpath-native')
  const link = path.join(tempDir, 'link-to-realpath-native')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  const real = fs.realpathSync(name)
  helper.runInTransaction(agent, (trans) => {
    fs.realpath.native(link, (err, target) => {
      plan.equal(err, null, 'should not error')
      plan.equal(target, real, 'should point to the same file')

      verifySegments({
        agent,
        assert: plan,
        name: NAMES.FS.PREFIX + 'realpath.native',
        end: afterVerify
      })

      function afterVerify() {
        trans.end()
        const expectedMetrics = ['realpath.native']
        plan.ok(
          checkMetric(expectedMetrics, agent, trans.name),
          'metric should exist after transaction end'
        )
      }
    })
  })

  await plan.completed
})

test('unlink', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'unlink-from-me')
  const link = path.join(tempDir, 'unlink-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  helper.runInTransaction(agent, function (trans) {
    fs.unlink(link, function (err) {
      plan.equal(err, null, 'should not error')
      plan.ok(!fs.existsSync(link), 'link should not exist')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'unlink' })

      trans.end()
      plan.ok(
        checkMetric(['unlink'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('mkdir', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 12 })
  const name = path.join(tempDir, 'mkdir')
  helper.runInTransaction(agent, function (trans) {
    fs.mkdir(name, function (err) {
      plan.equal(err, null, 'should not error')
      plan.ok(fs.existsSync(name), 'dir should exist')
      plan.ok(fs.readdirSync(name), 'dir should be readable')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'mkdir' })

      trans.end()
      plan.ok(
        checkMetric(['mkdir'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('rmdir', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'rmdir')
  fs.mkdirSync(name)
  helper.runInTransaction(agent, function (trans) {
    fs.rmdir(name, function (err) {
      plan.equal(err, null, 'should not error')
      plan.ok(!fs.existsSync(name), 'dir should not exist')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'rmdir' })

      trans.end()
      plan.ok(
        checkMetric(['rmdir'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('readdir', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'readdir')
  fs.mkdirSync(name)
  helper.runInTransaction(agent, function (trans) {
    fs.readdir(name, function (err, data) {
      plan.equal(err, null, 'should not error')
      plan.deepEqual(data, [], 'should get list of contents')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'readdir' })

      trans.end()
      plan.ok(
        checkMetric(['readdir'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('close', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 10 })
  const name = path.join(tempDir, 'close-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  helper.runInTransaction(agent, function (trans) {
    fs.close(fd, function (err) {
      plan.equal(err, null, 'should not error')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'close' })

      trans.end()
      plan.ok(
        checkMetric(['close'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('open', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'open-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  helper.runInTransaction(agent, function (trans) {
    fs.open(name, 'r+', function (err, fd) {
      plan.equal(err, null, 'should not error')
      plan.ok(fd, 'should get a file descriptor')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'open' })

      trans.end()
      plan.ok(checkMetric(['open'], agent, trans.name), 'metric should exist after transaction end')
    })
  })

  await plan.completed
})

test('utimes', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 12 })
  const name = path.join(tempDir, 'utimes-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const accessed = new Date('2024-11-25T08:00:00.000-05:00')
  const modified = new Date('2024-11-25T08:01:00.000-05:00')

  t.after(async () => await fs.promises.unlink(name))

  helper.runInTransaction(agent, function (trans) {
    fs.utimes(name, accessed, modified, function (err) {
      plan.ok(!err, 'should not error')
      const stats = fs.statSync(name)

      if (process.platform !== 'darwin') {
        plan.equal(stats.atime.toISOString(), accessed.toISOString())
      } else {
        plan.ok('skipping access time check on macOS')
      }

      plan.equal(stats.mtime.toISOString(), modified.toISOString())
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'utimes' })

      trans.end()
      plan.ok(
        checkMetric(['utimes'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('futimes', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 12 })
  const name = path.join(tempDir, 'futimes-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  const accessed = new Date('2024-11-25T08:00:00.000-05:00')
  const modified = new Date('2024-11-25T08:01:00.000-05:00')

  t.after(async () => await fs.promises.unlink(name))

  helper.runInTransaction(agent, function (trans) {
    fs.futimes(fd, accessed, modified, function (err) {
      plan.ok(!err, 'should not error')
      const stats = fs.statSync(name)

      if (process.platform !== 'darwin') {
        plan.equal(stats.atime.toISOString(), accessed.toISOString())
      } else {
        plan.ok('skipping access time check on macOS')
      }

      plan.equal(stats.mtime.toISOString(), modified.toISOString())
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'futimes' })

      trans.end()
      plan.ok(
        checkMetric(['futimes'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('fsync', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 10 })
  const name = path.join(tempDir, 'fsync-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')

  helper.runInTransaction(agent, function (trans) {
    fs.fsync(fd, function (err) {
      plan.ok(!err, 'should not error')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'fsync' })

      trans.end()
      plan.ok(
        checkMetric(['fsync'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('readFile', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 11 })
  const name = path.join(tempDir, 'readFile')
  const content = 'some-content'
  fs.writeFileSync(name, content)

  helper.runInTransaction(agent, function (trans) {
    fs.readFile(name, function (err, data) {
      plan.ok(!err, 'should not error')
      plan.equal(data.toString('utf8'), content)

      verifySegments({
        agent,
        assert: plan,
        name: NAMES.FS.PREFIX + 'readFile'
      })

      trans.end()
      plan.ok(
        checkMetric(['readFile'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('writeFile', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 12 })
  const name = path.join(tempDir, 'writeFile')
  const content = 'some-content'

  helper.runInTransaction(agent, function (trans) {
    fs.writeFile(name, content, function (err) {
      plan.ok(!err, 'should not error')
      plan.equal(fs.readFileSync(name).toString('utf8'), content)
      verifySegments({
        agent,
        assert: plan,
        name: NAMES.FS.PREFIX + 'writeFile',
        children: [NAMES.FS.PREFIX + 'open']
      })

      trans.end()
      plan.ok(
        checkMetric(['writeFile', 'open'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('appendFile', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 12 })
  const name = path.join(tempDir, 'appendFile')
  const content = 'some-content'
  fs.writeFileSync(name, content)

  const expectedSegments = ['appendFile', 'writeFile']

  helper.runInTransaction(agent, function (trans) {
    fs.appendFile(name, '123', function (err) {
      plan.ok(!err, 'should not error')
      plan.equal(fs.readFileSync(name).toString('utf-8'), content + '123')
      verifySegments({
        agent,
        assert: plan,
        name: NAMES.FS.PREFIX + 'appendFile',
        children: [NAMES.FS.PREFIX + 'writeFile']
      })

      trans.end()
      plan.ok(
        checkMetric(expectedSegments, agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('exists', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 10 })
  const name = path.join(tempDir, 'exists')
  const content = 'some-content'
  fs.writeFileSync(name, content)

  helper.runInTransaction(agent, function (trans) {
    // eslint-disable-next-line n/no-deprecated-api
    fs.exists(name, function (exists) {
      plan.ok(exists, 'should exist')
      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'exists' })

      trans.end()
      plan.ok(
        checkMetric(['exists'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })

  await plan.completed
})

test('read', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 5 })
  const name = path.join(tempDir, 'read')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')

  const buf = Buffer.alloc(content.length)

  helper.runInTransaction(agent, function (trans) {
    fs.read(fd, buf, 0, content.length, 0, function (err, len, data) {
      plan.ok(!err, 'should not error')
      plan.equal(len, 12, 'should read correct number of bytes')
      plan.equal(data.toString('utf8'), content)
      plan.equal(agent.getTransaction(), trans, 'should preserve transaction')
      plan.equal(trans.trace.root.children.length, 0, 'should not create any segments')
    })
  })

  await plan.completed
})

test('write', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 5 })
  const name = path.join(tempDir, 'write')
  const content = 'some-content'
  fs.writeFileSync(name, '')
  const fd = fs.openSync(name, 'r+')

  const buf = Buffer.from(content)

  helper.runInTransaction(agent, function (trans) {
    fs.write(fd, buf, 0, content.length, 0, function (err, len) {
      plan.ok(!err, 'should not error')
      plan.equal(len, 12, 'should write correct number of bytes')
      plan.equal(fs.readFileSync(name, 'utf8'), content)
      plan.equal(agent.getTransaction(), trans, 'should preserve transaction')
      plan.equal(trans.trace.root.children.length, 0, 'should not create any segments')
    })
  })

  await plan.completed
})

test('watch (file)', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 5 })

  const name = path.join(tempDir, 'watch-file')
  const content = 'some-content'

  fs.writeFileSync(name, content)

  setTimeout(function () {
    helper.runInTransaction(agent, function (trans) {
      const watcher = fs.watch(name, function (ev, file) {
        plan.equal(ev, 'change', 'should be expected event')

        plan.equal(file, 'watch-file', 'should have correct file name')
        plan.equal(agent.getTransaction(), trans, 'should preserve transaction')
        plan.equal(trans.trace.root.children.length, 1, 'should not create any segments')
        watcher.close()
      })
      fs.writeFile(name, content + 'more', function (err) {
        plan.ok(!err, 'should not fail to write to file')
      })
    })
  }, 10)

  await plan.completed
})

test('watch (dir)', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 5 })

  const name = path.join(tempDir, 'watch-dir')
  const content = 'some-content'

  setTimeout(function () {
    helper.runInTransaction(agent, function (trans) {
      const watcher = fs.watch(tempDir, function (ev, file) {
        plan.equal(ev, 'rename')
        plan.equal(file, 'watch-dir')
        plan.equal(agent.getTransaction(), trans, 'should preserve transaction')
        plan.equal(trans.trace.root.children.length, 1, 'should not create any segments')
        watcher.close()
      })
      fs.writeFile(name, content, function (err) {
        plan.ok(!err, 'should not fail to write to file')
      })
    })
  }, 10)

  await plan.completed
})

test('watch emitter', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 5 })

  const name = path.join(tempDir, 'watch')
  const content = 'some-content'

  setTimeout(function () {
    helper.runInTransaction(agent, function (trans) {
      const watcher = fs.watch(tempDir)

      watcher.on('change', function (ev, file) {
        plan.equal(ev, 'rename', 'should have expected event')
        plan.equal(file, 'watch', 'should be for correct directory')

        const tx = agent.getTransaction()
        const root = trans.trace.root
        plan.equal(tx && tx.id, trans.id, 'should preserve transaction')
        plan.equal(root.children.length, 1, 'should not create any segments')

        watcher.close()
      })

      fs.writeFile(name, content, function (err) {
        plan.ok(!err, 'should not fail to write to file')
      })
    })
  }, 10)

  await plan.completed
})

test('watchFile', async function (t) {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 5 })

  const name = path.join(tempDir, 'watchFile')
  const content = 'some-content'

  fs.writeFileSync(name, content)

  setTimeout(function () {
    helper.runInTransaction(agent, function (trans) {
      fs.watchFile(name, onChange)

      function onChange(cur, prev) {
        plan.ok(cur.mtime > prev.mtime, 'modified date incremented')
        plan.ok(cur.size > prev.size, 'content modified')

        plan.equal(agent.getTransaction(), trans, 'should preserve transaction')
        plan.equal(trans.trace.root.children.length, 0, 'should not create any segments')
        fs.unwatchFile(name, onChange)
      }
    })

    fs.writeFile(name, content + 'more', function (err) {
      plan.ok(!err, 'should not fail to write to file')
    })
  }, 10)

  await plan.completed
})

test('glob', { skip: isGlobSupported === false }, async function (t) {
  const { agent } = t.nr
  const name = path.join(tempDir, 'glob-me')
  const plan = tspl(t, { plan: 11 })
  const content = 'some-content'
  fs.writeFileSync(name, content)

  helper.runInTransaction(agent, function (tx) {
    fs.glob(`${tempDir}${path.sep}*glob-me*`, function (error, matches) {
      plan.ok(!error)

      const match = matches.find((m) => m.includes('glob-me'))
      plan.ok(match, 'glob found file')

      verifySegments({ agent, assert: plan, name: NAMES.FS.PREFIX + 'glob' })

      tx.end()
      plan.ok(checkMetric(['glob'], agent, tx.name), 'metric should exist after transaction end')
    })
  })

  await plan.completed
})
