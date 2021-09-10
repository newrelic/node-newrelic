/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const os = require('os')
const hostname = os.hostname
const networkInterfaces = os.networkInterfaces
const chai = require('chai')
const expect = chai.expect
const helper = require('../lib/agent_helper')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const loggerMock = require('./mocks/logger')()
const facts = proxyquire('../../lib/collector/facts', {
  '../logger': {
    child: sinon.stub().callsFake(() => loggerMock)
  }
})

const sysInfo = require('../../lib/system-info')
const utilTests = require('../lib/cross_agent_tests/utilization/utilization_json')
const bootIdTests = require('../lib/cross_agent_tests/utilization/boot_id')

const EXPECTED = [
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

const ip6Digits = '(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])'
const ip6Nums = '(?:(?:' + ip6Digits + '.){3,3}' + ip6Digits + ')'
const IP_V6_PATTERN = new RegExp(
  '(?:(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|' +
    '(?:[0-9a-fA-F]{1,4}:){1,7}:|' +
    '(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|' +
    '(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|' +
    '(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|' +
    '(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|' +
    '(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|' +
    '[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|' +
    ':(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|' +
    'fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|' +
    '::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:' +
    ip6Nums +
    ')|' +
    '(?:[0-9a-fA-F]{1,4}:){1,4}:(?:' +
    ip6Nums +
    '))'
)

const IP_V4_PATTERN = new RegExp(
  '(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}' +
    '(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])'
)

const DISABLE_ALL_DETECTIONS = {
  utilization: {
    detect_aws: false,
    detect_azure: false,
    detect_gcp: false,
    detect_pcf: false,
    detect_docker: false
  }
}

const APP_NAMES = ['a', 'c', 'b']

tap.test('fun facts about apps that New Relic is interested in include', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    loggerMock.debug.reset()
    const config = {
      app_name: [...APP_NAMES]
    }
    agent = helper.loadMockedAgent(Object.assign(config, DISABLE_ALL_DETECTIONS))
    // Undo agent helper override.
    agent.config.applications = () => {
      return config.app_name
    }
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    os.networkInterfaces = networkInterfaces
  })

  t.test("the current process ID as 'pid'", (t) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.pid).equal(process.pid)
      t.end()
    })
  })

  t.test("the current hostname as 'host' (hope it's not 'localhost' lol)", (t) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.host).equal(hostname())
      expect(factsed.host).not.equal('localhost')
      expect(factsed.host).not.equal('localhost.local')
      expect(factsed.host).not.equal('localhost.localdomain')
      t.end()
    })
  })

  t.test("the agent's language (as 'language') to be 'nodejs'", (t) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.language).equal('nodejs')
      t.end()
    })
  })

  t.test("an array of one or more application names as 'app_name' (sic)", (t) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.app_name).an('array')
      t.equal(factsed.app_name.length, APP_NAMES.length)
      t.end()
    })
  })

  t.test("the module's version as 'agent_version'", (t) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.agent_version).equal(agent.version)
      t.end()
    })
  })

  t.test('the environment (see environment.test.js) as crazy nested arrays', (t) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.environment).to.be.an('array')
      expect(factsed.environment).to.have.length.above(1)
      t.end()
    })
  })

  t.test("an 'identifier' for this agent", (t) => {
    facts(agent, function (factsed) {
      expect(factsed).to.have.property('identifier')
      const identifier = factsed.identifier
      expect(identifier).to.contain('nodejs')
      // Including the host has negative consequences on the server.
      expect(identifier).to.not.contain(factsed.host)
      expect(identifier).to.contain([...APP_NAMES].sort().join(','))
      t.end()
    })
  })

  t.test("'metadata' with NEW_RELIC_METADATA_-prefixed env vars", (t) => {
    process.env.NEW_RELIC_METADATA_STRING = 'hello'
    process.env.NEW_RELIC_METADATA_BOOL = true
    process.env.NEW_RELIC_METADATA_NUMBER = 42

    facts(agent, (data) => {
      expect(data).to.have.property('metadata')
      expect(data.metadata).to.have.property('NEW_RELIC_METADATA_STRING', 'hello')
      expect(data.metadata).to.have.property('NEW_RELIC_METADATA_BOOL', 'true')
      expect(data.metadata).to.have.property('NEW_RELIC_METADATA_NUMBER', '42')
      t.same(
        loggerMock.debug.args,
        [
          [
            'New Relic metadata %o',
            {
              NEW_RELIC_METADATA_STRING: 'hello',
              NEW_RELIC_METADATA_BOOL: 'true',
              NEW_RELIC_METADATA_NUMBER: '42'
            }
          ]
        ],
        'New relic metadata not logged properly'
      )

      delete process.env.NEW_RELIC_METADATA_STRING
      delete process.env.NEW_RELIC_METADATA_BOOL
      delete process.env.NEW_RELIC_METADATA_NUMBER
      t.end()
    })
  })

  t.test("empty 'metadata' object if no metadata env vars found", (t) => {
    facts(agent, (data) => {
      expect(data).to.have.property('metadata')
      expect(data.metadata).to.deep.equal({})
      t.end()
    })
  })

  t.test('and nothing else', (t) => {
    facts(agent, function getFacts(factsed) {
      expect(Object.keys(factsed).sort()).eql(EXPECTED.sort())
      t.end()
    })
  })

  t.test('should convert label object to expected format', (t) => {
    const longKey = Array(257).join('€')
    const longValue = Array(257).join('𝌆')
    agent.config.labels = {}
    agent.config.labels.a = 'b'
    agent.config.labels[longKey] = longValue
    facts(agent, function getFacts(factsed) {
      const expected = [{ label_type: 'a', label_value: 'b' }]
      expected.push({
        label_type: Array(256).join('€'),
        label_value: Array(256).join('𝌆')
      })

      expect(factsed.labels).deep.equal(expected)
      t.end()
    })
  })

  t.test('should convert label string to expected format', (t) => {
    const longKey = Array(257).join('€')
    const longValue = Array(257).join('𝌆')
    agent.config.labels = 'a: b; ' + longKey + ' : ' + longValue
    facts(agent, function getFacts(factsed) {
      const expected = [{ label_type: 'a', label_value: 'b' }]
      expected.push({
        label_type: Array(256).join('€'),
        label_value: Array(256).join('𝌆')
      })

      expect(factsed.labels).deep.equal(expected)
      t.end()
    })
  })

  t.test('should add harvest_limits from local or default config', (t) => {
    const expectedValue = 10
    agent.config.transaction_events.max_samples_stored = expectedValue
    agent.config.custom_insights_events.max_samples_stored = expectedValue
    agent.config.error_collector.max_event_samples_stored = expectedValue
    agent.config.span_events.max_samples_stored = expectedValue

    const expectedHarvestConfig = {
      harvest_limits: {
        analytic_event_data: expectedValue,
        custom_event_data: expectedValue,
        error_event_data: expectedValue,
        span_event_data: expectedValue
      }
    }

    facts(agent, (factsResult) => {
      expect(factsResult.event_harvest_config).deep.equal(expectedHarvestConfig)
      t.end()
    })
  })
})

