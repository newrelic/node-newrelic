/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const fs = require('node:fs/promises')
const { spawn } = require('node:child_process')

// For consistent results, unset this in case the user had it set in their
// environment when testing.
delete process.env.NODE_ENV

const environment = require('../../lib/environment')

function find(settings, name) {
  const items = settings.filter((candidate) => candidate[0] === name)
  return items?.[0]?.[1]
}

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.settings = await environment.getJSON()
})

test('should allow clearing of the dispatcher', () => {
  environment.setDispatcher('custom')

  const dispatchers = environment.get('Dispatcher')
  assert.deepStrictEqual(dispatchers, ['custom'])

  assert.doesNotThrow(function () {
    environment.clearDispatcher()
  })
})

test('should allow setting dispatcher version', () => {
  environment.setDispatcher('custom', '2')

  let dispatchers = environment.get('Dispatcher')
  assert.deepStrictEqual(dispatchers, ['custom'])

  dispatchers = environment.get('Dispatcher Version')
  assert.deepStrictEqual(dispatchers, ['2'])

  assert.doesNotThrow(function () {
    environment.clearDispatcher()
  })
})

test('should collect only a single dispatcher', () => {
  environment.setDispatcher('first')
  let dispatchers = environment.get('Dispatcher')
  assert.deepStrictEqual(dispatchers, ['first'])

  environment.setDispatcher('custom')
  dispatchers = environment.get('Dispatcher')
  assert.deepStrictEqual(dispatchers, ['custom'])

  assert.doesNotThrow(function () {
    environment.clearDispatcher()
  })
})

test('should allow clearing of the framework', () => {
  environment.setFramework('custom')
  environment.setFramework('another')

  const frameworks = environment.get('Framework')
  assert.deepStrictEqual(frameworks, ['custom', 'another'])

  assert.doesNotThrow(function () {
    environment.clearFramework()
  })
})

test('should persist dispatcher between getJSON()s', async () => {
  environment.setDispatcher('test')
  assert.deepStrictEqual(environment.get('Dispatcher'), ['test'])

  await environment.refresh()
  assert.deepStrictEqual(environment.get('Dispatcher'), ['test'])
})

test('access to settings', (t) => {
  const { settings } = t.nr
  assert.ok(settings.length > 1, 'should have some settings')
  assert.ok(find(settings, 'Processors') > 0, 'should find at least one CPU')
  assert.ok(find(settings, 'OS'), 'should have found an operating system')
  assert.ok(find(settings, 'OS version'), 'should have found an operating system version')
  assert.ok(find(settings, 'Architecture'), 'should have found the system architecture')
})

test('Node version', (t) => {
  const { settings } = t.nr
  assert.ok(find(settings, 'Node.js version'), 'should know the Node.js version')
})

test('Node environment', () => {
  // expected to be run when NODE_ENV is unset
  assert.ok(environment.get('NODE_ENV').length === 0, 'should not find a value for NODE_ENV')
})

test('with process.config', (t) => {
  const { settings } = t.nr
  assert.ok(find(settings, 'npm installed?'), 'should know whether npm was installed with Node.js')
  assert.ok(
    find(settings, 'OpenSSL support?'),
    'should know whether OpenSSL support was compiled into Node.js'
  )
  assert.ok(
    find(settings, 'Dynamically linked to OpenSSL?'),
    'should know whether OpenSSL was dynamically linked in'
  )
  assert.ok(
    find(settings, 'Dynamically linked to Zlib?'),
    'should know whether Zlib was dynamically linked in'
  )
  assert.ok(find(settings, 'DTrace support?'), 'should know whether DTrace support was configured')
  assert.ok(
    find(settings, 'Event Tracing for Windows (ETW) support?'),
    'should know whether Event Tracing for Windows was configured'
  )
})

test('should have built a flattened package list', (t) => {
  const { settings } = t.nr
  const packages = find(settings, 'Packages')
  assert.ok(packages.length > 5)
  packages.forEach((pair) => {
    assert.equal(JSON.parse(pair).length, 2)
  })
})

test('should have built a flattened dependency list', (t) => {
  const { settings } = t.nr
  const dependencies = find(settings, 'Dependencies')
  assert.ok(dependencies.length > 5)
  dependencies.forEach((pair) => {
    assert.equal(JSON.parse(pair).length, 2)
  })
})

test('should get correct version for dependencies', async () => {
  const root = path.join(__dirname, '../lib/example-packages')
  const packages = []
  await environment.listPackages(root, packages)
  const versions = packages.reduce(function (map, pkg) {
    map[pkg[0]] = pkg[1]
    return map
  }, {})

  assert.deepEqual(versions, {
    'invalid-json': '<unknown>',
    'valid-json': '1.2.3'
  })
})

test('should not crash when given a file in NODE_PATH', (t, end) => {
  const env = {
    NODE_PATH: path.join(__dirname, 'environment.test.js'),
    PATH: process.env.PATH
  }

  const opt = {
    env,
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  }

  const exec = process.argv[0]
  const args = [path.join(__dirname, '../helpers/environment.child.js')]
  const proc = spawn(exec, args, opt)

  proc.on('exit', function (code) {
    assert.equal(code, 0)
    end()
  })
})

test('with symlinks', async (t) => {
  const nmod = path.resolve(__dirname, '../helpers/node_modules')

  function makeDir(dirp) {
    try {
      return fs.mkdir(dirp)
    } catch (error) {
      if (error.code !== 'EEXIST') {
        return error
      }
      return null
    }
  }

  async function makePackage(pkg, dep) {
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

  t.beforeEach(async () => {
    await fs.access(nmod).catch(async () => await fs.mkdir(nmod))

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

  await t.test('should not crash when encountering a cyclical symlink', (t, end) => {
    execChild((code) => {
      assert.equal(code, 0)
      end()
    })
  })

  await t.test('should not crash when encountering a dangling symlink', async () => {
    await fs.rm(path.join(nmod, 'a'), { recursive: true, force: true })
    await new Promise((resolve) => {
      execChild((code) => {
        assert.equal(code, 0)
        resolve()
      })
    })
  })
})

test('when NODE_ENV is "production"', async (t) => {
  process.env.NODE_ENV = 'production'

  t.after(() => {
    delete process.env.NODE_ENV
  })

  const nSettings = await environment.getJSON()

  assert.equal(
    find(nSettings, 'NODE_ENV'),
    'production',
    'should save the NODE_ENV value in the environment settings'
  )
})
