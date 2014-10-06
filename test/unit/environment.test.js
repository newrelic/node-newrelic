'use strict'

var path        = require('path')
  , fs          = require('fs')
  , spawn       = require('child_process').spawn
  , chai        = require('chai')
  , expect      = chai.expect
  , should      = chai.should()
  , environment = require('../../lib/environment')
  

function find(settings, name) {
  var items = settings.filter(function cb_filter(candidate) {
    return candidate[0] === name
  })

  expect(items.length).equal(1)

  return items[0][1]
}

describe("the environment scraper", function () {
  var settings

  before(function () {
    settings = environment.toJSON()
  })

  it("should allow clearing of the dispatcher", function () {
    environment.setDispatcher('custom')
    environment.setDispatcher('another')

    var dispatchers = environment.get('Dispatcher')
    expect(dispatchers).include.members(['custom', 'another'])

    expect(function () { environment.clearDispatcher(); }).not.throws()
  })

  it("should allow clearing of the framework", function () {
    environment.setFramework('custom')
    environment.setFramework('another')

    var frameworks = environment.get('Framework')
    expect(frameworks).include.members(['custom', 'another'])

    expect(function () { environment.clearFramework(); }).not.throws()
  })

  it("should persist dispatcher between toJSON()s", function () {
    environment.setDispatcher('test')
    expect(environment.get('Dispatcher')).include.members(['test'])

    environment.refresh()
    expect(environment.get('Dispatcher')).include.members(['test'])

  })

  it("should have some settings", function () {
    expect(settings.length).above(1)
  })

  it("should find at least one CPU", function () {
    expect(find(settings, 'Processors')).above(0)
  })

  it("should have found an operating system", function () {
    should.exist(find(settings, 'OS'))
  })

  it("should have found an operating system version", function () {
    should.exist(find(settings, 'OS version'))
  })

  it("should have found the system architecture", function () {
    should.exist(find(settings, 'Architecture'))
  })

  it("should know the Node.js version", function () {
    should.exist(find(settings, 'Node.js version'))
  })
  //expected to be run when NODE_ENV is unset
  it("should not find a value for NODE_ENV", function () {
    expect(environment.get('NODE_ENV')).to.be.empty
  })

  if (process.config) {
    describe("for versions of Node with process.config", function () {
      it("should know whether npm was installed with Node.js", function () {
        should.exist(find(settings, 'npm installed?'))
      })

      it("should know whether WAF was installed with Node.js", function () {
        // 0.10 drops node-waf support
        // FIXME: break this out into a Node-version-specific test
        var waf = process.config.variables.node_install_waf
        if (waf === true || waf === false) {
          should.exist(find(settings, 'WAF build system installed?'))
        }
      })

      it("should know whether OpenSSL support was compiled into Node.js", function () {
        should.exist(find(settings, 'OpenSSL support?'))
      })

      it("should know whether OpenSSL was dynamically linked in", function () {
        should.exist(find(settings, 'Dynamically linked to OpenSSL?'))
      })

      it("should know whether V8 was dynamically linked in", function () {
        should.exist(find(settings, 'Dynamically linked to V8?'))
      })

      it("should know whether Zlib was dynamically linked in", function () {
        should.exist(find(settings, 'Dynamically linked to Zlib?'))
      })

      it("should know whether DTrace support was configured", function () {
        should.exist(find(settings, 'DTrace support?'))
      })

      it("should know whether Event Tracing for Windows was configured", function () {
        should.exist(find(settings, 'Event Tracing for Windows (ETW) support?'))
      })
    })
  }

  it("should have built a flattened package list", function () {
    var packages = find(settings, 'Packages')
    expect(packages.length).above(5)
    packages.forEach(function cb_forEach(pair) {
      expect(JSON.parse(pair).length).equal(2)
    })
  })

  it("should have built a flattened dependency list", function () {
    var dependencies = find(settings, 'Dependencies')
    expect(dependencies.length).above(5)
    dependencies.forEach(function cb_forEach(pair) {
      expect(JSON.parse(pair).length).equal(2)
    })
  })

   it("should get correct version for dependencies", function () {
    var root = path.join(__dirname, '../lib/example-packages')
    var versions = environment.listPackages(root).reduce(function(map, pkg) {
      map[pkg[0]] = pkg[1]
      return map
    }, {})

    expect(versions).deep.equal({
      'invalid-json': '<unknown>',
      'valid-json': '1.2.3'
    })
  })

  it("should not crash when given a file in NODE_PATH", function (done) {
    var env = {
      NODE_PATH : path.join(__dirname, "environment.test.js"),
      PATH      : process.env.PATH
    }

    var opt = {
      env   : env,
      stdio : 'inherit',
      cwd   : path.join(__dirname, '..')
    }

    var exec = process.argv[0]
      , args = [path.join(__dirname, '../helpers/environment.child.js')]
      , proc = spawn(exec, args, opt)
      

    proc.on('exit', function (code) {
      expect(code).equal(0)

      done()
    })
  })

  it("should not crash when encountering a dangling symlink", function (done) {
    var opt = {
      stdio : 'pipe',
      env   : process.env,
      cwd   : path.join(__dirname, '../helpers'),
    }

    var nmod = path.join(__dirname, '../helpers/node_modules')
    var into = path.join(nmod, 'a')
    var dest = path.join(nmod, 'b')

    // cleanup in case dest is dirty
    try {fs.unlinkSync(dest);} catch(e) {}
    if (!fs.existsSync(nmod)) fs.mkdirSync(nmod)

    fs.writeFileSync(into, 'hello world')
    fs.symlinkSync(into, dest)
    fs.unlinkSync(into)

    var exec = process.argv[0]
      , args = [path.join(__dirname, '../helpers/environment.child.js')]
      , proc = spawn(exec, args, opt)
      

    proc.stdout.pipe(process.stderr)
    proc.stderr.pipe(process.stderr)

    proc.on('exit', function (code) {
      expect(code).equal(0)
      fs.unlinkSync(dest)
      done()
    })
  })

  describe("when NODE_ENV is 'production'", function () {
    var nSettings

    before(function () {
      process.env.NODE_ENV = 'production'
      nSettings = environment.toJSON()
    })

    after(function () {
      delete process.env.NODE_ENV
    })

    it("should save the NODE_ENV value in the environment settings", function () {
      (find(nSettings, 'NODE_ENV')).should.equal('production')
    })

  })

})