tap.test('utilization', (t) => {
  t.autoend()

  let agent = null
  const awsInfo = require('../../lib/utilization/aws-info')
  const azureInfo = require('../../lib/utilization/azure-info')
  const gcpInfo = require('../../lib/utilization/gcp-info')
  const kubernetesInfo = require('../../lib/utilization/kubernetes-info')
  const common = require('../../lib/utilization/common')

  let startingEnv = null
  let startingGetMemory = null
  let startingGetProcessor = null
  let startingDockerInfo = null
  let startingCommonRequest = null
  let startingCommonReadProc = null

  t.beforeEach(() => {
    startingEnv = {}
    Object.keys(process.env).forEach((key) => {
      startingEnv[key] = process.env[key]
    })

    startingGetMemory = sysInfo._getMemoryStats
    startingGetProcessor = sysInfo._getProcessorStats
    startingDockerInfo = sysInfo._getDockerContainerId
    startingCommonRequest = common.request
    startingCommonReadProc = common.readProc

    common.readProc = (file, cb) => {
      setImmediate(cb, null, null)
    }

    awsInfo.clearCache()
    azureInfo.clearCache()
    gcpInfo.clearCache()
    kubernetesInfo.clearCache()
  })

  t.afterEach(() => {
    if (agent) {
      helper.unloadAgent(agent)
    }

    os.networkInterfaces = networkInterfaces
    process.env = startingEnv
    sysInfo._getMemoryStats = startingGetMemory
    sysInfo._getProcessorStats = startingGetProcessor
    sysInfo._getDockerContainerId = startingDockerInfo
    common.request = startingCommonRequest
    common.readProc = startingCommonReadProc

    startingEnv = null
    startingGetMemory = null
    startingGetProcessor = null
    startingDockerInfo = null
    startingCommonRequest = null
    startingCommonReadProc = null

    awsInfo.clearCache()
    azureInfo.clearCache()
    gcpInfo.clearCache()
  })

  utilTests.forEach((test) => {
    t.test(test.testname, (t) => {
      let mockHostname = false
      let mockRam = false
      let mockProc = false
      let mockVendorMetadata = false
      const config = {
        utilization: {
          detect_aws: false,
          detect_azure: false,
          detect_gcp: false,
          detect_pcf: false,
          detect_docker: false,
          detect_kubernetes: false
        }
      }

      Object.keys(test).forEach(function setVal(key) {
        const testValue = test[key]

        switch (key) {
          case 'input_environment_variables':
            Object.keys(testValue).forEach((name) => {
              process.env[name] = testValue[name]
            })
            break

          case 'input_aws_id':
          case 'input_aws_type':
          case 'input_aws_zone':
            mockVendorMetadata = 'aws'
            config.utilization.detect_aws = true
            break

          case 'input_azure_location':
          case 'input_azure_name':
          case 'input_azure_id':
          case 'input_azure_size':
            mockVendorMetadata = 'azure'
            config.utilization.detect_azure = true
            break

          case 'input_gcp_id':
          case 'input_gcp_type':
          case 'input_gcp_name':
          case 'input_gcp_zone':
            mockVendorMetadata = 'gcp'
            config.utilization.detect_gcp = true
            break

          case 'input_pcf_guid':
            process.env.CF_INSTANCE_GUID = testValue
            config.utilization.detect_pcf = true
            break
          case 'input_pcf_ip':
            process.env.CF_INSTANCE_IP = testValue
            config.utilization.detect_pcf = true
            break
          case 'input_pcf_mem_limit':
            process.env.MEMORY_LIMIT = testValue
            config.utilization.detect_pcf = true
            break

          case 'input_kubernetes_id':
            mockVendorMetadata = 'kubernetes'
            config.utilization.detect_kubernetes = true
            break

          case 'input_hostname':
            mockHostname = () => testValue
            break

          case 'input_total_ram_mib':
            mockRam = (cb) => cb(testValue)
            break

          case 'input_logical_processors':
            mockProc = (cb) => cb({ logical: testValue })
            break

          case 'input_ip_address':
            mockIpAddresses(testValue)
            break

          // Ignore these keys.
          case 'testname':
          case 'input_full_hostname': // We don't collect full hostnames
          case 'expected_output_json':
            break

          default:
            throw new Error('Unknown test key "' + key + '"')
            break
        }
      })

      const expected = test.expected_output_json
      // We don't collect full hostnames
      delete expected.full_hostname

      // Stub out docker container id query to make this consistent on all OSes.
      sysInfo._getDockerContainerId = (_agent, callback) => {
        return callback(null)
      }

      agent = helper.loadMockedAgent(config)
      if (mockHostname) {
        agent.config.getHostnameSafe = mockHostname
        mockHostname = false
      }
      if (mockRam) {
        sysInfo._getMemoryStats = mockRam
        mockRam = false
      }
      if (mockProc) {
        sysInfo._getProcessorStats = mockProc
        mockProc = false
      }
      if (mockVendorMetadata) {
        common.request = makeMockCommonRequest(test, mockVendorMetadata)
      }
      facts(agent, function getFacts(factsed) {
        expect(factsed.utilization).to.deep.equal(expected)
        t.end()
      })
    })
  })

  function makeMockCommonRequest(test, type) {
    return (opts, _agent, cb) => {
      expect(_agent).to.equal(agent)
      setImmediate(
        cb,
        null,
        JSON.stringify(
          type === 'aws'
            ? {
                instanceId: test.input_aws_id,
                instanceType: test.input_aws_type,
                availabilityZone: test.input_aws_zone
              }
            : type === 'azure'
            ? {
                location: test.input_azure_location,
                name: test.input_azure_name,
                vmId: test.input_azure_id,
                vmSize: test.input_azure_size
              }
            : type === 'gcp'
            ? {
                id: test.input_gcp_id,
                machineType: test.input_gcp_type,
                name: test.input_gcp_name,
                zone: test.input_gcp_zone
              }
            : null
        )
      )
    }
  }
})

