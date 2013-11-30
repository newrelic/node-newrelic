'use strict';

var path        = require('path')
  , spawn       = require('child_process').spawn
  , chai        = require('chai')
  , expect      = chai.expect
  , should      = chai.should()
  , environment = require(path.join(__dirname, '..', 'lib', 'environment'))
  ;

function find(settings, name) {
  var items = settings.filter(function (candidate) {
    return candidate[0] === name;
  });

  expect(items.length).equal(1);

  return items[0][1];
}

describe("the environment scraper", function () {
  var settings;

  before(function () {
    settings = environment.toJSON();
  });

  it("should allow clearing of the dispatcher", function () {
    environment.setDispatcher('custom');
    environment.setDispatcher('another');

    var dispatchers = environment.get('Dispatcher');
    expect(dispatchers).include.members(['custom', 'another']);

    expect(function () { environment.clearDispatcher(); }).not.throws();
  });

  it("should allow clearing of the ramework", function () {
    environment.setFramework('custom');
    environment.setFramework('another');

    var frameworks = environment.get('Framework');
    expect(frameworks).include.members(['custom', 'another']);

    expect(function () { environment.clearFramework(); }).not.throws();
  });

  it("should have some settings", function () {
    expect(settings.length).above(1);
  });

  it("should find at least one CPU", function () {
    expect(find(settings, 'Processors')).above(0);
  });

  it("should have found an operating system", function () {
    should.exist(find(settings, 'OS'));
  });

  it("should have found an operating system version", function () {
    should.exist(find(settings, 'OS version'));
  });

  it("should have found the system architecture", function () {
    should.exist(find(settings, 'Architecture'));
  });

  it("should know the Node.js version", function () {
    should.exist(find(settings, 'Node.js version'));
  });

  if (process.config) {
    describe("for versions of Node with process.config", function () {
      it("should know whether npm was installed with Node.js", function () {
        should.exist(find(settings, 'npm installed?'));
      });

      it("should know whether WAF was installed with Node.js", function () {
        // 0.10 drops node-waf support
        // FIXME: break this out into a Node-version-specific test
        var waf = process.config.variables.node_install_waf;
        if (waf === true || waf === false) {
          should.exist(find(settings, 'WAF build system installed?'));
        }
      });

      it("should know whether OpenSSL support was compiled into Node.js", function () {
        should.exist(find(settings, 'OpenSSL support?'));
      });

      it("should know whether OpenSSL was dynamically linked in", function () {
        should.exist(find(settings, 'Dynamically linked to OpenSSL?'));
      });

      it("should know whether V8 was dynamically linked in", function () {
        should.exist(find(settings, 'Dynamically linked to V8?'));
      });

      it("should know whether Zlib was dynamically linked in", function () {
        should.exist(find(settings, 'Dynamically linked to Zlib?'));
      });

      it("should know whether DTrace support was configured", function () {
        should.exist(find(settings, 'DTrace support?'));
      });

      it("should know whether Event Tracing for Windows was configured", function () {
        should.exist(find(settings, 'Event Tracing for Windows (ETW) support?'));
      });
    });
  }

  it("should have built a flattened package list", function () {
    var packages = find(settings, 'Packages');
    expect(packages.length).above(5);
    packages.forEach(function (pair) {
      expect(JSON.parse(pair).length).equal(2);
    });
  });

  it("should have built a flattened dependency list", function () {
    var dependencies = find(settings, 'Dependencies');
    expect(dependencies.length).above(5);
    dependencies.forEach(function (pair) {
      expect(JSON.parse(pair).length).equal(2);
    });
  });

  it("should not crash when given a file in NODE_PATH", function (done) {
    var env = {
      NODE_PATH : path.join(__dirname, "environment.test.js"),
      PATH      : process.env.PATH
    };

    var opt = {
      env   : env,
      stdio : 'inherit',
      cwd   : path.join(__dirname, '..')
    };

    var exec = process.argv[0]
      , args = [path.join(__dirname, 'helpers', 'environment.child.js')]
      , proc = spawn(exec, args, opt)
      ;

    proc.on('exit', function (code) {
      expect(code).equal(0);

      done();
    });
  });
});
