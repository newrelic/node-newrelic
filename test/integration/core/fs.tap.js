'use strict'

var test = require('tap').test
var path = require('path')
var temp = require('temp')
var fs = require('fs')
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify.js')

// delete temp files before process exits
temp.track()

var tempDir = temp.mkdirSync('fs-tests')

test('rename', function(t) {
  var name = path.join(tempDir, 'rename-me')
  var newName = path.join(tempDir, 'renamed')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.rename(name, newName, function(err) {
      t.notOk(err, 'should not error')
      helper.unloadAgent(agent)
      t.ok(fs.existsSync(newName), 'file with new name should exist')
      t.notOk(fs.existsSync(name), 'file with old name should not exist')
      t.equal(
        fs.readFileSync(newName, 'utf8'),
        content,
        'file with new name shuold have expected contents'
      )
      verifySegments(t, agent, 'fs.rename')
    })
  })
})

test('truncate', function(t) {
  var name = path.join(tempDir, 'truncate-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.truncate(name, 4, function(err) {
      t.notOk(err, 'should not error')
      helper.unloadAgent(agent)
      t.equal(
        fs.readFileSync(name, 'utf8'),
        content.slice(0, 4),
        'content should be truncated'
      )
      verifySegments(t, agent, 'fs.truncate', ['fs.open'])
    })
  })
})

test('ftruncate', function(t) {
  var name = path.join(tempDir, 'ftruncate-me')
  var content = 'some-content'
  fs.writeFileSync(name, content)
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.ftruncate(fd, 4, function(err) {
      t.notOk(err, 'should not error')
      helper.unloadAgent(agent)
      t.equal(
        fs.readFileSync(name, 'utf8'),
        content.slice(0, 4),
        'content should be truncated'
      )
      verifySegments(t, agent, 'fs.ftruncate')
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
  helper.runInTransaction(agent, function() {
    fs.chown(name, uid, gid, function(err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, 'fs.chown')
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
  helper.runInTransaction(agent, function() {
    fs.fchown(fd, uid, gid, function(err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, 'fs.fchown')
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
  helper.runInTransaction(agent, function() {
    fs.lchown(name, uid, gid, function(err) {
      t.ok(err, 'should error for non root users')
      verifySegments(t, agent, 'fs.lchown', ['fs.open'])
    })
  })
})

test('chmod', function(t) {
  var name = path.join(tempDir, 'chmod-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 511).toString(8), '755')
  helper.runInTransaction(agent, function() {
    fs.chmod(name, '0777', function(err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 511).toString(8), '777')
      verifySegments(t, agent, 'fs.chmod')
    })
  })
})

test('lchmod', function(t) {
  var name = path.join(tempDir, 'lchmod-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  t.equal((fs.statSync(name).mode & 511).toString(8), '755')
  helper.runInTransaction(agent, function() {
    fs.lchmod(name, '0777', function(err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 511).toString(8), '777')
      verifySegments(t, agent, 'fs.lchmod', ['fs.open'])
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
  helper.runInTransaction(agent, function() {
    fs.fchmod(fd, '0777', function(err) {
      t.equal(err, null, 'should not error')
      helper.unloadAgent(agent)
      t.equal((fs.statSync(name).mode & 511).toString(8), '777')
      verifySegments(t, agent, 'fs.fchmod')
    })
  })
})

test('stat', function(t) {
  var name = path.join(tempDir, 'stat-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.stat(name, function(err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 511).toString(8), '755')
      verifySegments(t, agent, 'fs.stat')
    })
  })
})

test('lstat', function(t) {
  var name = path.join(tempDir, 'lstat-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.lstat(name, function(err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 511).toString(8), '755')
      verifySegments(t, agent, 'fs.lstat')
    })
  })
})

test('fstat', function(t) {
  var name = path.join(tempDir, 'fstat-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.fstat(fd, function(err, stat) {
      t.equal(err, null, 'should not error')
      t.equal((stat.mode & 511).toString(8), '755')
      verifySegments(t, agent, 'fs.fstat')
    })
  })
})

test('link', function(t) {
  var name = path.join(tempDir, 'link-to-me')
  var link = path.join(tempDir, 'link-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.link(name, link, function(err) {
      t.equal(err, null, 'should not error')
      t.equal(
        fs.statSync(name).ino,
        fs.statSync(link).ino,
        'should point to the same file'
      )

      verifySegments(t, agent, 'fs.link')
    })
  })
})

