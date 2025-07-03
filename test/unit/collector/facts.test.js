/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const fs = require('node:fs')
const net = require('node:net')

const helper = require('../../lib/agent_helper')
const sysInfo = require('../../../lib/system-info')
const utilTests = require('../../lib/cross_agent_tests/utilization/utilization_json')
const bootIdTests = require('../../lib/cross_agent_tests/utilization/boot_id')
const parseLabels = require('../../../lib/util/label-parser')

const APP_NAMES = ['a', 'c', 'b']
const DISABLE_ALL_DETECTIONS = {
  utilization: {
    detect_aws: false,
    detect_azure: false,
    detect_gcp: false,
    detect_pcf: false,
    detect_docker: false
  }
}
const EXPECTED_FACTS = [
  'pid',
  'host',
  'language',
  'app_name',
  'labels',
  'utilization',
  'agent_version',
  'environment',
  'settings',
  'high_security',
  'display_host',
  'identifier',
  'metadata',
  'event_harvest_config'
]

test('fun facts about apps that New Relic is interested in including', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}

    const logs = {
      debug: [],
      trace: [],
      warn: []
    }
    const logger = {
      warn(...args) {
        logs.warn.push(args)
      },
      debug(...args) {
        logs.debug.push(args)
      },
      trace(...args) {
        logs.trace.push(args)
      }
    }
    ctx.nr.logger = logger
    ctx.nr.logs = logs

    const facts = require('../../../lib/collector/facts')
    ctx.nr.facts = function (agent, callback) {
      return facts(agent, callback, { logger: ctx.nr.logger })
    }

    const config = { app_name: [...APP_NAMES] }
    ctx.nr.agent = helper.loadMockedAgent(Object.assign(config, DISABLE_ALL_DETECTIONS))

    // Undo agent helper override.
    ctx.nr.agent.config.applications = () => {
      return config.app_name
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('the current process ID as `pid`', (t, end) => {
    const { agent, facts } = t.nr
    facts(agent, (result) => {
      assert.equal(result.pid, process.pid)
      end()
    })
  })

  await t.test('the current hostname as `host`', (t, end) => {
    const { agent, facts } = t.nr
    facts(agent, (result) => {
      assert.equal(result.host, os.hostname())
      assert.notEqual(result.host, 'localhost')
      assert.notEqual(result.host, 'localhost.local')
      assert.notEqual(result.host, 'localhost.localdomain')
      end()
    })
  })

  await t.test('the agent`s language (as `language`) to be `nodejs`', (t, end) => {
    const { agent, facts } = t.nr
    facts(agent, (result) => {
      assert.equal(result.language, 'nodejs')
      end()
    })
  })

  await t.test('an array of one or more application names as `app_name`', (t, end) => {
    const { agent, facts } = t.nr
    facts(agent, (result) => {
      assert.equal(Array.isArray(result.app_name), true)
      assert.deepStrictEqual(result.app_name, APP_NAMES)
      end()
    })
  })

  await t.test('the module`s version as `agent_version`', (t, end) => {
    const { agent, facts } = t.nr
    facts(agent, (result) => {
      assert.equal(result.agent_version, agent.version)
      end()
    })
  })

  await t.test('the environment as nested arrays', (t, end) => {
    const { agent, facts } = t.nr
    facts(agent, (result) => {
      assert.equal(Array.isArray(result.environment), true)
      assert.equal(result.environment.length > 1, true)
      end()
    })
  })

  await t.test('an `identifier` for this agent', (t, end) => {
    const { agent, facts } = t.nr
    facts(agent, (result) => {
      const { identifier } = result
      assert.ok(identifier)
      assert.ok(identifier.includes('nodejs'))
      // Including the host has negative consequences on the server.
      assert.equal(identifier.includes(result.host), false)
      assert.ok(identifier.includes([...APP_NAMES].sort().join(',')))
      end()
    })
  })

  await t.test('`metadata` with NEW_RELIC_METADATA_-prefixed env vars', (t, end) => {
    process.env.NEW_RELIC_METADATA_STRING = 'hello'
    process.env.NEW_RELIC_METADATA_BOOL = true
    process.env.NEW_RELIC_METADATA_NUMBER = 42
    t.after(() => {
      delete process.env.NEW_RELIC_METADATA_STRING
      delete process.env.NEW_RELIC_METADATA_BOOL
      delete process.env.NEW_RELIC_METADATA_NUMBER
    })

    const { agent, facts } = t.nr
    facts(agent, (result) => {
      assert.ok(result.metadata)
      assert.equal(result.metadata.NEW_RELIC_METADATA_STRING, 'hello')
      assert.equal(result.metadata.NEW_RELIC_METADATA_BOOL, 'true')
      assert.equal(result.metadata.NEW_RELIC_METADATA_NUMBER, '42')

      const expectedLogs = [
        [
          'New Relic metadata %o',
          {
            NEW_RELIC_METADATA_STRING: 'hello',
            NEW_RELIC_METADATA_BOOL: 'true',
            NEW_RELIC_METADATA_NUMBER: '42'
          }
        ]
      ]
      assert.deepEqual(t.nr.logs.debug, expectedLogs, 'New Relic metadata logged properly')
      end()
    })
  })

  await t.test('empty `metadata` object if no metadata env vars found', (t, end) => {
    const { agent, facts } = t.nr
    facts(agent, (result) => {
      assert.deepEqual(result.metadata, {})
      end()
    })
  })

  await t.test('only returns expected facts', (t, end) => {
    const { agent, facts } = t.nr
    facts(agent, (result) => {
      assert.deepEqual(Object.keys(result).sort(), EXPECTED_FACTS.sort())
      end()
    })
  })

  await t.test('should convert label object to expected format', (t, end) => {
    const { agent, logger, facts } = t.nr
    const longKey = '€'.repeat(257)
    const longValue = '𝌆'.repeat(257)
    agent.config.parsedLabels = parseLabels(
      {
        a: 'b',
        [longKey]: longValue
      },
      { child: () => logger }
    )
    facts(agent, (result) => {
      const expected = [
        { label_type: 'a', label_value: 'b' },
        { label_type: '€'.repeat(255), label_value: '𝌆'.repeat(255) }
      ]
      assert.deepEqual(result.labels, expected)
      end()
    })
  })

  await t.test('should convert label string to expected format', (t, end) => {
    const { agent, logger, facts } = t.nr
    const longKey = '€'.repeat(257)
    const longValue = '𝌆'.repeat(257)
    agent.config.parsedLabels = parseLabels(`a: b; ${longKey}: ${longValue}`, {
      child: () => logger
    })
    facts(agent, (result) => {
      const expected = [
        { label_type: 'a', label_value: 'b' },
        { label_type: '€'.repeat(255), label_value: '𝌆'.repeat(255) }
      ]
      assert.deepEqual(result.labels, expected)
      end()
    })
  })

  // Every call connect needs to use the original values of max_samples_stored as the server overwrites
  // these with derived samples based on harvest cycle frequencies
  await t.test(
    'should add harvest_limits from their respective config values on every call to generate facts',
    (t, end) => {
      const { agent, facts } = t.nr
      const expectedValue = 10
      agent.config.transaction_events.max_samples_stored = expectedValue
      agent.config.custom_insights_events.max_samples_stored = expectedValue
      agent.config.error_collector.max_event_samples_stored = expectedValue
      agent.config.span_events.max_samples_stored = expectedValue
      agent.config.application_logging.forwarding.max_samples_stored = expectedValue

      const expectedHarvestConfig = {
        harvest_limits: {
          analytic_event_data: expectedValue,
          custom_event_data: expectedValue,
          error_event_data: expectedValue,
          span_event_data: expectedValue,
          log_event_data: expectedValue
        }
      }

      facts(agent, (result) => {
        assert.deepEqual(result.event_harvest_config, expectedHarvestConfig)
        end()
      })
    }
  )
})