tap.test('boot_id', (t) => {
  t.autoend()
  let agent = null
  const common = require('../../lib/utilization/common')

  let startingGetMemory = null
  let startingGetProcessor = null
  let startingDockerInfo = null
  let startingCommonReadProc = null
  let startingOsPlatform = null

  t.beforeEach(() => {
    startingGetMemory = sysInfo._getMemoryStats
    startingGetProcessor = sysInfo._getProcessorStats
    startingDockerInfo = sysInfo._getDockerContainerId
    startingCommonReadProc = common.readProc
    startingOsPlatform = os.platform

    os.platform = () => 'linux'
  })

  t.afterEach(() => {
    if (agent) {
      helper.unloadAgent(agent)
    }

    sysInfo._getMemoryStats = startingGetMemory
    sysInfo._getProcessorStats = startingGetProcessor
    sysInfo._getDockerContainerId = startingDockerInfo
    common.readProc = startingCommonReadProc
    os.platform = startingOsPlatform

    startingGetMemory = null
    startingGetProcessor = null
    startingDockerInfo = null
    startingCommonReadProc = null
    startingOsPlatform = null
  })

  bootIdTests.forEach((test) => {
    t.test(test.testname, (t) => {
      let mockHostname = false
      let mockRam = false
      let mockProc = false
      let mockReadProc = false

      Object.keys(test).forEach(function setVal(key) {
        const testValue = test[key]

        switch (key) {
          case 'input_hostname':
            mockHostname = () => testValue
            break

          case 'input_total_ram_mib':
            mockRam = (cb) => cb(testValue)
            break

          case 'input_logical_processors':
            mockProc = (cb) => cb({ logical: testValue })
            break

          case 'input_boot_id':
            mockReadProc = (file, cb) => cb(null, testValue)
            break

          // Ignore these keys.
          case 'testname':
          case 'expected_output_json':
          case 'expected_metrics':
            break

          default:
            throw new Error('Unknown test key "' + key + '"')
            break
        }
      })

      const expected = test.expected_output_json

      // Stub out docker container id query to make this consistent on all OSes.
      sysInfo._getDockerContainerId = (_agent, callback) => {
        return callback(null)
      }

      agent = helper.loadMockedAgent(DISABLE_ALL_DETECTIONS)
      if (mockHostname) {
        agent.config.getHostnameSafe = mockHostname
        mockHostname = false
      }
      if (mockRam) {
        sysInfo._getMemoryStats = mockRam
        mockRam = false
      }
      if (mockProc) {
        sysInfo._getProcessorStats = mockProc
        mockProc = false
      }
      if (mockReadProc) {
        common.readProc = mockReadProc
      }
      facts(agent, function getFacts(factsed) {
        // There are keys in the facts that aren't accounted for in the
        // expected object (namely ip addresses).
        Object.keys(expected).forEach((key) => {
          expect(factsed.utilization[key]).to.equal(expected[key])
        })
        checkMetrics(test.expected_metrics)
        t.end()
      })
    })
  })

  function checkMetrics(expectedMetrics) {
    if (!expectedMetrics) {
      return
    }

    Object.keys(expectedMetrics).forEach((expectedMetric) => {
      const metric = agent.metrics.getOrCreateMetric(expectedMetric)
      expect(metric).to.have.property('callCount', expectedMetrics[expectedMetric].call_count)
    })
  }
})