test('symlink', function(t) {
  var name = path.join(tempDir, 'symlink-to-me')
  var link = path.join(tempDir, 'symlink-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.symlink(name, link, function(err) {
      t.equal(err, null, 'should not error')
      t.equal(
        fs.readlinkSync(link),
        name,
        'should point to the same file'
      )

      verifySegments(t, agent, 'fs.symlink')
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
  helper.runInTransaction(agent, function() {
    fs.readlink(link, function(err, target) {
      t.equal(err, null, 'should not error')
      t.equal(target, name, 'should point to the same file')

      verifySegments(t, agent, 'fs.readlink')
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
  helper.runInTransaction(agent, function() {
    fs.realpath(link, function(err, target) {
      t.equal(err, null, 'should not error')
      t.equal(target, real, 'should point to the same file')
      verifySegments(t, agent, 'fs.realpath', ['fs.lstat'])
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
  helper.runInTransaction(agent, function() {
    fs.unlink(link, function(err) {
      t.equal(err, null, 'should not error')
      t.notOk(fs.existsSync(link), 'link should not exist')
      verifySegments(t, agent, 'fs.unlink')
    })
  })
})

test('mkdir', function(t) {
  var name = path.join(tempDir, 'mkdir')
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.mkdir(name, function(err) {
      t.equal(err, null, 'should not error')
      t.ok(fs.existsSync(name), 'dir should exist')
      t.ok(fs.readdirSync(name), 'dir should be readable')
      verifySegments(t, agent, 'fs.mkdir')
    })
  })
})

test('rmdir', function(t) {
  var name = path.join(tempDir, 'rmdir')
  var agent = setupAgent(t)
  fs.mkdirSync(name)
  helper.runInTransaction(agent, function() {
    fs.rmdir(name, function(err) {
      t.equal(err, null, 'should not error')
      t.notOk(fs.existsSync(name), 'dir should not exist')
      verifySegments(t, agent, 'fs.rmdir')
    })
  })
})

test('readdir', function(t) {
  var name = path.join(tempDir, 'readdir')
  var agent = setupAgent(t)
  fs.mkdirSync(name)
  helper.runInTransaction(agent, function() {
    fs.readdir(name, function(err, data) {
      t.equal(err, null, 'should not error')
      t.deepEqual(data, [], 'should get list of contents')
      verifySegments(t, agent, 'fs.readdir')
    })
  })
})

test('close', function(t) {
  var name = path.join(tempDir, 'close-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.close(fd, function(err) {
      t.equal(err, null, 'should not error')
      verifySegments(t, agent, 'fs.close')
    })
  })
})

test('open', function(t) {
  var name = path.join(tempDir, 'open-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    fs.open(name, 'r+', function(err, fd) {
      t.equal(err, null, 'should not error')
      t.ok(fd, 'should get a file descriptor')
      verifySegments(t, agent, 'fs.open')
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

  helper.runInTransaction(agent, function() {
    fs.utimes(name, accessed, modified, function(err) {
      t.notOk(err, 'should not error')
      var stats = fs.statSync(name)
      t.equal(stats.atime.toISOString(), '1970-01-01T00:00:05.000Z')
      t.equal(stats.mtime.toISOString(), '1970-01-01T00:00:15.000Z')
      verifySegments(t, agent, 'fs.utimes')
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

  helper.runInTransaction(agent, function() {
    fs.futimes(fd, accessed, modified, function(err) {
      t.notOk(err, 'should not error')
      var stats = fs.statSync(name)
      t.equal(stats.atime.toISOString(), '1970-01-01T00:00:05.000Z')
      t.equal(stats.mtime.toISOString(), '1970-01-01T00:00:15.000Z')
      verifySegments(t, agent, 'fs.futimes')
    })
  })
})

test('fsync', function(t) {
  var name = path.join(tempDir, 'fsync-me')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var fd = fs.openSync(name, 'r+')
  var agent = setupAgent(t)

  helper.runInTransaction(agent, function() {
    fs.fsync(fd, function(err) {
      t.notOk(err, 'should not error')
      verifySegments(t, agent, 'fs.fsync')
    })
  })
})

test('readFile', function(t) {
  var name = path.join(tempDir, 'readFile')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)

  helper.runInTransaction(agent, function() {
    fs.readFile(name, function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString('utf8'), content)
      verifySegments(t, agent, 'fs.readFile', ['fs.open'])
    })
  })
})

test('writeFile', function(t) {
  var name = path.join(tempDir, 'writeFile')
  var content = 'some-content'
  var agent = setupAgent(t)

  helper.runInTransaction(agent, function() {
    fs.writeFile(name, content, function(err) {
      t.notOk(err, 'should not error')
      t.equal(fs.readFileSync(name).toString('utf8'), content)
      verifySegments(t, agent, 'fs.writeFile', ['fs.open'])
    })
  })
})

test('appendFile', function(t) {
  var name = path.join(tempDir, 'appendFile')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)

  helper.runInTransaction(agent, function() {
    fs.appendFile(name, '123', function(err, data) {
      t.notOk(err, 'should not error')
      t.equal(fs.readFileSync(name).toString('utf-8'), content + '123')
      verifySegments(t, agent, 'fs.appendFile', ['fs.writeFile'])
    })
  })
})

test('exists', function(t) {
  var name = path.join(tempDir, 'exists')
  var content = 'some-content'
  fs.writeFileSync(name, content, {mode: '0755'})
  var agent = setupAgent(t)

  helper.runInTransaction(agent, function() {
    fs.exists(name, function(exists) {
      t.ok(exists, 'should exist')
      verifySegments(t, agent, 'fs.exists')
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