test('utilization facts', async (t) => {
  const awsInfo = require('../../../lib/utilization/aws-info')
  const azureInfo = require('../../../lib/utilization/azure-info')
  const gcpInfo = require('../../../lib/utilization/gcp-info')
  const kubernetesInfo = require('../../../lib/utilization/kubernetes-info')
  const common = require('../../../lib/utilization/common')

  t.beforeEach((ctx) => {
    ctx.nr = {}

    const startingEnv = {}
    for (const [key, value] of Object.entries(process.env)) {
      startingEnv[key] = value
    }
    ctx.nr.startingEnv = startingEnv

    ctx.nr.startingGetMemory = sysInfo._getMemoryStats
    ctx.nr.startingGetProcessor = sysInfo._getProcessorStats
    ctx.nr.startingDockerInfo = sysInfo._getDockerContainerId
    ctx.nr.startingCommonRequest = common.request
    ctx.nr.startingCommonReadProc = common.readProc

    common.readProc = (file, cb) => {
      setImmediate(cb, null, null)
    }

    ctx.nr.networkInterfaces = os.networkInterfaces

    const facts = require('../../../lib/collector/facts')
    ctx.nr.facts = function (agent, callback) {
      return facts(agent, callback, { logger: ctx.nr.logger })
    }

    awsInfo.clearCache()
    azureInfo.clearCache()
    gcpInfo.clearCache()
    kubernetesInfo.clearCache()
  })

  t.afterEach((ctx) => {
    os.networkInterfaces = ctx.nr.networkInterfaces
    sysInfo._getMemoryStats = ctx.nr.startingGetMemory
    sysInfo._getProcessorStats = ctx.nr.startingGetProcessor
    sysInfo._getDockerContainerId = ctx.nr.startingDockerInfo
    common.request = ctx.nr.startingCommonRequest
    common.readProc = ctx.nr.startingCommonReadProc

    process.env = ctx.nr.startingEnv

    awsInfo.clearCache()
    azureInfo.clearCache()
    gcpInfo.clearCache()
  })

  for (const testCase of utilTests) {
    await t.test(testCase.testname, (t, end) => {
      let mockHostname
      let mockRam
      let mockProc
      let mockVendorMetadata
      const config = structuredClone(DISABLE_ALL_DETECTIONS)

      for (const key of Object.keys(testCase)) {
        const testValue = testCase[key]

        switch (key) {
          case 'input_environment_variables': {
            for (const [k, v] of Object.entries(testValue)) {
              process.env[k] = v
            }
            if (Object.hasOwn(testValue, 'KUBERNETES_SERVICE_HOST') === true) {
              config.utilization.detect_kubernetes = true
            }
            break
          }

          case 'input_aws_id':
          case 'input_aws_type':
          case 'input_aws_zone': {
            mockVendorMetadata = 'aws'
            config.utilization.detect_aws = true
            break
          }

          case 'input_azure_location':
          case 'input_azure_name':
          case 'input_azure_id':
          case 'input_azure_size': {
            mockVendorMetadata = 'azure'
            config.utilization.detect_azure = true
            break
          }

          case 'input_gcp_id':
          case 'input_gcp_type':
          case 'input_gcp_name':
          case 'input_gcp_zone': {
            mockVendorMetadata = 'gcp'
            config.utilization.detect_gcp = true
            break
          }

          case 'input_pcf_guid': {
            mockVendorMetadata = 'pcf'
            process.env.CF_INSTANCE_GUID = testValue
            config.utilization.detect_pcf = true
            break
          }
          case 'input_pcf_ip': {
            mockVendorMetadata = 'pcf'
            process.env.CF_INSTANCE_IP = testValue
            config.utilization.detect_pcf = true
            break
          }
          case 'input_pcf_mem_limit': {
            process.env.MEMORY_LIMIT = testValue
            config.utilization.detect_pcf = true
            break
          }

          case 'input_kubernetes_id': {
            mockVendorMetadata = 'kubernetes'
            config.utilization.detect_kubernetes = true
            break
          }

          case 'input_hostname': {
            mockHostname = () => testValue
            break
          }

          case 'input_total_ram_mib': {
            mockRam = () => Promise.resolve(testValue)
            break
          }

          case 'input_logical_processors': {
            mockProc = () => Promise.resolve({ logical: testValue })
            break
          }

          case 'input_ip_address': {
            mockIpAddresses(testValue)
            break
          }

          // Ignore these keys.
          case 'testname':
          case 'input_full_hostname': // We don't collect full hostnames.
          case 'expected_output_json': {
            break
          }

          default: {
            throw Error(`Unknown test key "${key}"`)
          }
        }
      }

      const expected = testCase.expected_output_json
      // We don't collect full hostnames.
      delete expected.full_hostname

      const agent = helper.loadMockedAgent(config)
      t.after(() => {
        helper.unloadAgent(agent)
      })

      if (mockHostname) {
        agent.config.getHostnameSafe = mockHostname
      }
      if (mockRam) {
        sysInfo._getMemoryStats = mockRam
      }
      if (mockProc) {
        sysInfo._getProcessorStats = mockProc
      }
      if (mockVendorMetadata) {
        common.request = makeMockCommonRequest(testCase, mockVendorMetadata)
      }

      t.nr.facts(agent, (result) => {
        assert.deepEqual(result.utilization, expected)
        end()
      })

      function makeMockCommonRequest(tCase, type) {
        return (opts, _agent, cb) => {
          assert.equal(_agent, agent)
          let payload
          switch (type) {
            case 'aws': {
              payload = {
                instanceId: tCase.input_aws_id,
                instanceType: tCase.input_aws_type,
                availabilityZone: tCase.input_aws_zone
              }
              break
            }

            case 'azure': {
              payload = {
                location: tCase.input_azure_location,
                name: tCase.input_azure_name,
                vmId: tCase.input_azure_id,
                vmSize: tCase.input_azure_size
              }
              break
            }

            case 'gcp': {
              payload = {
                id: tCase.input_gcp_id,
                machineType: tCase.input_gcp_type,
                name: tCase.input_gcp_name,
                zone: tCase.input_gcp_zone
              }
              break
            }
          }

          setImmediate(cb, null, JSON.stringify(payload))
        }
      }
    })
  }
})

