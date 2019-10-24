'use strict'

const os = require('os')
const hostname = os.hostname
const networkInterfaces = os.networkInterfaces
const chai = require('chai')
const expect = chai.expect
const helper = require('../lib/agent_helper')
const facts = require('../../lib/collector/facts')
const sysInfo = require('../../lib/system-info')
const utilTests = require('../lib/cross_agent_tests/utilization/utilization_json')
const bootIdTests = require('../lib/cross_agent_tests/utilization/boot_id')


const EXPECTED = [
  'pid', 'host', 'language', 'app_name', 'labels', 'utilization',
  'agent_version', 'environment', 'settings', 'high_security', 'display_host',
  'identifier', 'metadata', 'event_harvest_config'
]

const _ip6_digits = '(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])'
const _ip6_nums = '(?:(?:' + _ip6_digits + '\.){3,3}' + _ip6_digits + ')'
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
  '::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:' + _ip6_nums + ')|' +
  '(?:[0-9a-fA-F]{1,4}:){1,4}:(?:' + _ip6_nums + '))'
)

const IP_V4_PATTERN = new RegExp(
  '(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}' +
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


describe('fun facts about apps that New Relic is interested in include', () => {
  let agent = null

  beforeEach(() => {
    agent = helper.loadMockedAgent(DISABLE_ALL_DETECTIONS)
  })

  afterEach(() => {
    helper.unloadAgent(agent)
    os.networkInterfaces = networkInterfaces
  })

  it("the current process ID as 'pid'", (done) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.pid).equal(process.pid)
      done()
    })
  })

  it("the current hostname as 'host' (hope it's not 'localhost' lol)", (done) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.host).equal(hostname())
      expect(factsed.host).not.equal('localhost')
      expect(factsed.host).not.equal('localhost.local')
      expect(factsed.host).not.equal('localhost.localdomain')
      done()
    })
  })

  it("the agent's language (as 'language') to be 'nodejs'", (done) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.language).equal('nodejs')
      done()
    })
  })

  it("an array of one or more application names as 'app_name' (sic)", (done) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.app_name).an('array')
      expect(factsed.app_name).length.above(0)
      done()
    })
  })

  it("the module's version as 'agent_version'", (done) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.agent_version).equal(agent.version)
      done()
    })
  })

  it('the environment (see environment.test.js) as crazy nested arrays', (done) => {
    facts(agent, function getFacts(factsed) {
      expect(factsed.environment).to.be.an('array')
      expect(factsed.environment).to.have.length.above(1)
      done()
    })
  })

  it("an 'identifier' for this agent", (done) => {
    facts(agent, function(factsed) {
      expect(factsed).to.have.property('identifier')
      const identifier = factsed.identifier
      expect(identifier).to.contain('nodejs')
      expect(identifier).to.contain(factsed.host)
      expect(identifier).to.contain(factsed.app_name.sort().join(','))
      done()
    })
  })

  it("'metadata' with NEW_RELIC_METADATA_-prefixed env vars", (done) => {
    process.env.NEW_RELIC_METADATA_STRING = 'hello'
    process.env.NEW_RELIC_METADATA_BOOL = true
    process.env.NEW_RELIC_METADATA_NUMBER = 42

    facts(agent, (data) => {
      expect(data).to.have.property('metadata')
      expect(data.metadata).to.have.property('NEW_RELIC_METADATA_STRING', 'hello')
      expect(data.metadata).to.have.property('NEW_RELIC_METADATA_BOOL', 'true')
      expect(data.metadata).to.have.property('NEW_RELIC_METADATA_NUMBER', '42')

      delete process.env.NEW_RELIC_METADATA_STRING
      delete process.env.NEW_RELIC_METADATA_BOOL
      delete process.env.NEW_RELIC_METADATA_NUMBER
      done()
    })
  })

  it("empty 'metadata' object if no metadata env vars found", (done) => {
    facts(agent, (data) => {
      expect(data).to.have.property('metadata')
      expect(data.metadata).to.deep.equal({})
      done()
    })
  })

  it('and nothing else', (done) => {
    facts(agent, function getFacts(factsed) {
      expect(Object.keys(factsed).sort()).eql(EXPECTED.sort())
      done()
    })
  })

  it('should convert label object to expected format', (done) => {
    const long_key = Array(257).join('€')
    const long_value = Array(257).join('𝌆')
    agent.config.labels = {}
    agent.config.labels.a = 'b'
    agent.config.labels[long_key] = long_value
    facts(agent, function getFacts(factsed) {
      const expected = [{label_type: 'a', label_value: 'b'}]
      expected.push({
        label_type: Array(256).join('€'),
        label_value: Array(256).join('𝌆')
      })

      expect(factsed.labels).deep.equal(expected)
      done()
    })
  })

  it('should convert label string to expected format', (done) => {
    const long_key = Array(257).join('€')
    const long_value = Array(257).join('𝌆')
    agent.config.labels = 'a: b; ' + long_key + ' : ' + long_value
    facts(agent, function getFacts(factsed) {
      const expected = [{label_type: 'a', label_value: 'b'}]
      expected.push({
        label_type: Array(256).join('€'),
        label_value: Array(256).join('𝌆')
      })

      expect(factsed.labels).deep.equal(expected)
      done()
    })
  })

  it('should add harvest_limits from local or default config', (done) => {
    const expectedValue = 10
    agent.config.transaction_events.max_samples_stored = expectedValue
    agent.config.custom_insights_events.max_samples_stored = expectedValue
    agent.config.error_collector.max_event_samples_stored = expectedValue

    const expectedHarvestConfig = {
      harvest_limits: {
        analytic_event_data: expectedValue,
        custom_event_data: expectedValue,
        error_event_data: expectedValue,
        span_event_data: 1000 // not configurable, set as constant
      }
    }

    facts(agent, (factsResult) => {
      expect(factsResult.event_harvest_config).deep.equal(expectedHarvestConfig)
      done()
    })
  })
})

