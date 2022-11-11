/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const os = require('os')
const systemInfo = require('../../lib/system-info')

tap.test('systemInfo edge cases', (t) => {
  t.autoend()

  async function callSystemInfo(config) {
    const agentMock = {
      config: {
        utilization: config
      }
    }
    return new Promise((resolve) => {
      systemInfo(
        agentMock,
        (err, result) => {
          resolve(result)
        },
        1
      )
      systemInfo._getProcessorStats(() => {})
    })
  }

  t.test(
    'should set logical_processors, total_ram_mib, and hostname if in configuration',
    async (t) => {
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
      t.same(config, { processorArch: os.arch(), config: parsedConfig })
    }
  )

  t.test(
    'should not try to set system info config if it does not exist in configuration',
    async (t) => {
      const config = await callSystemInfo(null)
      t.same(config, { processorArch: os.arch() })
    }
  )

  t.test('should log error if utilization.logical_processor is a NaN', async (t) => {
    const mockConfig = { logical_processors: 'bogus' }
    const config = await callSystemInfo(mockConfig)
    t.same(config, { processorArch: os.arch() })
  })

  t.test('should log error if utilization.total_ram_mib is a NaN', async (t) => {
    const mockConfig = { total_ram_mib: 'bogus' }
    const config = await callSystemInfo(mockConfig)
    t.same(config, { processorArch: os.arch() })
  })
})