test('boot id facts', async (t) => {
  const common = require('../../../lib/utilization/common')

  t.beforeEach((ctx) => {
    ctx.nr = {}

    const facts = require('../../../lib/collector/facts')
    ctx.nr.facts = function (agent, callback) {
      return facts(agent, callback, { logger: ctx.nr.logger })
    }

    ctx.nr.startingGetMemory = sysInfo._getMemoryStats
    ctx.nr.startingGetProcessor = sysInfo._getProcessorStats
    ctx.nr.startingDockerInfo = sysInfo._getDockerContainerId
    ctx.nr.startingCommonReadProc = common.readProc
    ctx.nr.startingOsPlatform = os.platform
    ctx.nr.startingFsAccess = fs.access

    os.platform = () => {
      return 'linux'
    }
    fs.access = (file, mode, cb) => {
      cb(null)
    }
  })

  t.afterEach((ctx) => {
    sysInfo._getMemoryStats = ctx.nr.startingGetMemory
    sysInfo._getProcessorStats = ctx.nr.startingGetProcessor
    sysInfo._getDockerContainerId = ctx.nr.startingDockerInfo
    common.readProc = ctx.nr.startingCommonReadProc
    os.platform = ctx.nr.startingOsPlatform
    fs.access = ctx.nr.startingFsAccess
  })

  for (const testCase of bootIdTests) {
    await t.test(testCase.testname, (t, end) => {
      let agent = null
      let mockHostname
      let mockRam
      let mockProc
      let mockReadProc

      for (const key of Object.keys(testCase)) {
        const testValue = testCase[key]

        switch (key) {
          case 'input_hostname': {
            mockHostname = () => testValue
            break
          }

          case 'input_total_ram_mib': {
            mockRam = () => Promise.resolve(testValue)
            break
          }

          case 'input_logical_processors': {
            mockProc = () => Promise.resolve({ logical: testValue })
            break
          }

          case 'input_boot_id': {
            mockReadProc = (file, cb) => cb(null, testValue, agent)
            break
          }

          // Ignore these keys.
          case 'testname':
          case 'expected_output_json':
          case 'expected_metrics': {
            break
          }

          default: {
            throw Error(`Unknown test key "${key}"`)
          }
        }
      }

      const expected = testCase.expected_output_json
      agent = helper.loadMockedAgent(structuredClone(DISABLE_ALL_DETECTIONS))
      t.after(() => helper.unloadAgent(agent))

      if (mockHostname) {
        agent.config.getHostnameSafe = mockHostname
      }
      if (mockRam) {
        sysInfo._getMemoryStats = mockRam
      }
      if (mockProc) {
        sysInfo._getProcessorStats = mockProc
      }
      if (mockReadProc) {
        common.readProc = mockReadProc
      }

      t.nr.facts(agent, (result) => {
        // There are keys in the facts that aren't account for in the
        // expected object (namely ip addreses).
        for (const [key, value] of Object.entries(expected)) {
          assert.equal(result.utilization[key], value)
        }
        checkMetrics(testCase.expected_metrics, agent)
        end()
      })
    })
  }

  function checkMetrics(expectedMetrics, agent) {
    if (!expectedMetrics) {
      return
    }

    for (const [key, value] of Object.entries(expectedMetrics)) {
      const metric = agent.metrics.getOrCreateMetric(key)
      assert.equal(metric.callCount, value.call_count)
    }
  }
})