describe('utilization', () => {
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


  beforeEach(() => {
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

  afterEach(() => {
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
    it(test.testname, (done) => {
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
        var testValue = test[key]

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
            mockProc = (cb) => cb({logical: testValue})
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

      var expected = test.expected_output_json
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
        done()
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
          type === 'aws' ? {
            instanceId: test.input_aws_id,
            instanceType: test.input_aws_type,
            availabilityZone: test.input_aws_zone
          } : type === 'azure' ? {
            location: test.input_azure_location,
            name: test.input_azure_name,
            vmId: test.input_azure_id,
            vmSize: test.input_azure_size
          } : type === 'gcp' ? {
            id: test.input_gcp_id,
            machineType: test.input_gcp_type,
            name: test.input_gcp_name,
            zone: test.input_gcp_zone
          } : null
        )
      )
    }
  }
})

describe('boot_id', () => {
  let agent = null
  const common = require('../../lib/utilization/common')

  let startingGetMemory = null
  let startingGetProcessor = null
  let startingDockerInfo = null
  let startingCommonReadProc = null
  let startingOsPlatform = null


  beforeEach(() => {
    startingGetMemory = sysInfo._getMemoryStats
    startingGetProcessor = sysInfo._getProcessorStats
    startingDockerInfo = sysInfo._getDockerContainerId
    startingCommonReadProc = common.readProc
    startingOsPlatform = os.platform

    os.platform = () => 'linux'
  })

  afterEach(() => {
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
    it(test.testname, (done) => {
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
            mockProc = (cb) => cb({logical: testValue})
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

      var expected = test.expected_output_json

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
        done()
      })
    })
  })

  function checkMetrics(expectedMetrics) {
    if (!expectedMetrics) {
      return
    }

    Object.keys(expectedMetrics).forEach((expectedMetric) => {
      var metric = agent.metrics.getOrCreateMetric(expectedMetric)
      expect(metric)
        .to.have.property('callCount', expectedMetrics[expectedMetric].call_count)
    })
  }
})

