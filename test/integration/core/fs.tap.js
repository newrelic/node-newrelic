/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tapTest = require('tap').test
const path = require('path')
const temp = require('temp')
const fs = require('fs')
const helper = require('../../lib/agent_helper')
const verifySegments = require('./verify')
const NAMES = require('../../../lib/metrics/names')

// delete temp files before process exits
temp.track()

const tempDir = temp.mkdirSync('fs-tests')

// Set umask before and after fs tests (for normalizing create mode on OS X and linux)
const mask = process.umask('0000')
let tasks = 0
let done = 0

// Because of how async all these tests are, and that they interact with a something slow
// like the filesystem, there were problems with them timing out in aggregate. Doing this,
// rather than using a parent test avoids this problem. Node-tap was also causing problems
// with this set of tests.
function test(title, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  if (!options.skip) {
    tasks++
  }
  options.timeout = 15000 // Allow for a slow file system.
  tapTest(title, options, function (t) {
    t.teardown(function () {
      if (++done === tasks) {
        process.umask(mask)
      }
    })

    callback.apply(this, arguments)
  })
}

function checkMetric(names, agent, scope) {
  let res = true
  const agentMetrics = getMetrics(agent)
  const metrics = scope ? agentMetrics.scoped[scope] : agentMetrics.unscoped
  names.forEach((name) => {
    res = res && metrics[NAMES.FS.PREFIX + name]
  })
  return res
}