test('display_host facts', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}

    const facts = require('../../../lib/collector/facts')
    ctx.nr.facts = function (agent, callback) {
      return facts(agent, callback, { logger: ctx.nr.logger })
    }

    ctx.nr.agent = helper.loadMockedAgent(structuredClone(DISABLE_ALL_DETECTIONS))
    ctx.nr.agent.config.utilization = {}

    ctx.nr.osNetworkInterfaces = os.networkInterfaces
    ctx.nr.osHostname = os.hostname
    os.hostname = () => {
      throw Error('BROKEN')
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    os.hostname = ctx.nr.osHostname
    os.networkInterfaces = ctx.nr.osNetworkInterfaces
    delete process.env.DYNO
  })

  await t.test('should be set to what the user specifies (happy path)', (t, end) => {
    const { agent, facts } = t.nr
    agent.config.process_host.display_name = 'test-value'
    facts(agent, (result) => {
      assert.equal(result.display_host, 'test-value')
      end()
    })
  })

  await t.test('should change large hostname of more than 255 bytes to safe value', (t, end) => {
    const { agent, facts } = t.nr
    agent.config.process_host.display_name = 'lo'.repeat(200)
    facts(agent, (result) => {
      assert.equal(result.display_host, agent.config.getHostnameSafe())
      end()
    })
  })

  await t.test('should be process.env.DYNO when use_heroku_dyno_names is true', (t, end) => {
    const { agent, facts } = t.nr
    process.env.DYNO = 'web.1'
    agent.config.heroku.use_dyno_names = true
    facts(agent, (result) => {
      assert.equal(result.display_host, 'web.1')
      end()
    })
  })

  await t.test('should ignore process.env.DYNO when use_heroku_dyno_names is false', (t, end) => {
    const { agent, facts } = t.nr
    process.env.DYNO = 'ignored'
    os.hostname = t.nr.osHostname
    agent.config.heroku.use_dyno_names = false
    facts(agent, (result) => {
      assert.equal(result.display_host, os.hostname())
      end()
    })
  })

  await t.test('should be cached along with hostname in config', (t, end) => {
    const { agent, facts } = t.nr
    agent.config.process_host.display_name = 'test-value'
    facts(agent, (result) => {
      const displayHost1 = result.display_host
      const host1 = result.host

      os.hostname = t.nr.osHostname
      agent.config.process_host.display_name = 'test-value2'

      facts(agent, (result2) => {
        assert.deepEqual(result2.display_host, displayHost1)
        assert.deepEqual(result2.host, host1)

        agent.config.clearHostnameCache()
        agent.config.clearDisplayHostCache()

        facts(agent, (result3) => {
          assert.deepEqual(result3.display_host, 'test-value2')
          assert.deepEqual(result3.host, os.hostname())

          end()
        })
      })
    })
  })

  await t.test('should be set as os.hostname() (if available) when not specified', (t, end) => {
    const { agent, facts } = t.nr
    os.hostname = t.nr.osHostname
    facts(agent, (result) => {
      assert.equal(result.display_host, os.hostname())
      end()
    })
  })

  await t.test('should be ipv4 when ipv_preference === 4', (t, end) => {
    const { agent, facts } = t.nr
    agent.config.process_host.ipv_preference = '4'
    facts(agent, (result) => {
      assert.equal(net.isIPv4(result.display_host), true)
      end()
    })
  })

  await t.test('should be ipv6 when ipv_preference === 6', (t, end) => {
    const { agent, facts } = t.nr
    if (!agent.config.getIPAddresses().ipv6) {
      end()
    }

    agent.config.process_host.ipv_preference = '6'
    facts(agent, (result) => {
      assert.equal(net.isIPv6(result.display_host), true)
      end()
    })
  })

  await t.test('should be ipv4 when invalid ipv_preference', (t, end) => {
    const { agent, facts } = t.nr
    agent.config.process_host.ipv_preference = '9'
    facts(agent, (result) => {
      assert.equal(net.isIPv4(result.display_host), true)
      end()
    })
  })

  await t.test('returns no ipv4, hostname should be ipv6 if possible', (t, end) => {
    const { agent, facts } = t.nr
    if (!agent.config.getIPAddresses().ipv6) {
      end()
    }

    const mockedNI = {
      lo: [],
      en0: [
        {
          address: 'fe80::a00:27ff:fe4e:66a1',
          netmask: 'ffff:ffff:ffff:ffff::',
          family: 'IPv6',
          mac: '01:02:03:0a:0b:0c',
          internal: false
        }
      ]
    }
    os.networkInterfaces = () => mockedNI

    facts(agent, (result) => {
      assert.equal(net.isIPv6(result.display_host), true)
      end()
    })
  })

  await t.test(
    'returns no ip addresses, hostname should be UNKNOWN_BOX (everything broke)',
    (t, end) => {
      const { agent, facts } = t.nr
      const mockedNI = { lo: [], en0: [] }
      os.networkInterfaces = () => mockedNI
      facts(agent, (result) => {
        assert.equal(result.display_host, 'UNKNOWN_BOX')
        end()
      })
    }
  )
})

