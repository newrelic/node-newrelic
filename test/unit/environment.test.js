/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test

// For consistent results, unset this in case the user had it set in their
// environment when testing.
delete process.env.NODE_ENV

const path = require('path')
const fs = require('fs/promises')
const spawn = require('child_process').spawn
const environment = require('../../lib/environment')

const find = (settings, name) => {
  const items = settings.filter((candidate) => candidate[0] === name)

  return items[0] && items[0][1]
}

test('the environment scraper', async (t) => {
  let settings = null

  const reloadEnvironment = async () => {
    settings = await new Promise((resolve, reject) =>
      environment.getJSON((err, data) => {
        if (err) {
          reject(err)
        }
        return resolve(data)
      })
    )
  }

  t.before(reloadEnvironment)

  t.test('should allow clearing of the dispatcher', async (t) => {
    environment.setDispatcher('custom')

    const dispatchers = environment.get('Dispatcher')
    t.ok(dispatchers.indexOf('custom') > -1, `Dispatchers should have 'custom' member`)

    t.doesNotThrow(() => {
      console.log('clearing dispatcher')
      environment.clearDispatcher()
      return true
    }, 'Environment should be able to clear dispatcher.')
    t.end()
  })

  t.test('should allow setting dispatcher version', (t) => {
    environment.setDispatcher('custom', '2')

    let dispatchers = environment.get('Dispatcher')
    // t.has(dispatchers, { dispatcher: 'custom' }, `Dispatchers should have 'custom' member`)
    t.ok(dispatchers.indexOf('custom') > -1, `Dispatchers should have 'custom' member`)

    dispatchers = environment.get('Dispatcher Version')
    t.ok(dispatchers.indexOf('2') > -1, `Dispatchers should have member of version '2'`)

    t.doesNotThrow(
      () => environment.clearDispatcher(),
      'Environment should be able to clear dispatcher.'
    )
    t.end()
  })

  t.test('should collect only a single dispatcher', (t) => {
    environment.setDispatcher('first')
    let dispatchers = environment.get('Dispatcher')
    t.ok(dispatchers.indexOf('first') > -1, `Dispatchers should have 'first' member`)

    // t.has(dispatchers, { dispatcher: 'first' }, `Dispatchers should have 'first' member`)

    environment.setDispatcher('custom')
    dispatchers = environment.get('Dispatcher')
    // t.has(dispatchers, { dispatcher: 'custom' }, `Dispatchers should have 'custom' member`)
    t.ok(dispatchers.indexOf('custom') > -1, `Dispatchers should have 'custom' member`)

    t.doesNotThrow(
      () => environment.clearDispatcher(),
      'Environment should be able to clear dispatcher.'
    )
    t.end()
  })

  t.test('should allow clearing of the framework', (t) => {
    environment.setFramework('custom')
    environment.setFramework('another')

    const frameworks = environment.get('Framework')
    t.ok(frameworks.indexOf('custom') > -1, `Frameworks should have 'custom' member`)
    t.ok(frameworks.indexOf('another') > -1, `Frameworks should have 'another' member`)

    t.doesNotThrow(
      () => environment.clearFramework(),
      'Environment should be able to clear frameworks.'
    )
    t.end()
  })

  t.test('should persist dispatcher between getJSON()s', async (t) => {
    environment.setDispatcher('test')

    t.ok(
      environment.get('Dispatcher').indexOf('test') > -1,
      `Dispatchers should have 'test' member`
    )

    await new Promise((resolve, reject) => {
      environment.refresh(async (err) => {
        t.notOk(err, 'Environment refresh should not error')
        if (err) {
          reject(err)
        }
        return resolve()
      })
    })
    t.ok(
      environment.get('Dispatcher').indexOf('test') > -1,
      `Dispatchers should have 'test' member even after refresh`
    )
    t.end()
  })

  t.test('Settings tests', (t) => {
    t.ok(settings.length > 1, 'should have some settings')
    t.ok(find(settings, 'Processors') > 0, 'should find at least one CPU')
    t.ok(find(settings, 'OS'), 'should have found an operating system')
    t.ok(find(settings, 'OS version'), 'should have found an operating system version')
    t.ok(find(settings, 'Architecture'), 'should have found the system architecture')
    t.ok(find(settings, 'Node.js version'), 'should know the Node.js version')

    // expected to be run when NODE_ENV is unset
    t.equal(environment.get('NODE_ENV').length, 0, 'should not find a value for NODE_ENV')
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

  t.test('without process.config', async (t) => {
    let conf = null

    t.before(async () => {
      conf = process.config

      /**
       * TODO: Augmenting process.config has been deprecated in Node 16.
       * When fully disabled we may no-longer be able to test but also may no-longer need to.
       * https://nodejs.org/api/deprecations.html#DEP0150
       */
      process.config = null
      await reloadEnvironment()
    })

    t.on('end', async () => {
      process.config = conf
      await reloadEnvironment()
    })

    t.test('environment without config', (t) => {
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
      t.notOk(
        find(settings, 'Dynamically linked to OpenSSL?'),
        'should not know whether OpenSSL was dynamically linked in'
      )
      t.notOk(
        find(settings, 'Dynamically linked to V8?'),
        'should not know whether V8 was dynamically linked in'
      )
      t.notOk(
        find(settings, 'Dynamically linked to Zlib?'),
        'should not know whether Zlib was dynamically linked in'
      )
      t.notOk(
        find(settings, 'DTrace support?'),
        'should not know whether DTrace support was configured'
      )
      t.notOk(
        find(settings, 'Event Tracing for Windows (ETW) support?'),
        'should not know whether Event Tracing for Windows was configured'
      )
      t.end()
    })
    t.end()
  })

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

  t.test('should get correct version for dependencies', async () => {
    const root = path.join(__dirname, '../lib/example-packages')
    const versions = await new Promise((resolve, reject) => {
      environment.listPackages(root, (err, packages) => {
        if (err) {
          reject(err)
        }
        const v = packages.reduce((map, pkg) => {
          map[pkg[0]] = pkg[1]
          return map
        }, {})
        return resolve(v)
      })
    })
    const expected = {
      'invalid-json': '<unknown>',
      'valid-json': '1.2.3'
    }
    t.same(versions, expected, 'Version is not the same for dependencies')
    t.end()
  })

  t.test('should not crash when given a file in NODE_PATH', async () => {
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

    await new Promise((resolve) => {
      proc.on('exit', (code) => {
        t.equal(code, 0, 'Process should exit with code 0')
        resolve(code)
      })
    })
    t.end()
  })

  t.test('with symlinks', async (t) => {
    const nmod = path.resolve(__dirname, '../helpers/node_modules')
    const makeDir = async (dirp, mkdirDb) => {
      await fs
        .mkdir(dirp)
        .then(() => {
          return mkdirDb(null)
        })
        .catch((err) => {
          if (err.code !== 'EEXIST') {
            return mkdirDb(err)
          }
          return mkdirDb(null)
        })
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
    const execChild = async () => {
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

      const code = await new Promise((resolve) => {
        proc.on('exit', (code) => resolve(code))
      })
      return code
    }

    t.before(async () => {
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

    t.test('should not crash when encountering a cyclical symlink', async (t) => {
      await execChild()
      t.end()
    })

    t.test('should not crash when encountering a dangling symlink', async (t) => {
      await fs.rm(path.join(nmod, 'a'), { recursive: true, force: true })
      const exitCode = await execChild()
      t.equal(exitCode, 0, 'Exit code should be 0.')
      t.end()
    })
  })

  t.test('when NODE_ENV is "production"', async (t) => {
    let nSettings = null

    t.before(async () => {
      process.env.NODE_ENV = 'production'
      nSettings = await new Promise((resolve, reject) => {
        environment.getJSON((err, data) => {
          if (err) {
            reject(err)
          }
          // delete process.env.NODE_ENV
          resolve(data)
        })
      })
    })

    t.test('should save the NODE_ENV value in the environment settings', (t) => {
      t.equal(find(nSettings, 'NODE_ENV'), 'production')
      t.end()
    })
  })
})
