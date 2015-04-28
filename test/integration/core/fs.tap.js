'use strict'

var test = require('tap').test
var path = require('path')
var temp = require('temp')
var fs = require('fs')
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify.js')

var NAMES = require('../../../lib/metrics/names')

// delete temp files before process exits
temp.track()

var tempDir = temp.mkdirSync('fs-tests')

function checkMetric(names, agent, scope) {
  var res = true
  var metrics = scope ? agent.metrics.scoped[scope] : agent.metrics.unscoped
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
  helper.runInNamedTransaction(agent, function(trans) {
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

      trans.end(function cb_metricCheck() {
        t.ok(
          checkMetric(['rename'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('truncate', function(t) {
  var name = path.join(tempDir, 'truncate-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.truncate(name, 4, function(err) {
      t.notOk(err, 'should not error')
      helper.unloadAgent(agent)
      t.equal(
        fs.readFileSync(name, 'utf8'),
        content.slice(0, 4),
        'content should be truncated'
      )
      verifySegments(t, agent, NAMES.FS.PREFIX + 'truncate', [NAMES.FS.PREFIX + 'open'])

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['open', 'truncate'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('ftruncate', function(t) {
  var name = path.join(tempDir, 'ftruncate-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.ftruncate(fd, 4, function(err) {
      t.notOk(err, 'should not error')
      helper.unloadAgent(agent)
      t.equal(
        fs.readFileSync(name, 'utf8'),
        content.slice(0, 4),
        'content should be truncated'
      )
      verifySegments(t, agent, NAMES.FS.PREFIX + 'ftruncate')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['ftruncate'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
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
  helper.runInNamedTransaction(agent, function(trans) {
    fs.chown(name, uid, gid, function(err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'chown')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['chown'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
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
  helper.runInNamedTransaction(agent, function(trans) {
    fs.fchown(fd, uid, gid, function(err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fchown')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['fchown'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('lchown', function(t) {
  var name = path.join(tempDir, 'chown-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  var uid = 0
  var gid = 0
  helper.runInNamedTransaction(agent, function(trans) {
    fs.lchown(name, uid, gid, function(err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'lchown', [NAMES.FS.PREFIX + 'open'])

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['lchown', 'open'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('chmod', function(t) {
  var name = path.join(tempDir, 'chmod-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 511).toString(8), '755')
  helper.runInNamedTransaction(agent, function(trans) {
    fs.chmod(name, '0777', function(err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 511).toString(8), '777')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'chmod')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['chmod'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('lchmod', function(t) {
  var name = path.join(tempDir, 'lchmod-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 511).toString(8), '755')
  helper.runInNamedTransaction(agent, function(trans) {
    fs.lchmod(name, '0777', function(err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 511).toString(8), '777')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'lchmod', [NAMES.FS.PREFIX + 'open'])

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['lchmod', 'open'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('fchmod', function(t) {
  var name = path.join(tempDir, 'fchmod-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 511).toString(8), '755')
  helper.runInNamedTransaction(agent, function(trans) {
    fs.fchmod(fd, '0777', function(err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 511).toString(8), '777')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fchmod')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['fchmod'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('stat', function(t) {
  var name = path.join(tempDir, 'stat-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.stat(name, function(err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 511).toString(8), '755')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'stat')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['stat'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('lstat', function(t) {
  var name = path.join(tempDir, 'lstat-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.lstat(name, function(err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 511).toString(8), '755')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'lstat')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['lstat'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('fstat', function(t) {
  var name = path.join(tempDir, 'fstat-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.fstat(fd, function(err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 511).toString(8), '755')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fstat')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['fstat'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('link', function(t) {
  var name = path.join(tempDir, 'link-to-me')
  var link = path.join(tempDir, 'link-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.link(name, link, function(err) {
      t.equal(err, null, 'should not error')
      t.equal(
        fs.statSync(name).ino,
        fs.statSync(link).ino,
        'should point to the same file'
      )

      verifySegments(t, agent, NAMES.FS.PREFIX + 'link')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['link'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('symlink', function(t) {
  var name = path.join(tempDir, 'symlink-to-me')
  var link = path.join(tempDir, 'symlink-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.symlink(name, link, function(err) {
      t.equal(err, null, 'should not error')
      t.equal(
        fs.readlinkSync(link),
        name,
        'should point to the same file'
      )

      verifySegments(t, agent, NAMES.FS.PREFIX + 'symlink')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['symlink'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('readlink', function(t) {
  var name = path.join(tempDir, 'readlink')
  var link = path.join(tempDir, 'readlink-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  fs.symlinkSync(name, link)
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.readlink(link, function(err, target) {
      t.equal(err, null, 'should not error')
      t.equal(target, name, 'should point to the same file')

      verifySegments(t, agent, NAMES.FS.PREFIX + 'readlink')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['readlink'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('realpath', function(t) {
  var name = path.join(tempDir, 'realpath')
  var link = path.join(tempDir, 'link-to-realpath')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  fs.symlinkSync(name, link)
  var real = fs.realpathSync(name)
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.realpath(link, function(err, target) {
      t.equal(err, null, 'should not error')
      t.equal(target, real, 'should point to the same file')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'realpath', [NAMES.FS.PREFIX + 'lstat'])

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['lstat', 'realpath'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('unlink', function(t) {
  var name = path.join(tempDir, 'unlink-from-me')
  var link = path.join(tempDir, 'unlink-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  fs.symlinkSync(name, link)
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.unlink(link, function(err) {
      t.equal(err, null, 'should not error')
      t.notOk(fs.existsSync(link), 'link should not exist')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'unlink')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['unlink'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('mkdir', function(t) {
  var name = path.join(tempDir, 'mkdir')
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.mkdir(name, function(err) {
      t.equal(err, null, 'should not error')
      t.ok(fs.existsSync(name), 'dir should exist')
      t.ok(fs.readdirSync(name), 'dir should be readable')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'mkdir')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['mkdir'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('rmdir', function(t) {
  var name = path.join(tempDir, 'rmdir')
  var agent = setupAgent(t)
  fs.mkdirSync(name)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.rmdir(name, function(err) {
      t.equal(err, null, 'should not error')
      t.notOk(fs.existsSync(name), 'dir should not exist')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'rmdir')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['rmdir'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('readdir', function(t) {
  var name = path.join(tempDir, 'readdir')
  var agent = setupAgent(t)
  fs.mkdirSync(name)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.readdir(name, function(err, data) {
      t.equal(err, null, 'should not error')
      t.deepEqual(data, [], 'should get list of contents')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'readdir')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['readdir'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('close', function(t) {
  var name = path.join(tempDir, 'close-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.close(fd, function(err) {
      t.equal(err, null, 'should not error')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'close')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['close'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('open', function(t) {
  var name = path.join(tempDir, 'open-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  helper.runInNamedTransaction(agent, function(trans) {
    fs.open(name, 'r+', function(err, fd) {
      t.equal(err, null, 'should not error')
      t.ok(fd, 'should get a file descriptor')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'open')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['open'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('utimes', function(t) {
  var name = path.join(tempDir, 'utimes-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  var accessed = 5
  var modified = 15

  helper.runInNamedTransaction(agent, function(trans) {
    fs.utimes(name, accessed, modified, function(err) {
      t.notOk(err, 'should not error')
      var stats = fs.statSync(name)
      t.equal(stats.atime.toISOString(), '1970-01-01T00:00:05.000Z')
      t.equal(stats.mtime.toISOString(), '1970-01-01T00:00:15.000Z')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'utimes')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['utimes'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('futimes', function(t) {
  var name = path.join(tempDir, 'futimes-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  var accessed = 5
  var modified = 15

  helper.runInNamedTransaction(agent, function(trans) {
    fs.futimes(fd, accessed, modified, function(err) {
      t.notOk(err, 'should not error')
      var stats = fs.statSync(name)
      t.equal(stats.atime.toISOString(), '1970-01-01T00:00:05.000Z')
      t.equal(stats.mtime.toISOString(), '1970-01-01T00:00:15.000Z')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'futimes')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['futimes'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('fsync', function(t) {
  var name = path.join(tempDir, 'fsync-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)

  helper.runInNamedTransaction(agent, function(trans) {
    fs.fsync(fd, function(err) {
      t.notOk(err, 'should not error')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'fsync')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['fsync'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('readFile', function(t) {
  var name = path.join(tempDir, 'readFile')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)

  helper.runInNamedTransaction(agent, function(trans) {
    fs.readFile(name, function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString('utf8'), content)
      verifySegments(t, agent, NAMES.FS.PREFIX + 'readFile', [NAMES.FS.PREFIX + 'open'])

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['open', 'readFile'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('writeFile', function(t) {
  var name = path.join(tempDir, 'writeFile')
  var content = 'some-content'
  var agent = setupAgent(t)

  helper.runInNamedTransaction(agent, function(trans) {
    fs.writeFile(name, content, function(err) {
      t.notOk(err, 'should not error')
      t.equal(fs.readFileSync(name).toString('utf8'), content)
      verifySegments(t, agent, NAMES.FS.PREFIX + 'writeFile', [NAMES.FS.PREFIX + 'open'])

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['writeFile', 'open'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('appendFile', function(t) {
  var name = path.join(tempDir, 'appendFile')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)

  helper.runInNamedTransaction(agent, function(trans) {
    fs.appendFile(name, '123', function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(fs.readFileSync(name).toString('utf-8'), content + '123')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'appendFile', [NAMES.FS.PREFIX + 'writeFile'])

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['appendFile', 'writeFile'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('exists', function(t) {
  var name = path.join(tempDir, 'exists')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)

  helper.runInNamedTransaction(agent, function(trans) {
    fs.exists(name, function(exists) {
      t.ok(exists, 'should exist')
      verifySegments(t, agent, NAMES.FS.PREFIX + 'exists')

      trans.end(function checkMetrics() {
        t.ok(
          checkMetric(['exists'], agent, trans.name),
          'metric should exist after transaction end'
        )
      })
    })
  })
})

test('read', function(t) {
  var name = path.join(tempDir, 'read')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  var buf = new Buffer(content.length)

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
  var buf = new Buffer(content)

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

test('watch', function(t) {
  var name = path.join(tempDir, 'watch')
  var content = 'some-content'
  var agent = setupAgent(t)

  setTimeout(function() {
    helper.runInTransaction(agent, function(trans) {
      var watcher = fs.watch(tempDir, function(ev, file) {
        t.equal(ev, 'rename')
        t.equal(file, 'watch')
        t.equal(
          agent.getTransaction(),
          trans,
          'should preserve transaction')
        t.equal(
          trans.trace.root.children.length,
          0,
          'should not create any segments'
        )
        watcher.close()
        t.end()
      })
      fs.writeFileSync(name, content, {mode: '0755'})
    })
  }, 10)
})

test('watch emitter', function(t) {
  var name = path.join(tempDir, 'watch')
  var content = 'some-content'
  var agent = setupAgent(t)

  setTimeout(function() {
    helper.runInTransaction(agent, function(trans) {
      var watcher = fs.watch(tempDir)

      watcher.on('change', function(ev, file) {
        t.equal(ev, 'rename')
        t.equal(file, 'watch')
        t.equal(
          agent.getTransaction(),
          trans,
          'should preserve transaction')
        t.equal(
          trans.trace.root.children.length,
          0,
          'should not create any segments'
        )
        watcher.close()
        t.end()
      })
      fs.writeFileSync(name, content, {mode: '0755'})
    })
  }, 10)
})

test('watchFile', function(t) {
  var name = path.join(tempDir, 'watchFile')
  var content = 'some-content'
  var agent = setupAgent(t)
  fs.writeFileSync(name, content, {mode: '0755'})

  setTimeout(function() {
    helper.runInTransaction(agent, function(trans) {
      fs.watchFile(name, onChange)

      function onChange(prev, cur) {
        t.notEqual(prev.atime.toISOString(), cur.atime.toISOString())
        t.notEqual(prev.mtime.toISOString(), cur.mtime.toISOString())
        t.equal(prev.ctime.toISOString(), cur.ctime.toISOString())

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
        t.end()
      }
    })
    fs.utimesSync(name, 5, 15)
  }, 10)
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  return agent
}
