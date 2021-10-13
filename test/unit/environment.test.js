/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

// For consistent results, unset this in case the user had it set in their
// environment when testing.
delete process.env.NODE_ENV

const a = require('async')
const path = require('path')
const fs = require('fs')
const spawn = require('child_process').spawn
const chai = require('chai')
const expect = chai.expect
const should = chai.should()
const environment = require('../../lib/environment')
const rimraf = require('rimraf')

function find(settings, name) {
  const items = settings.filter(function (candidate) {
    return candidate[0] === name
  })

  return items[0] && items[0][1]
}

describe('the environment scraper', function () {
  let settings = null

  before(reloadEnvironment)

  it('should allow clearing of the dispatcher', function () {
    environment.setDispatcher('custom')

    const dispatchers = environment.get('Dispatcher')
    expect(dispatchers).include.members(['custom'])

    expect(function () {
      environment.clearDispatcher()
    }).not.throws()
  })

  it('should allow setting dispatcher version', function () {
    environment.setDispatcher('custom', '2')

    let dispatchers = environment.get('Dispatcher')
    expect(dispatchers).include.members(['custom'])

    dispatchers = environment.get('Dispatcher Version')
    expect(dispatchers).include.members(['2'])

    expect(function () {
      environment.clearDispatcher()
    }).not.throws()
  })

  it('should collect only a single dispatcher', function () {
    environment.setDispatcher('first')
    let dispatchers = environment.get('Dispatcher')
    expect(dispatchers).include.members(['first'])

    environment.setDispatcher('custom')
    dispatchers = environment.get('Dispatcher')
    expect(dispatchers).include.members(['custom'])

    expect(function () {
      environment.clearDispatcher()
    }).not.throws()
  })

  it('should allow clearing of the framework', function () {
    environment.setFramework('custom')
    environment.setFramework('another')

    const frameworks = environment.get('Framework')
    expect(frameworks).include.members(['custom', 'another'])

    expect(function () {
      environment.clearFramework()
    }).not.throws()
  })

  it('should persist dispatcher between getJSON()s', function (done) {
    environment.setDispatcher('test')
    expect(environment.get('Dispatcher')).to.include.members(['test'])

    environment.refresh(function (err) {
      expect(environment.get('Dispatcher')).to.include.members(['test'])
      done(err)
    })
  })

  it('should have some settings', function () {
    expect(settings.length).to.be.above(1)
  })

  it('should find at least one CPU', function () {
    expect(find(settings, 'Processors')).to.be.above(0)
  })

  it('should have found an operating system', function () {
    should.exist(find(settings, 'OS'))
  })

  it('should have found an operating system version', function () {
    should.exist(find(settings, 'OS version'))
  })

  it('should have found the system architecture', function () {
    should.exist(find(settings, 'Architecture'))
  })

  it('should know the Node.js version', function () {
    should.exist(find(settings, 'Node.js version'))
  })

  // expected to be run when NODE_ENV is unset
  it('should not find a value for NODE_ENV', function () {
    expect(environment.get('NODE_ENV')).to.be.empty
  })

  describe('with process.config', function () {
    it('should know whether npm was installed with Node.js', function () {
      expect(find(settings, 'npm installed?')).to.exist
    })

    it('should know whether OpenSSL support was compiled into Node.js', function () {
      should.exist(find(settings, 'OpenSSL support?'))
    })

    it('should know whether OpenSSL was dynamically linked in', function () {
      should.exist(find(settings, 'Dynamically linked to OpenSSL?'))
    })

    it('should know whether Zlib was dynamically linked in', function () {
      should.exist(find(settings, 'Dynamically linked to Zlib?'))
    })

    it('should know whether DTrace support was configured', function () {
      should.exist(find(settings, 'DTrace support?'))
    })

    it('should know whether Event Tracing for Windows was configured', function () {
      should.exist(find(settings, 'Event Tracing for Windows (ETW) support?'))
    })
  })

  describe('without process.config', function () {
    let conf = null

    before(function (done) {
      conf = process.config

      /**
       * TODO: Augmenting process.config has been deprecated in Node 16.
       * When fully disabled we may no-longer be able to test but also may no-longer need to.
       * https://nodejs.org/api/deprecations.html#DEP0150
       */
      process.config = null
      reloadEnvironment(done)
    })

    after(function (done) {
      process.config = conf
      reloadEnvironment(done)
    })

    it('should not know whether npm was installed with Node.js', function () {
      expect(find(settings, 'npm installed?')).to.not.exist
    })

    it('should not know whether WAF was installed with Node.js', function () {
      expect(find(settings, 'WAF build system installed?')).to.not.exist
    })

    it('should not know whether OpenSSL support was compiled into Node.js', function () {
      expect(find(settings, 'OpenSSL support?')).to.not.exist
    })

    it('should not know whether OpenSSL was dynamically linked in', function () {
      expect(find(settings, 'Dynamically linked to OpenSSL?')).to.not.exist
    })

    it('should not know whether V8 was dynamically linked in', function () {
      expect(find(settings, 'Dynamically linked to V8?')).to.not.exist
    })

    it('should not know whether Zlib was dynamically linked in', function () {
      expect(find(settings, 'Dynamically linked to Zlib?')).to.not.exist
    })

    it('should not know whether DTrace support was configured', function () {
      expect(find(settings, 'DTrace support?')).to.not.exist
    })

    it('should not know whether Event Tracing for Windows was configured', function () {
      expect(find(settings, 'Event Tracing for Windows (ETW) support?')).to.not.exist
    })
  })

  it('should have built a flattened package list', function () {
    const packages = find(settings, 'Packages')
    expect(packages.length).above(5)
    packages.forEach((pair) => {
      expect(JSON.parse(pair).length).equal(2)
    })
  })

  it('should have built a flattened dependency list', function () {
    const dependencies = find(settings, 'Dependencies')
    expect(dependencies.length).above(5)
    dependencies.forEach((pair) => {
      expect(JSON.parse(pair).length).equal(2)
    })
  })

  it('should get correct version for dependencies', function (done) {
    const root = path.join(__dirname, '../lib/example-packages')
    environment.listPackages(root, function (err, packages) {
      const versions = packages.reduce(function (map, pkg) {
        map[pkg[0]] = pkg[1]
        return map
      }, {})

      expect(versions).deep.equal({
        'invalid-json': '<unknown>',
        'valid-json': '1.2.3'
      })

      done()
    })
  })

  it('should not crash when given a file in NODE_PATH', function (done) {
    const env = {
      NODE_PATH: path.join(__dirname, 'environment.test.js'),
      PATH: process.env.PATH
    }

    const opt = {
      env: env,
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    }

    const exec = process.argv[0]
    const args = [path.join(__dirname, '../helpers/environment.child.js')]
    const proc = spawn(exec, args, opt)

    proc.on('exit', function (code) {
      expect(code).equal(0)

      done()
    })
  })

  describe('with symlinks', function () {
    const nmod = path.resolve(__dirname, '../helpers/node_modules')

    beforeEach(function (done) {
      if (!fs.existsSync(nmod)) {
        fs.mkdirSync(nmod)
      }

      // node_modules/
      //  a/
      //    package.json
      //    node_modules/
      //      b (symlink)
      //  b/
      //    package.json
      //    node_modules/
      //      a (symlink)
      a.parallel([a.apply(makePackage, 'a', 'b'), a.apply(makePackage, 'b', 'a')], done)
    })

    afterEach(function (done) {
      const aDir = path.join(nmod, 'a')
      const bDir = path.join(nmod, 'b')
      a.each([aDir, bDir], rimraf, done)
    })

    function makePackage(pkg, dep, cb) {
      const dir = path.join(nmod, pkg)
      a.series(
        [
          // Make the directory tree.
          a.apply(makeDir, dir),
          a.apply(makeDir, path.join(dir, 'node_modules')),

          // Make the package.json
          function (pkgCb) {
            const pkgJSON = { name: pkg, dependencies: {} }
            pkgJSON.dependencies[dep] = '*'
            fs.writeFile(path.join(dir, 'package.json'), JSON.stringify(pkgJSON), pkgCb)
          },

          // Make the dep a symlink.
          function (symCb) {
            const depModule = path.join(dir, 'node_modules', dep)
            fs.symlink(path.join(nmod, dep), depModule, 'dir', function (err) {
              symCb(err && err.code !== 'EEXIST' ? err : null)
            })
          }
        ],
        cb
      )

      function makeDir(dirp, mkdirDb) {
        fs.mkdir(dirp, function (err) {
          mkdirDb(err && err.code !== 'EEXIST' ? err : null)
        })
      }
    }

    it('should not crash when encountering a cyclical symlink', function (done) {
      execChild(done)
    })

    it('should not crash when encountering a dangling symlink', function (done) {
      rimraf.sync(path.join(nmod, 'a'))
      execChild(done)
    })

    function execChild(cb) {
      const opt = {
        stdio: 'pipe',
        env: process.env,
        cwd: path.join(__dirname, '../helpers')
      }

      const exec = process.argv[0]
      const args = [path.join(__dirname, '../helpers/environment.child.js')]
      const proc = spawn(exec, args, opt)

      proc.stdout.pipe(process.stderr)
      proc.stderr.pipe(process.stderr)

      proc.on('exit', function (code) {
        expect(code).to.equal(0)
        cb()
      })
    }
  })

  describe('when NODE_ENV is "production"', function () {
    let nSettings = null

    before(function (done) {
      process.env.NODE_ENV = 'production'
      environment.getJSON(function (err, data) {
        nSettings = data
        done(err)
      })
    })

    after(function () {
      delete process.env.NODE_ENV
    })

    it('should save the NODE_ENV value in the environment settings', function () {
      find(nSettings, 'NODE_ENV').should.equal('production')
    })
  })

  function reloadEnvironment(cb) {
    environment.getJSON(function (err, data) {
      settings = data
      cb(err)
    })
  }
})