test('rename', function (t) {
  const name = path.join(tempDir, 'rename-me')
  const newName = path.join(tempDir, 'renamed')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.rename(name, newName, function (err) {
      t.notOk(err, 'should not error')
      helper.unloadAgent(agent)
      t.ok(fs.existsSync(newName), 'file with new name should exist')
      t.notOk(fs.existsSync(name), 'file with old name should not exist')
      t.equal(
        fs.readFileSync(newName, 'utf8'),
        content,
        'file with new name should have expected contents'
      )
      verifySegments(t, agent, NAMES.FS.PREFIX + 'rename')

      trans.end()
      t.ok(checkMetric(['rename'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('truncate', function (t) {
  const name = path.join(tempDir, 'truncate-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    // if fs.ftruncate isn't around, it means that fs.truncate uses a file descriptor
    // rather than a path, and won't trigger an 'open' segment due to implementation
    // differences. This is mostly just a version check for v0.8.
    const expectedSegments = ['open', 'truncate']
    fs.truncate(name, 4, function (err) {
      t.notOk(err, 'should not error')
      helper.unloadAgent(agent)
      t.equal(fs.readFileSync(name, 'utf8'), content.slice(0, 4), 'content should be truncated')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'truncate', [NAMES.FS.PREFIX + 'open'])

      trans.end()
      t.ok(
        checkMetric(expectedSegments, agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('ftruncate', function (t) {
  const name = path.join(tempDir, 'ftruncate-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.ftruncate(fd, 4, function (err) {
      t.notOk(err, 'should not error')
      helper.unloadAgent(agent)
      t.equal(fs.readFileSync(name, 'utf8'), content.slice(0, 4), 'content should be truncated')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'ftruncate')

      trans.end()
      t.ok(
        checkMetric(['ftruncate'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('chown', function (t) {
  const name = path.join(tempDir, 'chown-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  const uid = 0
  const gid = 0
  helper.runInTransaction(agent, function (trans) {
    fs.chown(name, uid, gid, function (err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'chown')

      trans.end()
      t.ok(checkMetric(['chown'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('fchown', function (t) {
  const name = path.join(tempDir, 'chown-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  const agent = setupAgent(t)
  const uid = 0
  const gid = 0
  helper.runInTransaction(agent, function (trans) {
    fs.fchown(fd, uid, gid, function (err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fchown')

      trans.end()
      t.ok(checkMetric(['fchown'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

// Only exists on Darwin currently, using this check to catch if it
// appears in other versions too.
test('lchown', { skip: fs.lchown === undefined }, function (t) {
  const name = path.join(tempDir, 'chown-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  const uid = 0
  const gid = 0
  helper.runInTransaction(agent, function (trans) {
    fs.lchown(name, uid, gid, function (err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'lchown')

      trans.end()
      const names = ['lchown']
      t.ok(checkMetric(names, agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('chmod', function (t) {
  const name = path.join(tempDir, 'chmod-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 0x1ff).toString(8), '666')
  helper.runInTransaction(agent, function (trans) {
    fs.chmod(name, '0777', function (err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 0x1ff).toString(8), '777')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'chmod')

      trans.end()
      t.ok(checkMetric(['chmod'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

// Only exists on Darwin currently, using this check to catch if it
// appears in other versions too.
// eslint-disable-next-line node/no-deprecated-api
test('lchmod', { skip: fs.lchmod === undefined }, function (t) {
  const name = path.join(tempDir, 'lchmod-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 0x1ff).toString(8), '666')
  helper.runInTransaction(agent, function (trans) {
    // eslint-disable-next-line node/no-deprecated-api
    fs.lchmod(name, '0777', function (err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 0x1ff).toString(8), '777')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'lchmod', [NAMES.FS.PREFIX + 'open'])

      trans.end()
      t.ok(
        checkMetric(['lchmod', 'open'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('fchmod', function (t) {
  const name = path.join(tempDir, 'fchmod-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  const agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 0x1ff).toString(8), '666')
  helper.runInTransaction(agent, function (trans) {
    fs.fchmod(fd, '0777', function (err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 0x1ff).toString(8), '777')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fchmod')

      trans.end()
      t.ok(checkMetric(['fchmod'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('stat', function (t) {
  const name = path.join(tempDir, 'stat-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.stat(name, function (err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 0x1ff).toString(8), '666')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'stat')

      trans.end()
      t.ok(checkMetric(['stat'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('lstat', function (t) {
  const name = path.join(tempDir, 'lstat-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.lstat(name, function (err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 0x1ff).toString(8), '666')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'lstat')

      trans.end()
      t.ok(checkMetric(['lstat'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('fstat', function (t) {
  const name = path.join(tempDir, 'fstat-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.fstat(fd, function (err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 0x1ff).toString(8), '666')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fstat')

      trans.end()
      t.ok(checkMetric(['fstat'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('link', function (t) {
  const name = path.join(tempDir, 'link-to-me')
  const link = path.join(tempDir, 'link-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.link(name, link, function (err) {
      t.equal(err, null, 'should not error')
      t.equal(fs.statSync(name).ino, fs.statSync(link).ino, 'should point to the same file')

      verifySegments(t, agent, NAMES.FS.PREFIX + 'link')

      trans.end()
      t.ok(checkMetric(['link'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('symlink', function (t) {
  const name = path.join(tempDir, 'symlink-to-me')
  const link = path.join(tempDir, 'symlink-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.symlink(name, link, function (err) {
      t.equal(err, null, 'should not error')
      t.equal(fs.readlinkSync(link), name, 'should point to the same file')

      verifySegments(t, agent, NAMES.FS.PREFIX + 'symlink')

      trans.end()
      t.ok(checkMetric(['symlink'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('readlink', function (t) {
  const name = path.join(tempDir, 'readlink')
  const link = path.join(tempDir, 'readlink-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.readlink(link, function (err, target) {
      t.equal(err, null, 'should not error')
      t.equal(target, name, 'should point to the same file')

      verifySegments(t, agent, NAMES.FS.PREFIX + 'readlink')

      trans.end()
      t.ok(
        checkMetric(['readlink'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('realpath', function (t) {
  const name = path.join(tempDir, 'realpath')
  const link = path.join(tempDir, 'link-to-realpath')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  const real = fs.realpathSync(name)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.realpath(link, function (err, target) {
      t.equal(err, null, 'should not error')
      t.equal(target, real, 'should point to the same file')

      verifySegments(
        t,
        agent,
        NAMES.FS.PREFIX + 'realpath',
        [NAMES.FS.PREFIX + 'lstat'],
        afterVerify
      )

      function afterVerify() {
        trans.end()
        const expectedMetrics = ['realpath']
        t.ok(
          checkMetric(expectedMetrics, agent, trans.name),
          'metric should exist after transaction end'
        )
        t.end()
      }
    })
  })
})

test('realpath.native', (t) => {
  if (!fs.realpath.native) {
    return t.end()
  }
  const name = path.join(tempDir, 'realpath-native')
  const link = path.join(tempDir, 'link-to-realpath-native')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  const real = fs.realpathSync(name)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, (trans) => {
    fs.realpath.native(link, (err, target) => {
      t.equal(err, null, 'should not error')
      t.equal(target, real, 'should point to the same file')

      verifySegments(t, agent, NAMES.FS.PREFIX + 'realpath.native', afterVerify)

      function afterVerify() {
        trans.end()
        const expectedMetrics = ['realpath.native']
        t.ok(
          checkMetric(expectedMetrics, agent, trans.name),
          'metric should exist after transaction end'
        )
        t.end()
      }
    })
  })
})

test('unlink', function (t) {
  const name = path.join(tempDir, 'unlink-from-me')
  const link = path.join(tempDir, 'unlink-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.unlink(link, function (err) {
      t.equal(err, null, 'should not error')
      t.notOk(fs.existsSync(link), 'link should not exist')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'unlink')

      trans.end()
      t.ok(checkMetric(['unlink'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('mkdir', function (t) {
  const name = path.join(tempDir, 'mkdir')
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.mkdir(name, function (err) {
      t.equal(err, null, 'should not error')
      t.ok(fs.existsSync(name), 'dir should exist')
      t.ok(fs.readdirSync(name), 'dir should be readable')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'mkdir')

      trans.end()
      t.ok(checkMetric(['mkdir'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('rmdir', function (t) {
  const name = path.join(tempDir, 'rmdir')
  const agent = setupAgent(t)
  fs.mkdirSync(name)
  helper.runInTransaction(agent, function (trans) {
    fs.rmdir(name, function (err) {
      t.equal(err, null, 'should not error')
      t.notOk(fs.existsSync(name), 'dir should not exist')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'rmdir')

      trans.end()
      t.ok(checkMetric(['rmdir'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('readdir', function (t) {
  const name = path.join(tempDir, 'readdir')
  const agent = setupAgent(t)
  fs.mkdirSync(name)
  helper.runInTransaction(agent, function (trans) {
    fs.readdir(name, function (err, data) {
      t.equal(err, null, 'should not error')
      t.same(data, [], 'should get list of contents')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'readdir')

      trans.end()
      t.ok(checkMetric(['readdir'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('close', function (t) {
  const name = path.join(tempDir, 'close-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.close(fd, function (err) {
      t.equal(err, null, 'should not error')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'close')

      trans.end()
      t.ok(checkMetric(['close'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('open', function (t) {
  const name = path.join(tempDir, 'open-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (trans) {
    fs.open(name, 'r+', function (err, fd) {
      t.equal(err, null, 'should not error')
      t.ok(fd, 'should get a file descriptor')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'open')

      trans.end()
      t.ok(checkMetric(['open'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('utimes', function (t) {
  const name = path.join(tempDir, 'utimes-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  const accessed = 5
  const modified = 15

  helper.runInTransaction(agent, function (trans) {
    fs.utimes(name, accessed, modified, function (err) {
      t.notOk(err, 'should not error')
      const stats = fs.statSync(name)
      t.equal(stats.atime.toISOString(), '1970-01-01T00:00:05.000Z')
      t.equal(stats.mtime.toISOString(), '1970-01-01T00:00:15.000Z')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'utimes')

      trans.end()
      t.ok(checkMetric(['utimes'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('futimes', function (t) {
  const name = path.join(tempDir, 'futimes-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  const agent = setupAgent(t)
  const accessed = 5
  const modified = 15

  helper.runInTransaction(agent, function (trans) {
    fs.futimes(fd, accessed, modified, function (err) {
      t.notOk(err, 'should not error')
      const stats = fs.statSync(name)
      t.equal(stats.atime.toISOString(), '1970-01-01T00:00:05.000Z')
      t.equal(stats.mtime.toISOString(), '1970-01-01T00:00:15.000Z')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'futimes')

      trans.end()
      t.ok(checkMetric(['futimes'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('fsync', function (t) {
  const name = path.join(tempDir, 'fsync-me')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function (trans) {
    fs.fsync(fd, function (err) {
      t.notOk(err, 'should not error')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fsync')

      trans.end()
      t.ok(checkMetric(['fsync'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('readFile', function (t) {
  const name = path.join(tempDir, 'readFile')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function (trans) {
    fs.readFile(name, function (err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString('utf8'), content)

      let expectFSOpen = true
      // io.js changed their implementation of fs.readFile to use process.binding.
      // This caused the file opening not to be added to the trace when using io.js.
      // By checking this value, we can determine whether or not to expect it.
      if (agent.getTransaction().trace.root.children[0].children.length === 1) {
        expectFSOpen = false
      }
      verifySegments(
        t,
        agent,
        NAMES.FS.PREFIX + 'readFile',
        expectFSOpen ? [NAMES.FS.PREFIX + 'open'] : []
      )

      trans.end()
      t.ok(
        checkMetric(expectFSOpen ? ['open', 'readFile'] : ['readFile'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('writeFile', function (t) {
  const name = path.join(tempDir, 'writeFile')
  const content = 'some-content'
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function (trans) {
    fs.writeFile(name, content, function (err) {
      t.notOk(err, 'should not error')
      t.equal(fs.readFileSync(name).toString('utf8'), content)
      verifySegments(t, agent, NAMES.FS.PREFIX + 'writeFile', [NAMES.FS.PREFIX + 'open'])

      trans.end()
      t.ok(
        checkMetric(['writeFile', 'open'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('appendFile', function (t) {
  const name = path.join(tempDir, 'appendFile')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)
  const expectedSegments = ['appendFile', 'writeFile']

  helper.runInTransaction(agent, function (trans) {
    fs.appendFile(name, '123', function (err) {
      t.notOk(err, 'should not error')
      t.equal(fs.readFileSync(name).toString('utf-8'), content + '123')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'appendFile', [NAMES.FS.PREFIX + 'writeFile'])

      trans.end()
      t.ok(
        checkMetric(expectedSegments, agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('exists', function (t) {
  const name = path.join(tempDir, 'exists')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function (trans) {
    // eslint-disable-next-line node/no-deprecated-api
    fs.exists(name, function (exists) {
      t.ok(exists, 'should exist')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'exists')

      trans.end()
      t.ok(checkMetric(['exists'], agent, trans.name), 'metric should exist after transaction end')
    })
  })
})

test('read', function (t) {
  const name = path.join(tempDir, 'read')
  const content = 'some-content'
  fs.writeFileSync(name, content)
  const fd = fs.openSync(name, 'r+')
  const agent = setupAgent(t)
  const buf = Buffer.alloc(content.length)

  helper.runInTransaction(agent, function (trans) {
    fs.read(fd, buf, 0, content.length, 0, function (err, len, data) {
      t.notOk(err, 'should not error')
      t.equal(len, 12, 'should read correct number of bytes')
      t.equal(data.toString('utf8'), content)
      t.equal(agent.getTransaction(), trans, 'should preserve transaction')
      t.equal(trans.trace.root.children.length, 0, 'should not create any segments')
      t.end()
    })
  })
})

test('write', function (t) {
  const name = path.join(tempDir, 'write')
  const content = 'some-content'
  fs.writeFileSync(name, '')
  const fd = fs.openSync(name, 'r+')
  const agent = setupAgent(t)
  const buf = Buffer.from(content)

  helper.runInTransaction(agent, function (trans) {
    fs.write(fd, buf, 0, content.length, 0, function (err, len) {
      t.notOk(err, 'should not error')
      t.equal(len, 12, 'should write correct number of bytes')
      t.equal(fs.readFileSync(name, 'utf8'), content)
      t.equal(agent.getTransaction(), trans, 'should preserve transaction')
      t.equal(trans.trace.root.children.length, 0, 'should not create any segments')
      t.end()
    })
  })
})

test('watch (file)', function (t) {
  t.plan(5)

  const name = path.join(tempDir, 'watch-file')
  const content = 'some-content'
  const agent = setupAgent(t)
  fs.writeFileSync(name, content)

  setTimeout(function () {
    helper.runInTransaction(agent, function (trans) {
      const watcher = fs.watch(name, function (ev, file) {
        t.equal(ev, 'change', 'should be expected event')

        t.equal(file, 'watch-file', 'should have correct file name')
        t.equal(agent.getTransaction(), trans, 'should preserve transaction')
        t.equal(trans.trace.root.children.length, 1, 'should not create any segments')
        watcher.close()
      })
      fs.writeFile(name, content + 'more', function (err) {
        t.error(err, 'should not fail to write to file')
      })
    })
  }, 10)
})

test('watch (dir)', function (t) {
  t.plan(5)

  const name = path.join(tempDir, 'watch-dir')
  const content = 'some-content'
  const agent = setupAgent(t)

  setTimeout(function () {
    helper.runInTransaction(agent, function (trans) {
      const watcher = fs.watch(tempDir, function (ev, file) {
        t.equal(ev, 'rename')
        t.equal(file, 'watch-dir')
        t.equal(agent.getTransaction(), trans, 'should preserve transaction')
        t.equal(trans.trace.root.children.length, 1, 'should not create any segments')
        watcher.close()
      })
      fs.writeFile(name, content, function (err) {
        t.error(err, 'should not fail to write to file')
      })
    })
  }, 10)
})

test('watch emitter', function (t) {
  t.plan(5)

  const name = path.join(tempDir, 'watch')
  const content = 'some-content'
  const agent = setupAgent(t)

  setTimeout(function () {
    helper.runInTransaction(agent, function (trans) {
      const watcher = fs.watch(tempDir)

      watcher.on('change', function (ev, file) {
        t.equal(ev, 'rename', 'should have expected event')
        t.equal(file, 'watch', 'should be for correct directory')

        const tx = agent.getTransaction()
        const root = trans.trace.root
        t.equal(tx && tx.id, trans.id, 'should preserve transaction')
        t.equal(root.children.length, 1, 'should not create any segments')

        watcher.close()
      })

      fs.writeFile(name, content, function (err) {
        t.error(err, 'should not fail to write to file')
      })
    })
  }, 10)
})

test('watchFile', function (t) {
  t.plan(5)

  const name = path.join(tempDir, 'watchFile')
  const content = 'some-content'
  const agent = setupAgent(t)
  fs.writeFileSync(name, content)

  setTimeout(function () {
    helper.runInTransaction(agent, function (trans) {
      fs.watchFile(name, onChange)

      function onChange(cur, prev) {
        t.ok(cur.mtime > prev.mtime, 'modified date incremented')
        t.ok(cur.size > prev.size, 'content modified')

        t.equal(agent.getTransaction(), trans, 'should preserve transaction')
        t.equal(trans.trace.root.children.length, 0, 'should not create any segments')
        fs.unwatchFile(name, onChange)
      }
    })

    fs.writeFile(name, content + 'more', function (err) {
      t.error(err, 'should not fail to write to file')
    })
  }, 10)
})

function setupAgent(t) {
  const agent = helper.instrumentMockedAgent()
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  return agent
}

function getMetrics(agent) {
  return agent.metrics._metrics
}
