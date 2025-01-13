/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const os = require('os')
const proxyquire = require('proxyquire').noPreserveCache()
const sinon = require('sinon')

test('getProcessorStats - darwin', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const platformFunction = sinon.stub().returns('darwin')
    const execFunction = sinon.stub()
    ctx.nr.systemInfo = proxyquire('../../lib/system-info', {
      os: {
        platform: platformFunction
      },
      child_process: {
        execFile: execFunction
      }
    })
    ctx.nr.execFunction = execFunction
  })

  await t.test('should return default data when all lookups error', async (t) => {
    const { execFunction, systemInfo } = t.nr
    execFunction.yields(new Error('whoops'), { stderr: null, stdout: null })

    const results = await systemInfo._getProcessorStats()
    const expected = {
      logical: null,
      cores: null,
      packages: null
    }
    assert.deepEqual(results, expected, 'should return the expected results')
  })

  await t.test('should return default data when all lookups return no data', async (t) => {
    const { execFunction, systemInfo } = t.nr
    execFunction.yields(null, { stderr: null, stdout: null })

    const results = await systemInfo._getProcessorStats()
    const expected = {
      logical: null,
      cores: null,
      packages: null
    }
    assert.deepEqual(results, expected, 'should return the expected results')
  })

  await t.test('should return default data when all lookups return errors', async (t) => {
    const { execFunction, systemInfo } = t.nr
    execFunction.yields(null, { stderr: new Error('oops'), stdout: null })

    const results = await systemInfo._getProcessorStats()
    const expected = {
      logical: null,
      cores: null,
      packages: null
    }
    assert.deepEqual(results, expected, 'should return the expected results')
  })

  await t.test('should return default data when all lookups return unexpected data', async (t) => {
    const { execFunction, systemInfo } = t.nr
    execFunction.yields(null, { stderr: null, stdout: 'foo' })

    const results = await systemInfo._getProcessorStats()
    const expected = {
      logical: null,
      cores: null,
      packages: null
    }
    assert.deepEqual(results, expected, 'should return the expected results')
  })

  await t.test('should return data when all lookups succeed', async (t) => {
    const { execFunction, systemInfo } = t.nr
    execFunction.yields(null, { stderr: null, stdout: 123 })

    const results = await systemInfo._getProcessorStats()
    const expected = {
      logical: 123,
      cores: 123,
      packages: 123
    }
    assert.deepEqual(results, expected, 'should return the expected results')
  })

  await t.test('should return data when all lookups eventually succeed', async (t) => {
    const { execFunction, systemInfo } = t.nr
    execFunction
      .onCall(0)
      .yields(null, { stderr: null, stdout: 789 })
      .onCall(1)
      .yields(null, { stderr: null, stdout: null })
      .onCall(2)
      .yields(null, { stderr: null, stdout: 456 })
      .onCall(3)
      .yields(null, { stderr: null, stdout: null })
      .onCall(4)
      .yields(null, { stderr: null, stdout: null })
      .onCall(5)
      .yields(null, { stderr: null, stdout: 123 })

    const results = await systemInfo._getProcessorStats()
    const expected = {
      logical: 123,
      cores: 456,
      packages: 789
    }
    assert.deepEqual(results, expected, 'should return the expected results')
  })
})

test('getProcessorStats - bsd', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const platformFunction = sinon.stub().returns('bsd')
    const execFunction = sinon.stub()

    ctx.nr.systemInfo = proxyquire('../../lib/system-info', {
      os: {
        platform: platformFunction
      },
      child_process: {
        execFile: execFunction
      }
    })
    ctx.nr.execFunction = execFunction
  })

  await t.test('should return data', async (t) => {
    const { execFunction, systemInfo } = t.nr
    execFunction.yields(null, { stderr: null, stdout: 123 })

    const results = await systemInfo._getProcessorStats()
    const expected = {
      logical: 123,
      cores: null,
      packages: null
    }
    assert.deepEqual(results, expected, 'should return the expected results')
  })
})

