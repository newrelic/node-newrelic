/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

// For consistent results, unset this in case the user had it set in their
// environment when testing.
delete process.env.NODE_ENV

const path = require('path')
const fs = require('fs/promises')
const spawn = require('child_process').spawn
const environment = require('../../lib/environment')

function find(settings, name) {
  const items = settings.filter(function (candidate) {
    return candidate[0] === name
  })

  return items[0] && items[0][1]
}

tap.test('the environment scraper', (t) => {
  t.autoend()
  let settings = null

  t.before(reloadEnvironment)

  t.test('should allow clearing of the dispatcher', (t) => {
    environment.setDispatcher('custom')

    const dispatchers = environment.get('Dispatcher')
    t.has(dispatchers, ['custom'], '')

    t.doesNotThrow(function () {
      environment.clearDispatcher()
    })
    t.end()
  })

  t.test('should allow setting dispatcher version', (t) => {
    environment.setDispatcher('custom', '2')

    let dispatchers = environment.get('Dispatcher')
    t.has(dispatchers, ['custom'], '')

    dispatchers = environment.get('Dispatcher Version')
    t.has(dispatchers, ['2'], '')

    t.doesNotThrow(function () {
      environment.clearDispatcher()
    })
    t.end()
  })

  t.test('should collect only a single dispatcher', (t) => {
    environment.setDispatcher('first')
    let dispatchers = environment.get('Dispatcher')
    t.has(dispatchers, ['first'], '')

    environment.setDispatcher('custom')
    dispatchers = environment.get('Dispatcher')
    t.has(dispatchers, ['custom'], '')

    t.doesNotThrow(function () {
      environment.clearDispatcher()
    })
    t.end()
  })

  t.test('should allow clearing of the framework', (t) => {
    environment.setFramework('custom')
    environment.setFramework('another')

    const frameworks = environment.get('Framework')
    t.has(frameworks, ['custom', 'another'], '')

    t.doesNotThrow(function () {
      environment.clearFramework()
    })
    t.end()
  })

  t.test('should persist dispatcher between getJSON()s', async (t) => {
    environment.setDispatcher('test')
    t.has(environment.get('Dispatcher'), ['test'])

    await environment.refresh()
    t.has(environment.get('Dispatcher'), ['test'])
    t.end()
  })

  t.test('access to settings', (t) => {
    t.ok(settings.length > 1, 'should have some settings')
    t.ok(find(settings, 'Processors') > 0, 'should find at least one CPU')
    t.ok(find(settings, 'OS'), 'should have found an operating system')
    t.ok(find(settings, 'OS version'), 'should have found an operating system version')
    t.ok(find(settings, 'Architecture'), 'should have found the system architecture')
    t.end()
  })

  t.test('Node version', (t) => {
    t.ok(find(settings, 'Node.js version'), 'should know the Node.js version')
    t.end()
  })

  t.test('Node environment', (t) => {
    // expected to be run when NODE_ENV is unset
    t.ok(environment.get('NODE_ENV').length === 0, 'should not find a value for NODE_ENV')
    t.end()
  })

  t.test('with process.config', (t) => {
    t.ok(find(settings, 'npm installed?'), 'should know whether npm was installed with Node.js')
    t.ok(
      find(settings, 'OpenSSL support?'),
      'should know whether OpenSSL support was compiled into Node.js'
    )
    t.ok(
      find(settings, 'Dynamically linked to OpenSSL?'),
      'should know whether OpenSSL was dynamically linked in'
    )
    t.ok(
      find(settings, 'Dynamically linked to Zlib?'),
      'should know whether Zlib was dynamically linked in'
    )
    t.ok(find(settings, 'DTrace support?'), 'should know whether DTrace support was configured')
    t.ok(
      find(settings, 'Event Tracing for Windows (ETW) support?'),
      'should know whether Event Tracing for Windows was configured'
    )
    t.end()
  })

  // TODO: expected, waiting for https://github.com/newrelic/node-newrelic/pull/1705
  // to merge down before applying to appropriate skip
  /*t.test('without process.config', (t) => {
>>>>>>> 573d9fb80 (chore: updated unit tests to get them working with node 20)
    let conf = null

    t.before(() => {
      conf = { ...process.config }

      /**
       * TODO: Augmenting process.config has been deprecated in Node 16.
       * When fully disabled we may no-longer be able to test but also may no-longer need to.
       * https://nodejs.org/api/deprecations.html#DEP0150
      process.config = null
      return reloadEnvironment()
    })

    t.teardown(() => {
      process.config = { ...conf }
      return reloadEnvironment()
    })

    t.test('assertions without process.config', (t) => {
      t.notOk(
        find(settings, 'npm installed?'),
        'should not know whether npm was installed with Node.js'
      )
      t.notOk(
        find(settings, 'WAF build system installed?'),
        'should not know whether WAF was installed with Node.js'
      )
      t.notOk(
        find(settings, 'OpenSSL support?'),
        'should not know whether OpenSSL support was compiled into Node.js'
      )
      t.notOk(find(settings, 'Dynamically linked to OpenSSL?'), 'Dynamically linked to OpenSSL?')
      t.notOk(find(settings, 'Dynamically linked to V8?'), 'Dynamically linked to V8?')
      t.notOk(find(settings, 'Dynamically linked to Zlib?'), 'Dynamically linked to Zlib?')
      t.notOk(find(settings, 'DTrace support?'), 'DTrace support?')
      t.notOk(
        find(settings, 'Event Tracing for Windows (ETW) support?'),
        'Event Tracing for Windows (ETW) support?'
      )
      t.end()
    })
    t.end()
  })
  */

  t.test('should have built a flattened package list', (t) => {
    const packages = find(settings, 'Packages')
    t.ok(packages.length > 5)
    packages.forEach((pair) => {
      t.equal(JSON.parse(pair).length, 2)
    })
    t.end()
  })

  t.test('should have built a flattened dependency list', (t) => {
    const dependencies = find(settings, 'Dependencies')
    t.ok(dependencies.length > 5)
    dependencies.forEach((pair) => {
      t.equal(JSON.parse(pair).length, 2)
    })
    t.end()
  })

  t.test('should get correct version for dependencies', async (t) => {
    const root = path.join(__dirname, '../lib/example-packages')
    const packages = []
    await environment.listPackages(root, packages)
    const versions = packages.reduce(function (map, pkg) {
      map[pkg[0]] = pkg[1]
      return map
    }, {})

    t.same(versions, {
      'invalid-json': '<unknown>',
      'valid-json': '1.2.3'
    })
    t.end()
  })

  // TODO: this will no longer work in Node 20
  /* it('should resolve refresh where deps and deps of deps are symlinked to each other', async function () {
  t.test(
    'should resolve refresh where deps and deps of deps are symlinked to each other',
    async (t) => {
      process.config.variables.node_prefix = path.join(__dirname, '../lib/example-deps')
      const data = await environment.getJSON()
      const pkgs = find(data, 'Dependencies')
      const customPkgs = pkgs.filter((pkg) => pkg.includes('custom-pkg'))
      t.equal(customPkgs.length, 3)
      t.end()
    }
  )
  */

  t.test('should not crash when given a file in NODE_PATH', (t) => {
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
      t.equal(code, 0)
      t.end()
    })
  })

  t.test('with symlinks', (t) => {
    t.autoend()
    const nmod = path.resolve(__dirname, '../helpers/node_modules')
    const makeDir = (dirp) => {
      try {
        return fs.mkdir(dirp)
      } catch (err) {
        if (err.code !== 'EEXIST') {
          return err
        }
        return null
      }
    }
    const makePackage = async (pkg, dep) => {
      const dir = path.join(nmod, pkg)

      // Make the directory tree.
      await makeDir(dir) // make the directory
      await makeDir(path.join(dir, 'node_modules')) // make the modules subdirectory

      // Make the package.json
      const pkgJSON = { name: pkg, dependencies: {} }
      pkgJSON.dependencies[dep] = '*'
      await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify(pkgJSON))

      // Make the dep a symlink.
      const depModule = path.join(dir, 'node_modules', dep)
      return fs.symlink(path.join(nmod, dep), depModule, 'dir')
    }

    t.beforeEach(async () => {
      await fs.access(nmod).catch(async () => {
        await fs.mkdir(nmod)
      })

      // node_modules/
      //  a/
      //    package.json
      //    node_modules/
      //      b (symlink)
      //  b/
      //    package.json
      //    node_modules/
      //      a (symlink)
      await makePackage('a', 'b')
      await makePackage('b', 'a')
    })

    t.afterEach(async () => {
      const aDir = path.join(nmod, 'a')
      const bDir = path.join(nmod, 'b')
      await fs.rm(aDir, { recursive: true, force: true })
      await fs.rm(bDir, { recursive: true, force: true })
    })

    t.test('should not crash when encountering a cyclical symlink', (t) => {
      execChild((code) => {
        t.equal(code, 0)
        t.end()
      })
    })

    t.test('should not crash when encountering a dangling symlink', async (t) => {
      await fs.rm(path.join(nmod, 'a'), { recursive: true, force: true })
      return new Promise((resolve) => {
        execChild((code) => {
          t.equal(code, 0)
          resolve()
        })
      })
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

      proc.on('exit', (code) => {
        cb(code)
      })
    }
  })

  t.test('when NODE_ENV is "production"', async (t) => {
    process.env.NODE_ENV = 'production'

    t.teardown(() => {
      delete process.env.NODE_ENV
    })

    const nSettings = await environment.getJSON()

    t.equal(
      find(nSettings, 'NODE_ENV'),
      'production',
      `should save the NODE_ENV value in the environment settings`
    )
    t.end()
  })

  async function reloadEnvironment() {
    settings = await environment.getJSON()
  }
})
