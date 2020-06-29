/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var tapTest = require('tap').test
var path = require('path')
var temp = require('temp')
var fs = require('fs')
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify')
var semver = require('semver')

var NAMES = require('../../../lib/metrics/names')

// delete temp files before process exits
temp.track()

var tempDir = temp.mkdirSync('fs-tests')

// Set umask before and after fs tests (for normalizing create mode on OS X and linux)
var mask = process.umask('0000')
var tasks = 0
var done = 0

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
  tapTest(title, options, function(t) {
    t.tearDown(function() {
      if (++done === tasks) {
        process.umask(mask)
      }
    })

    callback.apply(this, arguments)
  })
}

function checkMetric(names, agent, scope) {
  var res = true
  const agentMetrics = getMetrics(agent)
  var metrics = scope ? agentMetrics.scoped[scope] : agentMetrics.unscoped
  names.forEach(function cb_forEach(name) {
    res = res && metrics[NAMES.FS.PREFIX + name]
  })
  return res
}

test('rename', function(t) {
  var name = path.join(tempDir, 'rename-me')
  var newName = path.join(tempDir, 'renamed')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.rename(name, newName, function(err) {
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
      t.ok(
        checkMetric(['rename'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('truncate', function(t) {
  var name = path.join(tempDir, 'truncate-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  var expectedSegments
  helper.runInTransaction(agent, function(trans) {
    // if fs.ftruncate isn't around, it means that fs.truncate uses a file descriptor
    // rather than a path, and won't trigger an 'open' segment due to implementation
    // differences. This is mostly just a version check for v0.8.
    expectedSegments = ['open', 'truncate']
    fs.truncate(name, 4, function(err) {
      t.notOk(err, 'should not error')
      helper.unloadAgent(agent)
      t.equal(
        fs.readFileSync(name, 'utf8'),
        content.slice(0, 4),
        'content should be truncated'
      )
      verifySegments(t, agent, NAMES.FS.PREFIX + 'truncate',
        [NAMES.FS.PREFIX + 'open']
      )

      trans.end()
      t.ok(
        checkMetric(expectedSegments, agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('ftruncate', function(t) {
  var name = path.join(tempDir, 'ftruncate-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.ftruncate(fd, 4, function(err) {
      t.notOk(err, 'should not error')
      helper.unloadAgent(agent)
      t.equal(
        fs.readFileSync(name, 'utf8'),
        content.slice(0, 4),
        'content should be truncated'
      )
      verifySegments(t, agent, NAMES.FS.PREFIX + 'ftruncate')

      trans.end()
      t.ok(
        checkMetric(['ftruncate'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('chown', function(t) {
  var name = path.join(tempDir, 'chown-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  var uid = 0
  var gid = 0
  helper.runInTransaction(agent, function(trans) {
    fs.chown(name, uid, gid, function(err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'chown')

      trans.end()
      t.ok(
        checkMetric(['chown'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('fchown', function(t) {
  var name = path.join(tempDir, 'chown-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  var uid = 0
  var gid = 0
  helper.runInTransaction(agent, function(trans) {
    fs.fchown(fd, uid, gid, function(err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fchown')

      trans.end()
      t.ok(
        checkMetric(['fchown'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

// Only exists on Darwin currently, using this check to catch if it
// appears in other versions too.
test('lchown', {skip: fs.lchown === undefined}, function(t) {
  var name = path.join(tempDir, 'chown-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  var uid = 0
  var gid = 0
  helper.runInTransaction(agent, function(trans) {
    fs.lchown(name, uid, gid, function(err) {
      t.ok(err, 'should error for non root users')
      const useOpen = semver.satisfies(process.version, '<10.6')
      const extra = useOpen ? [NAMES.FS.PREFIX + 'open'] : null
      verifySegments(t, agent, NAMES.FS.PREFIX + 'lchown', extra)

      trans.end()
      const names = useOpen ? ['lchown', 'open'] : ['lchown']
      t.ok(
        checkMetric(names, agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('chmod', function(t) {
  var name = path.join(tempDir, 'chmod-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 0x1FF).toString(8), '666')
  helper.runInTransaction(agent, function(trans) {
    fs.chmod(name, '0777', function(err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 0x1FF).toString(8), '777')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'chmod')

      trans.end()
      t.ok(
        checkMetric(['chmod'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

// Only exists on Darwin currently, using this check to catch if it
// appears in other versions too.
test('lchmod', {skip: fs.lchmod === undefined}, function(t) {
  var name = path.join(tempDir, 'lchmod-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 0x1FF).toString(8), '666')
  helper.runInTransaction(agent, function(trans) {
    fs.lchmod(name, '0777', function(err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 0x1FF).toString(8), '777')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'lchmod', [NAMES.FS.PREFIX + 'open'])

      trans.end()
      t.ok(
        checkMetric(['lchmod', 'open'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('fchmod', function(t) {
  var name = path.join(tempDir, 'fchmod-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 0x1FF).toString(8), '666')
  helper.runInTransaction(agent, function(trans) {
    fs.fchmod(fd, '0777', function(err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 0x1FF).toString(8), '777')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fchmod')

      trans.end()
      t.ok(
        checkMetric(['fchmod'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('stat', function(t) {
  var name = path.join(tempDir, 'stat-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.stat(name, function(err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 0x1FF).toString(8), '666')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'stat')

      trans.end()
      t.ok(
        checkMetric(['stat'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('lstat', function(t) {
  var name = path.join(tempDir, 'lstat-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.lstat(name, function(err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 0x1FF).toString(8), '666')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'lstat')

      trans.end()
      t.ok(
        checkMetric(['lstat'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('fstat', function(t) {
  var name = path.join(tempDir, 'fstat-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.fstat(fd, function(err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 0x1FF).toString(8), '666')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fstat')

      trans.end()
      t.ok(
        checkMetric(['fstat'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('link', function(t) {
  var name = path.join(tempDir, 'link-to-me')
  var link = path.join(tempDir, 'link-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.link(name, link, function(err) {
      t.equal(err, null, 'should not error')
      t.equal(
        fs.statSync(name).ino,
        fs.statSync(link).ino,
        'should point to the same file'
      )

      verifySegments(t, agent, NAMES.FS.PREFIX + 'link')

      trans.end()
      t.ok(
        checkMetric(['link'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('symlink', function(t) {
  var name = path.join(tempDir, 'symlink-to-me')
  var link = path.join(tempDir, 'symlink-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.symlink(name, link, function(err) {
      t.equal(err, null, 'should not error')
      t.equal(
        fs.readlinkSync(link),
        name,
        'should point to the same file'
      )

      verifySegments(t, agent, NAMES.FS.PREFIX + 'symlink')

      trans.end()
      t.ok(
        checkMetric(['symlink'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('readlink', function(t) {
  var name = path.join(tempDir, 'readlink')
  var link = path.join(tempDir, 'readlink-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.readlink(link, function(err, target) {
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

test('realpath', function(t) {
  var name = path.join(tempDir, 'realpath')
  var link = path.join(tempDir, 'link-to-realpath')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  var real = fs.realpathSync(name)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.realpath(link, function(err, target) {
      t.equal(err, null, 'should not error')
      t.equal(target, real, 'should point to the same file')

      if (semver.satisfies(process.versions.node, '6.0.x - 6.3.x')) {
        verifySegments(t, agent, NAMES.FS.PREFIX + 'realpath', afterVerify)
      } else {
        verifySegments(t, agent, NAMES.FS.PREFIX + 'realpath',
          [NAMES.FS.PREFIX + 'lstat'], afterVerify)
      }

      function afterVerify() {
        trans.end()
        var expectedMetrics = ['realpath']
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

test('unlink', function(t) {
  var name = path.join(tempDir, 'unlink-from-me')
  var link = path.join(tempDir, 'unlink-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  fs.symlinkSync(name, link)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.unlink(link, function(err) {
      t.equal(err, null, 'should not error')
      t.notOk(fs.existsSync(link), 'link should not exist')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'unlink')

      trans.end()
      t.ok(
        checkMetric(['unlink'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('mkdir', function(t) {
  var name = path.join(tempDir, 'mkdir')
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.mkdir(name, function(err) {
      t.equal(err, null, 'should not error')
      t.ok(fs.existsSync(name), 'dir should exist')
      t.ok(fs.readdirSync(name), 'dir should be readable')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'mkdir')

      trans.end()
      t.ok(
        checkMetric(['mkdir'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('rmdir', function(t) {
  var name = path.join(tempDir, 'rmdir')
  var agent = setupAgent(t)
  fs.mkdirSync(name)
  helper.runInTransaction(agent, function(trans) {
    fs.rmdir(name, function(err) {
      t.equal(err, null, 'should not error')
      t.notOk(fs.existsSync(name), 'dir should not exist')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'rmdir')

      trans.end()
      t.ok(
        checkMetric(['rmdir'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('readdir', function(t) {
  var name = path.join(tempDir, 'readdir')
  var agent = setupAgent(t)
  fs.mkdirSync(name)
  helper.runInTransaction(agent, function(trans) {
    fs.readdir(name, function(err, data) {
      t.equal(err, null, 'should not error')
      t.deepEqual(data, [], 'should get list of contents')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'readdir')

      trans.end()
      t.ok(
        checkMetric(['readdir'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('close', function(t) {
  var name = path.join(tempDir, 'close-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.close(fd, function(err) {
      t.equal(err, null, 'should not error')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'close')

      trans.end()
      t.ok(
        checkMetric(['close'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('open', function(t) {
  var name = path.join(tempDir, 'open-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(trans) {
    fs.open(name, 'r+', function(err, fd) {
      t.equal(err, null, 'should not error')
      t.ok(fd, 'should get a file descriptor')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'open')

      trans.end()
      t.ok(
        checkMetric(['open'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('utimes', function(t) {
  var name = path.join(tempDir, 'utimes-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  var accessed = 5
  var modified = 15

  helper.runInTransaction(agent, function(trans) {
    fs.utimes(name, accessed, modified, function(err) {
      t.notOk(err, 'should not error')
      var stats = fs.statSync(name)
      t.equal(stats.atime.toISOString(), '1970-01-01T00:00:05.000Z')
      t.equal(stats.mtime.toISOString(), '1970-01-01T00:00:15.000Z')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'utimes')

      trans.end()
      t.ok(
        checkMetric(['utimes'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('futimes', function(t) {
  var name = path.join(tempDir, 'futimes-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  var accessed = 5
  var modified = 15

  helper.runInTransaction(agent, function(trans) {
    fs.futimes(fd, accessed, modified, function(err) {
      t.notOk(err, 'should not error')
      var stats = fs.statSync(name)
      t.equal(stats.atime.toISOString(), '1970-01-01T00:00:05.000Z')
      t.equal(stats.mtime.toISOString(), '1970-01-01T00:00:15.000Z')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'futimes')

      trans.end()
      t.ok(
        checkMetric(['futimes'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('fsync', function(t) {
  var name = path.join(tempDir, 'fsync-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)

  helper.runInTransaction(agent, function(trans) {
    fs.fsync(fd, function(err) {
      t.notOk(err, 'should not error')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fsync')

      trans.end()
      t.ok(
        checkMetric(['fsync'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('readFile', function(t) {
  var name = path.join(tempDir, 'readFile')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)

  helper.runInTransaction(agent, function(trans) {
    fs.readFile(name, function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString('utf8'), content)

      var expectFSOpen = true
      // io.js changed their implementation of fs.readFile to use process.binding.
      // This caused the file opening not to be added to the trace when using io.js.
      // By checking this value, we can determine whether or not to expect it.
      if (agent.getTransaction().trace.root.children[0].children.length === 1) {
        expectFSOpen = false
      }
      verifySegments(t, agent, NAMES.FS.PREFIX + 'readFile',
        expectFSOpen ? [NAMES.FS.PREFIX + 'open'] : []
      )

      trans.end()
      t.ok(
        checkMetric(
          expectFSOpen ? ['open', 'readFile'] : ['readFile'],
          agent, trans.name
        ),
        'metric should exist after transaction end'
      )
    })
  })
})

test('writeFile', function(t) {
  var name = path.join(tempDir, 'writeFile')
  var content = 'some-content'
  var agent = setupAgent(t)

  helper.runInTransaction(agent, function(trans) {
    fs.writeFile(name, content, function(err) {
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

test('appendFile', function(t) {
  var name = path.join(tempDir, 'appendFile')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  var expectedSegments = []

  expectedSegments = ['appendFile', 'writeFile']

  helper.runInTransaction(agent, function(trans) {
    fs.appendFile(name, '123', function(err) {
      t.notOk(err, 'should not error')
      t.equal(fs.readFileSync(name).toString('utf-8'), content + '123')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'appendFile',
        [NAMES.FS.PREFIX + 'writeFile'])

      trans.end()
      t.ok(
        checkMetric(expectedSegments, agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('exists', function(t) {
  var name = path.join(tempDir, 'exists')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)

  helper.runInTransaction(agent, function(trans) {
    fs.exists(name, function(exists) {
      t.ok(exists, 'should exist')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'exists')

      trans.end()
      t.ok(
        checkMetric(['exists'], agent, trans.name),
        'metric should exist after transaction end'
      )
    })
  })
})

test('read', function(t) {
  var name = path.join(tempDir, 'read')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  var buf = Buffer.alloc(content.length)

  helper.runInTransaction(agent, function(trans) {
    fs.read(fd, buf, 0, content.length, 0, function(err, len, data) {
      t.notOk(err, 'should not error')
      t.equal(len, 12, 'should read correct number of bytes')
      t.equal(data.toString('utf8'), content)
      t.equal(
        agent.getTransaction(),
        trans,
        'should preserve transaction')
      t.equal(
        trans.trace.root.children.length,
        0,
        'should not create any segments'
      )
      t.end()
    })
  })
})

test('write', function(t) {
  var name = path.join(tempDir, 'write')
  var content = 'some-content'
  fs.writeFileSync(name, '')
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  var buf = Buffer.from(content)

  helper.runInTransaction(agent, function(trans) {
    fs.write(fd, buf, 0, content.length, 0, function(err, len) {
      t.notOk(err, 'should not error')
      t.equal(len, 12, 'should write correct number of bytes')
      t.equal(fs.readFileSync(name, 'utf8'), content)
      t.equal(
        agent.getTransaction(),
        trans,
        'should preserve transaction')
      t.equal(
        trans.trace.root.children.length,
        0,
        'should not create any segments'
      )
      t.end()
    })
  })
})

test('watch (file)', function(t) {
  t.plan(5)

  var name = path.join(tempDir, 'watch-file')
  var content = 'some-content'
  var agent = setupAgent(t)
  fs.writeFileSync(name, content)

  setTimeout(function() {
    helper.runInTransaction(agent, function(trans) {
      var watcher = fs.watch(name, function(ev, file) {
        t.equal(ev, 'change', 'should be expected event')

        t.equal(file, 'watch-file', 'should have correct file name')
        t.equal(agent.getTransaction(), trans, 'should preserve transaction')
        t.equal(trans.trace.root.children.length, 1, 'should not create any segments')
        watcher.close()
      })
      fs.writeFile(name, content + 'more', function(err) {
        t.error(err, 'should not fail to write to file')
      })
    })
  }, 10)
})

test('watch (dir)', function(t) {
  t.plan(5)

  var name = path.join(tempDir, 'watch-dir')
  var content = 'some-content'
  var agent = setupAgent(t)

  setTimeout(function() {
    helper.runInTransaction(agent, function(trans) {
      var watcher = fs.watch(tempDir, function(ev, file) {
        t.equal(ev, 'rename')
        t.equal(file, 'watch-dir')
        t.equal(
          agent.getTransaction(),
          trans,
          'should preserve transaction')
        t.equal(
          trans.trace.root.children.length,
          1,
          'should not create any segments'
        )
        watcher.close()
      })
      fs.writeFile(name, content, function(err) {
        t.error(err, 'should not fail to write to file')
      })
    })
  }, 10)
})

test('watch emitter', function(t) {
  t.plan(5)

  var name = path.join(tempDir, 'watch')
  var content = 'some-content'
  var agent = setupAgent(t)

  setTimeout(function() {
    helper.runInTransaction(agent, function(trans) {
      var watcher = fs.watch(tempDir)

      watcher.on('change', function(ev, file) {
        t.equal(ev, 'rename', 'should have expected event')
        t.equal(file, 'watch', 'should be for correct directory')

        var tx = agent.getTransaction()
        var root = trans.trace.root
        t.equal(tx && tx.id, trans.id, 'should preserve transaction')
        t.equal(root.children.length, 1, 'should not create any segments')

        watcher.close()
      })

      fs.writeFile(name, content, function(err) {
        t.error(err, 'should not fail to write to file')
      })
    })
  }, 10)
})

test('watchFile', function(t) {
  t.plan(5)

  var name = path.join(tempDir, 'watchFile')
  var content = 'some-content'
  var agent = setupAgent(t)
  fs.writeFileSync(name, content)

  setTimeout(function() {
    helper.runInTransaction(agent, function(trans) {
      fs.watchFile(name, onChange)

      function onChange(cur, prev) {
        t.ok(cur.mtime > prev.mtime, 'modified date incremented')
        t.ok(cur.size > prev.size, 'content modified')

        t.equal(
          agent.getTransaction(),
          trans,
          'should preserve transaction')
        t.equal(
          trans.trace.root.children.length,
          0,
          'should not create any segments'
        )
        fs.unwatchFile(name, onChange)
      }
    })

    fs.writeFile(name, content + 'more', function(err) {
      t.error(err, 'should not fail to write to file')
    })
  }, 10)
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  return agent
}

function getMetrics(agent) {
  return agent.metrics._metrics
}