tap.test('display_host', { timeout: 20000 }, (t) => {
  t.autoend()

  const originalHostname = os.hostname

  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent(DISABLE_ALL_DETECTIONS)
    agent.config.utilization = null
    os.hostname = () => {
      throw 'BROKEN'
    }
  })

  t.afterEach(() => {
    os.hostname = originalHostname
    helper.unloadAgent(agent)

    agent = null
  })

  t.test('should be set to what the user specifies (happy path)', (t) => {
    agent.config.process_host.display_name = 'test-value'
    facts(agent, function getFacts(factsed) {
      t.equal(factsed.display_host, 'test-value')
      t.end()
    })
  })

  t.test('should be cached along with hostname in config', (t) => {
    agent.config.process_host.display_name = 'test-value'
    facts(agent, function getFacts(factsed) {
      const displayHost1 = factsed.display_host
      const host1 = factsed.host

      os.hostname = originalHostname
      agent.config.process_host.display_name = 'test-value2'

      facts(agent, function getFacts2(factsed2) {
        t.same(factsed2.display_host, displayHost1)
        t.same(factsed2.host, host1)

        agent.config.clearHostnameCache()
        agent.config.clearDisplayHostCache()

        facts(agent, function getFacts3(factsed3) {
          t.same(factsed3.display_host, 'test-value2')
          t.same(factsed3.host, os.hostname())

          t.end()
        })
      })
    })
  })

  t.test('should be set as os.hostname() (if available) when not specified', (t) => {
    os.hostname = originalHostname
    facts(agent, function getFacts(factsed) {
      t.equal(factsed.display_host, os.hostname())
      t.end()
    })
  })

  t.test('should be ipv4 when ipv_preference === 4', (t) => {
    agent.config.process_host.ipv_preference = '4'

    facts(agent, function getFacts(factsed) {
      t.match(factsed.display_host, IP_V4_PATTERN)
      t.end()
    })
  })

  t.test('should be ipv6 when ipv_preference === 6', (t) => {
    if (!agent.config.getIPAddresses().ipv6) {
      /* eslint-disable no-console */
      console.log('this machine does not have an ipv6 address, skipping')
      /* eslint-enable no-console */
      return t.end()
    }
    agent.config.process_host.ipv_preference = '6'

    facts(agent, function getFacts(factsed) {
      t.match(factsed.display_host, IP_V6_PATTERN)
      t.end()
    })
  })

  t.test('should be ipv4 when invalid ipv_preference', (t) => {
    agent.config.process_host.ipv_preference = '9'

    facts(agent, function getFacts(factsed) {
      t.match(factsed.display_host, IP_V4_PATTERN)

      t.end()
    })
  })

  t.test('returns no ipv4, hostname should be ipv6 if possible', (t) => {
    if (!agent.config.getIPAddresses().ipv6) {
      /* eslint-disable no-console */
      console.log('this machine does not have an ipv6 address, skipping')
      /* eslint-enable no-console */
      return t.end()
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
    const originalNI = os.networkInterfaces
    os.networkInterfaces = createMock(mockedNI)

    facts(agent, function getFacts(factsed) {
      t.match(factsed.display_host, IP_V6_PATTERN)
      os.networkInterfaces = originalNI

      t.end()
    })
  })

  t.test('returns no ip addresses, hostname should be UNKNOWN_BOX (everything broke)', (t) => {
    const mockedNI = { lo: [], en0: [] }
    const originalNI = os.networkInterfaces
    os.networkInterfaces = createMock(mockedNI)

    facts(agent, function getFacts(factsed) {
      os.networkInterfaces = originalNI
      t.equal(factsed.display_host, 'UNKNOWN_BOX')
      t.end()
    })
  })
})

function createMock(output) {
  return function mock() {
    return output
  }
}

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