test('getProcessorStats - linux', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const platformFunction = sinon.stub().returns('linux')
    const readProcFunction = sinon.stub()

    ctx.nr.systemInfo = proxyquire('../../lib/system-info', {
      './utilization/common': {
        readProc: readProcFunction
      },
      os: {
        platform: platformFunction
      }
    })
    ctx.nr.readProcFunction = readProcFunction
  })

  await t.test('should return data', async (t) => {
    const { readProcFunction, systemInfo } = t.nr
    const exampleProcfile = `processor       : 0
    vendor_id       : GenuineIntel
    cpu family      : 6
    model           : 45
    model name      : Intel(R) Xeon(R) CPU E5-2660 0 @ 2.20GHz
    stepping        : 6
    microcode       : 1561
    cpu MHz         : 600.000
    cache size      : 20480 KB
    physical id     : 0
    siblings        : 16
    core id         : 0
    cpu cores       : 8
    apicid          : 0
    initial apicid  : 0
    fpu             : yes
    fpu_exception   : yes
    cpuid level     : 13
    wp              : yes
    flags           : fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush dts acpi mmx fxsr sse sse2 ss ht tm pbe syscall nx pdpe1gb rdtscp lm constant_tsc arch_perfmon pebs bts rep_good xtopology nonstop_tsc aperfmperf pni pclmulqdq dtes64 monitor ds_cpl vmx smx est tm2 ssse3 cx16 xtpr pdcm pcid dca sse4_1 sse4_2 x2apic popcnt tsc_deadline_timer aes xsave avx lahf_lm ida arat epb pln pts dtherm tpr_shadow vnmi flexpriority ept vpid xsaveopt
    bogomips        : 4399.93
    clflush size    : 64
    cache_alignment : 64
    address sizes   : 46 bits physical, 48 bits virtual
    power management:`

    readProcFunction.yields(null, exampleProcfile)

    const results = await systemInfo._getProcessorStats()
    const expected = {
      logical: 1,
      cores: 8,
      packages: 1
    }
    assert.deepEqual(results, expected, 'should return the expected results')
  })

  await t.test('should return null if readProc fails', async (t) => {
    const { readProcFunction, systemInfo } = t.nr
    readProcFunction.yields(new Error('oops'))

    const results = await systemInfo._getProcessorStats()
    const expected = {
      logical: null,
      cores: null,
      packages: null
    }
    assert.deepEqual(results, expected, 'should return the expected results')
  })
})

test('getProcessorStats - unknown', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const platformFunction = sinon.stub().returns('something weird')

    ctx.nr.systemInfo = proxyquire('../../lib/system-info', {
      os: {
        platform: platformFunction
      }
    })
  })

  await t.test('should return default data', async (t) => {
    const { systemInfo } = t.nr
    const results = await systemInfo._getProcessorStats()
    const expected = {
      logical: null,
      cores: null,
      packages: null
    }
    assert.deepEqual(results, expected, 'should return the expected results')
  })
})

test('getMemoryStats - darwin', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const platformFunction = sinon.stub().returns('darwin')
    const execFunction = sinon.stub()

    ctx.nr.systemInfo = proxyquire('../../lib/system-info', {
      os: {
        platform: platformFunction
      },
      child_process: {
        execFile: execFunction
      }
    })
    ctx.nr.execFunction = execFunction
  })

  await t.test('should return data', async (t) => {
    const { execFunction, systemInfo } = t.nr
    execFunction.yields(null, { stderr: null, stdout: 1024 * 1024 })
    const results = await systemInfo._getMemoryStats()
    assert.equal(results, 1)
  })
})

test('getMemoryStats - bsd', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const platformFunction = sinon.stub().returns('bsd')
    const execFunction = sinon.stub()

    ctx.nr.systemInfo = proxyquire('../../lib/system-info', {
      os: {
        platform: platformFunction
      },
      child_process: {
        execFile: execFunction
      }
    })
    ctx.nr.execFunction = execFunction
  })

  await t.test('should return data', async (t) => {
    const { execFunction, systemInfo } = t.nr
    execFunction.yields(null, { stderr: null, stdout: 1024 * 1024 })
    const results = await systemInfo._getMemoryStats()
    assert.equal(results, 1)
  })
})

