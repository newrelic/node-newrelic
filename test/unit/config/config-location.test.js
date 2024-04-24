/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const path = require('path')
const fs = require('fs')
const fsPromises = require('fs/promises')
const sinon = require('sinon')

const { removeMatchedModules } = require('../../lib/cache-buster')
const Config = require('../../../lib/config')

tap.test('when overriding the config file location via NEW_RELIC_HOME', (t) => {
  t.autoend()

  const DESTDIR = path.join(__dirname, 'xXxNRHOMETESTxXx')
  const NOPLACEDIR = path.join(__dirname, 'NOHEREHERECHAMP')
  const CONFIGPATH = path.join(DESTDIR, 'newrelic.js')

  let origHome = null
  let startDir = null

  t.beforeEach(async () => {
    if (process.env.NEW_RELIC_HOME) {
      origHome = process.env.NEW_RELIC_HOME
    }

    startDir = process.cwd()

    await fsPromises.mkdir(DESTDIR)
    await fsPromises.mkdir(NOPLACEDIR)

    process.chdir(NOPLACEDIR)
    process.env.NEW_RELIC_HOME = DESTDIR

    const sampleConfig = fs.createReadStream(path.join(__dirname, '../../../newrelic.js'))
    const sandboxedConfig = fs.createWriteStream(CONFIGPATH)
    sampleConfig.pipe(sandboxedConfig)

    await new Promise((resolve) => {
      sandboxedConfig.on('close', resolve)
    })
  })

  t.afterEach(async () => {
    if (origHome) {
      process.env.NEW_RELIC_HOME = origHome
    } else {
      delete process.env.NEW_RELIC_HOME
    }
    origHome = null

    await fsPromises.unlink(CONFIGPATH)
    await fsPromises.rm(DESTDIR, { recursive: true, force: true })

    process.chdir(startDir)
    await fsPromises.rm(NOPLACEDIR, { recursive: true })
  })

  t.test('should load the configuration', (t) => {
    t.doesNotThrow(() => {
      Config.initialize()
    })

    t.end()
  })

  t.test('should export the home directory on the resulting object', (t) => {
    const configuration = Config.initialize()
    t.equal(configuration.newrelic_home, DESTDIR)

    t.end()
  })

  t.test('should ignore the configuration file completely when so directed', (t) => {
    process.env.NEW_RELIC_NO_CONFIG_FILE = 'true'
    process.env.NEW_RELIC_HOME = '/xxxnoexist/nofile'

    t.teardown(() => {
      delete process.env.NEW_RELIC_NO_CONFIG_FILE
      delete process.env.NEW_RELIC_HOME
    })

    let configuration

    t.doesNotThrow(() => {
      configuration = Config.initialize()
    })

    t.notOk(configuration.newrelic_home)

    t.ok(configuration.error_collector)
    t.equal(configuration.error_collector.enabled, true)

    t.end()
  })
})

tap.test('Selecting config file path', (t) => {
  t.autoend()

  const DESTDIR = path.join(__dirname, 'test_NEW_RELIC_CONFIG_FILENAME')
  const NOPLACEDIR = path.join(__dirname, 'test_NEW_RELIC_CONFIG_FILENAME_dummy')
  const MAIN_MODULE_DIR = path.join(__dirname, 'test_NEW_RELIC_CONFIG_FILENAME_MAIN_MODULE')

  let origHome
  let originalWorkingDirectory
  let CONFIG_PATH
  let processMainModuleStub

  t.beforeEach(() => {
    if (process.env.NEW_RELIC_HOME) {
      origHome = process.env.NEW_RELIC_HOME
    }

    process.env.NEW_RELIC_HOME = DESTDIR

    originalWorkingDirectory = process.cwd()

    processMainModuleStub = sinon.stub(process, 'mainModule').value({
      filename: `${MAIN_MODULE_DIR}/index.js`
    })

    fs.mkdirSync(DESTDIR)
    fs.mkdirSync(NOPLACEDIR)
    fs.mkdirSync(MAIN_MODULE_DIR)

    process.chdir(NOPLACEDIR)
  })

  t.afterEach(() => {
    if (origHome) {
      process.env.NEW_RELIC_HOME = origHome
    } else {
      delete process.env.NEW_RELIC_HOME
    }
    origHome = null

    if (CONFIG_PATH) {
      fs.unlinkSync(CONFIG_PATH)
      CONFIG_PATH = undefined
    }

    processMainModuleStub.resetBehavior()

    fs.rmSync(DESTDIR, { recursive: true })
    fs.rmSync(NOPLACEDIR, { recursive: true })
    fs.rmSync(MAIN_MODULE_DIR, { recursive: true })

    process.chdir(originalWorkingDirectory)

    const mainModuleRegex = new RegExp(MAIN_MODULE_DIR)
    removeMatchedModules(mainModuleRegex)
  })

  t.test('should load the default newrelic.js config file', (t) => {
    const filename = 'newrelic.js'
    createSampleConfig(DESTDIR, filename)

    const configuration = Config.initialize()
    t.equal(configuration.app_name, filename)

    t.end()
  })

  t.test('should load the default newrelic.cjs config file', (t) => {
    const filename = 'newrelic.cjs'
    createSampleConfig(DESTDIR, filename)

    const configuration = Config.initialize()
    t.equal(configuration.app_name, filename)

    t.end()
  })

  t.test('should load config when overriding the default with NEW_RELIC_CONFIG_FILENAME', (t) => {
    const filename = 'some-file-name.js'
    process.env.NEW_RELIC_CONFIG_FILENAME = filename
    createSampleConfig(DESTDIR, filename)

    const configuration = Config.initialize()
    t.equal(configuration.app_name, filename)

    t.end()
  })

  t.test("should load config from the main module's filepath", (t) => {
    const filename = 'newrelic.js'
    createSampleConfig(MAIN_MODULE_DIR, filename)

    const configuration = Config.initialize()
    t.equal(configuration.app_name, filename)

    t.end()
  })

  t.test('should load even if parsing the config file throws an error', (t) => {
    const filename = 'newrelic.js'
    createInvalidConfig(MAIN_MODULE_DIR, filename)
    process.env.NEW_RELIC_APP_NAME = filename

    const configuration = Config.initialize()
    t.same(configuration.app_name, [filename])

    t.end()
  })

  function createSampleConfig(dir, filename) {
    CONFIG_PATH = path.join(dir, filename)

    const config = {
      app_name: filename
    }

    fs.writeFileSync(CONFIG_PATH, `exports.config = ${JSON.stringify(config)}`)
  }

  function createInvalidConfig(dir, filename) {
    CONFIG_PATH = path.join(dir, filename)

    fs.writeFileSync(CONFIG_PATH, `exports.config = null.pleaseThrow`)
  }
})