describe('display_host', function() {
  let agent = null
  const original_hostname = os.hostname

  this.timeout(10000) // Environment scans can take a long time.

  beforeEach(() => {
    agent = helper.loadMockedAgent(DISABLE_ALL_DETECTIONS)
    agent.config.utilization = null
    os.hostname = () => {
      throw ('BROKEN')
    }
  })

  afterEach(() => {
    os.hostname = original_hostname
    helper.unloadAgent(agent)
  })

  it('should be set to what the user specifies (happy path)', (done) => {
    agent.config.process_host.display_name = 'test-value'
    facts(agent, function getFacts(factsed) {
      expect(factsed.display_host).equal('test-value')
      done()
    })
  })

  it('should be cached along with hostname in config', (done) => {
    agent.config.process_host.display_name = 'test-value'
    facts(agent, function getFacts(factsed) {
      const displayHost1 = factsed.display_host
      const host1 = factsed.host

      os.hostname = original_hostname
      agent.config.process_host.display_name = 'test-value2'

      facts(agent, function getFacts2(factsed2) {
        expect(factsed2.display_host).deep.equal(displayHost1)
        expect(factsed2.host).deep.equal(host1)

        agent.config.clearHostnameCache()
        agent.config.clearDisplayHostCache()

        facts(agent, function getFacts3(factsed3) {
          expect(factsed3.display_host).deep.equal('test-value2')
          expect(factsed3.host).deep.equal(os.hostname())
          done()
        })
      })
    })
  })

  it('should be set as os.hostname() (if available) when not specified', (done) => {
    os.hostname = original_hostname
    facts(agent, function getFacts(factsed) {
      expect(factsed.display_host).equal(os.hostname())
      done()
    })
  })

  describe('when os.hostname() not available', () => {
    it('should be ipv4 when ipv_preference === 4', (done) => {
      agent.config.process_host.ipv_preference = '4'

      facts(agent, function getFacts(factsed) {
        expect(factsed.display_host).match(IP_V4_PATTERN)
        done()
      })
    })

    it('should be ipv6 when ipv_preference === 6', (done) => {
      if (!agent.config.getIPAddresses().ipv6) {
        /* eslint-disable no-console */
        console.log('this machine does not have an ipv6 address, skipping')
        /* eslint-enable no-console */
        return done()
      }
      agent.config.process_host.ipv_preference = '6'

      facts(agent, function getFacts(factsed) {
        expect(factsed.display_host).match(IP_V6_PATTERN)
        done()
      })
    })

    it('should be ipv4 when invalid ipv_preference', function badIpPref(done) {
      agent.config.process_host.ipv_preference = '9'

      facts(agent, function getFacts(factsed) {
        expect(factsed.display_host).match(IP_V4_PATTERN)
        done()
      })
    })
  })

  describe('When os.networkInterfaces()', function netInterface() {
    it('returns no ipv4, hostname should be ipv6 if possible',
      function noip4(done) {
        if (!agent.config.getIPAddresses().ipv6) {
          /* eslint-disable no-console */
          console.log('this machine does not have an ipv6 address, skipping')
          /* eslint-enable no-console */
          return done()
        }
        const mockedNI = {
          lo: [],
          en0: [{
            address: 'fe80::a00:27ff:fe4e:66a1',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: '01:02:03:0a:0b:0c',
            internal: false
          }]
        }
        const original_NI = os.networkInterfaces
        os.networkInterfaces = createMock(mockedNI)

        facts(agent, function getFacts(factsed) {
          expect(factsed.display_host).match(IP_V6_PATTERN)
          os.networkInterfaces = original_NI
          done()
        })
      })
    it("returns no ip addresses, hostname should be 'UNKNOWN_BOX' (everything broke)",
      function broken(done) {
        const mockedNI = {lo: [], en0: []}
        const original_NI = os.networkInterfaces
        os.networkInterfaces = createMock(mockedNI)

        facts(agent, function getFacts(factsed) {
          os.networkInterfaces = original_NI
          expect(factsed.display_host).equal('UNKNOWN_BOX')
          done()
        })
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
        interfaces.push({address})
        return interfaces
      }, [])
    }
  }
}