test('getMemoryStats - linux', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const platformFunction = sinon.stub().returns('linux')
    const readProcFunction = sinon.stub()

    ctx.nr.systemInfo = proxyquire('../../lib/system-info', {
      './utilization/common': {
        readProc: readProcFunction
      },
      os: {
        platform: platformFunction
      }
    })
    ctx.nr.readProcFunction = readProcFunction
  })

  await t.test('should return data', async (t) => {
    const { readProcFunction, systemInfo } = t.nr
    const exampleProcfile = `MemTotal:        1882064 kB
    MemFree:         1376380 kB
    MemAvailable:    1535676 kB
    Buffers:            2088 kB
    Cached:           292324 kB
    SwapCached:            0 kB
    Active:           152944 kB
    Inactive:         252628 kB
    Active(anon):     111328 kB
    Inactive(anon):    16508 kB
    Active(file):      41616 kB
    Inactive(file):   236120 kB
    Unevictable:           0 kB
    Mlocked:               0 kB
    SwapTotal:       2097148 kB
    SwapFree:        2097148 kB
    Dirty:                40 kB
    Writeback:             0 kB
    AnonPages:        111180 kB
    Mapped:            56396 kB
    Shmem:             16676 kB
    Slab:              54508 kB
    SReclaimable:      25456 kB
    SUnreclaim:        29052 kB
    KernelStack:        2608 kB
    PageTables:         5056 kB
    NFS_Unstable:          0 kB
    Bounce:                0 kB
    WritebackTmp:          0 kB
    CommitLimit:     3038180 kB
    Committed_AS:     577664 kB
    VmallocTotal:   34359738367 kB
    VmallocUsed:       14664 kB
    VmallocChunk:   34359717628 kB
    HardwareCorrupted:     0 kB
    AnonHugePages:     24576 kB
    HugePages_Total:       0
    HugePages_Free:        0
    HugePages_Rsvd:        0
    HugePages_Surp:        0
    Hugepagesize:       2048 kB
    DirectMap4k:       69632 kB
    DirectMap2M:     2027520 kB`
    readProcFunction.yields(null, exampleProcfile)

    const results = await systemInfo._getMemoryStats()
    assert.equal(results, 1837.953125)
  })

  await t.test('should return null if readProc fails', async (t) => {
    const { readProcFunction, systemInfo } = t.nr
    readProcFunction.yields(new Error('oops'))

    const results = await systemInfo._getMemoryStats()
    assert.equal(results, null)
  })
})

test('getProcessorStats - unknown', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const platformFunction = sinon.stub().returns('something weird')

    ctx.nr.systemInfo = proxyquire('../../lib/system-info', {
      os: {
        platform: platformFunction
      }
    })
  })

  await t.test('should return default data', async (t) => {
    const { systemInfo } = t.nr
    const results = await systemInfo._getMemoryStats()
    assert.equal(results, null)
  })
})

test('systemInfo edge cases', async (t) => {
  const systemInfo = proxyquire('../../lib/system-info', {
    './utilization/docker-info': {
      getBootId: (agent, callback) => callback(null)
    },
    os: {
      platform: () => 'something weird'
    }
  })

  async function callSystemInfo(config) {
    const agentMock = {
      config: {
        utilization: config
      }
    }

    return new Promise((resolve) => {
      systemInfo._getProcessorStats = () => {}
      systemInfo(agentMock, (_, result) => {
        resolve(result)
      })
    })
  }

  await t.test(
    'should set logical_processors, total_ram_mib, and hostname if in configuration',
    async () => {
      const mockConfig = {
        logical_processors: '2',
        total_ram_mib: '2048',
        billing_hostname: 'bob_test'
      }
      const parsedConfig = {
        logical_processors: 2,
        total_ram_mib: 2048,
        hostname: 'bob_test'
      }
      const config = await callSystemInfo(mockConfig)
      assert.deepEqual(config, { processorArch: os.arch(), config: parsedConfig })
    }
  )

  await t.test(
    'should not try to set system info config if it does not exist in configuration',
    async () => {
      const config = await callSystemInfo(null)
      assert.deepEqual(config, { processorArch: os.arch() })
    }
  )

  await t.test('should log error if utilization.logical_processor is a NaN', async () => {
    const mockConfig = { logical_processors: 'bogus' }
    const config = await callSystemInfo(mockConfig)
    assert.deepEqual(config, { processorArch: os.arch() })
  })

  await t.test('should log error if utilization.total_ram_mib is a NaN', async () => {
    const mockConfig = { total_ram_mib: 'bogus' }
    const config = await callSystemInfo(mockConfig)
    assert.deepEqual(config, { processorArch: os.arch() })
  })
})