test('host facts', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}

    // Mock fetchSystemInfo to return a specific value
    const mockSysInfo = async (agent, callback) => {
      const systemInfo = {}

      // Mock utilization.getVendors
      const vendorStats = {
        gcp: {
          id: 'mock-gcp-instance-id',
          zone: 'us-central1-a'
        }
      }
      systemInfo.vendors = vendorStats

      callback(null, systemInfo)
    }

    ctx.systemInfoPath = require.resolve('../../../lib/system-info')
    ctx.originalSystemInfoModule = require.cache[ctx.systemInfoPath]
    require.cache[ctx.systemInfoPath] = {
      id: ctx.systemInfoPath,
      filename: ctx.systemInfoPath,
      loaded: true,
      exports: mockSysInfo
    }

    ctx.factsPath = require.resolve('../../../lib/collector/facts')
    ctx.originalFactsModule = require.cache[ctx.factsPath]
    delete require.cache[ctx.factsPath]

    const facts = require('../../../lib/collector/facts')
    ctx.nr.facts = function (agent, callback) {
      return facts(agent, callback, { logger: ctx.nr.logger })
    }

    ctx.nr.agent = helper.loadMockedAgent(structuredClone(DISABLE_ALL_DETECTIONS))
    ctx.nr.agent.config.utilization = null
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    delete process.env.K_SERVICE

    // Restore system-info cache
    if (ctx.systemInfoPath) {
      if (ctx.originalSystemInfoModule === undefined) {
        delete require.cache[ctx.systemInfoPath]
      } else {
        require.cache[ctx.systemInfoPath] = ctx.originalSystemInfoModule
      }
    }

    // Restore facts cache
    if (ctx.factsPath) {
      if (ctx.originalFactsModule === undefined) {
        delete require.cache[ctx.factsPath]
      } else {
        require.cache[ctx.factsPath] = ctx.originalFactsModule
      }
    }
  })

  await t.test('should be GCP id when K_SERVICE is set', (t, end) => {
    const { agent, facts } = t.nr

    agent.config.utilization = { gcp_use_instance_as_host: true }
    process.env.K_SERVICE = 'mock-service'

    facts(agent, (result) => {
      assert.equal(result.host, 'mock-gcp-instance-id', 'Hostname should be set to GCP instance ID')
      end()
    })
  })

  await t.test('should not be GCP id when K_SERVICE is not present', (t, end) => {
    const { agent, facts } = t.nr

    agent.config.utilization = { gcp_use_instance_as_host: true }

    facts(agent, (result) => {
      assert.equal(result.host, os.hostname(), 'Hostname should not be set to GCP instance ID')
      end()
    })
  })

  await t.test('should not be GCP id when K_SERVICE is set but utilization.gcp_use_instance_as_host is false', (t, end) => {
    const { agent, facts } = t.nr

    agent.config.utilization = { gcp_use_instance_as_host: false }
    process.env.K_SERVICE = 'mock-service'

    facts(agent, (result) => {
      assert.equal(result.host, os.hostname(), 'Hostname should not be set to GCP instance ID')
      end()
    })
  })
})

function mockIpAddresses(values) {
  os.networkInterfaces = () => {
    return {
      en0: values.reduce((interfaces, address) => {
        interfaces.push({ address })
        return interfaces
      }, [])
    }
  }
}
