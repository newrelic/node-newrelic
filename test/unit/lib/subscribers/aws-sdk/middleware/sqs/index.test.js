/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sqsMiddleware = require('#agentlib/subscribers/aws-sdk/middleware/sqs/index.js')

const { attachHeaders, retrieveHeaders } = sqsMiddleware.internal

test('attachHeaders function', async (t) => {
  await t.test('should not modify message when no headers provided', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {}

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      0,
      'should have no message attributes'
    )
    end()
  })

  await t.test('should add headers in priority order when message has no existing attributes', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      newrelic: 'newrelic-value',
      traceparent: 'traceparent-value',
      tracestate: 'tracestate-value'
    }

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      3,
      'should have 3 message attributes'
    )
    assert.strictEqual(
      message.MessageAttributes.traceparent.DataType,
      'String',
      'traceparent should have correct DataType'
    )
    assert.strictEqual(
      message.MessageAttributes.traceparent.StringValue,
      'traceparent-value',
      'traceparent should have correct value'
    )
    assert.strictEqual(
      message.MessageAttributes.tracestate.StringValue,
      'tracestate-value',
      'tracestate should have correct value'
    )
    assert.strictEqual(
      message.MessageAttributes.newrelic.StringValue,
      'newrelic-value',
      'newrelic should have correct value'
    )
    end()
  })

  await t.test('should add only traceparent when only traceparent provided', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      traceparent: 'traceparent-value'
    }

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      1,
      'should have 1 message attribute'
    )
    assert.strictEqual(
      message.MessageAttributes.traceparent.StringValue,
      'traceparent-value'
    )
    end()
  })

  await t.test('should add only tracestate when only tracestate provided', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      tracestate: 'tracestate-value'
    }

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      1,
      'should have 1 message attribute'
    )
    assert.strictEqual(
      message.MessageAttributes.tracestate.StringValue,
      'tracestate-value'
    )
    end()
  })

  await t.test('should add only newrelic when only newrelic provided', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      newrelic: 'newrelic-value'
    }

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      1,
      'should have 1 message attribute'
    )
    assert.strictEqual(
      message.MessageAttributes.newrelic.StringValue,
      'newrelic-value'
    )
    end()
  })

  await t.test('should add all priority headers when no existing attributes (availSlots=10)', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    // The function only processes priority headers (traceparent, tracestate, newrelic)
    // Non-priority headers are ignored
    const headers = {
      traceparent: 'tp',
      tracestate: 'ts',
      newrelic: 'nr',
      h4: 'v4',
      h5: 'v5',
      h6: 'v6',
      h7: 'v7',
      h8: 'v8',
      h9: 'v9',
      h10: 'v10'
    }

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      3,
      'should add all 3 priority headers'
    )
    assert.ok(message.MessageAttributes.traceparent)
    assert.ok(message.MessageAttributes.tracestate)
    assert.ok(message.MessageAttributes.newrelic)
    end()
  })

  await t.test('should not modify message when empty headers object provided with existing attributes', (t, end) => {
    const message = {
      MessageAttributes: {
        existing1: { DataType: 'String', StringValue: 'value1' }
      }
    }
    const headers = {}

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      1,
      'should still have 1 message attribute'
    )
    assert.strictEqual(
      message.MessageAttributes.existing1.StringValue,
      'value1',
      'existing attribute should not be modified'
    )
    end()
  })

  await t.test('should add all priority headers when 3 existing attributes (availSlots=7)', (t, end) => {
    const message = {
      MessageAttributes: {
        existing1: { DataType: 'String', StringValue: 'value1' },
        existing2: { DataType: 'String', StringValue: 'value2' },
        existing3: { DataType: 'String', StringValue: 'value3' }
      }
    }
    const headers = {
      traceparent: 'tp-value',
      tracestate: 'ts-value',
      newrelic: 'nr-value',
      other1: 'other1-value',
      other2: 'other2-value'
    }

    attachHeaders({ message, headers })

    // With 3 existing, availSlots = 10 - 3 = 7 (>= 3)
    // Should add all 3 priority headers
    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      6,
      'should have 3 existing + 3 priority headers'
    )
    assert.ok(message.MessageAttributes.traceparent, 'traceparent should be added')
    assert.ok(message.MessageAttributes.tracestate, 'tracestate should be added')
    assert.ok(message.MessageAttributes.newrelic, 'newrelic should be added')
    assert.strictEqual(message.MessageAttributes.other1, undefined, 'non-priority header should not be added')
    end()
  })

  await t.test('boundary: 10 existing attributes (availSlots=0) - adds 0 headers', (t, end) => {
    const message = {
      MessageAttributes: {
        e1: { DataType: 'String', StringValue: 'v1' },
        e2: { DataType: 'String', StringValue: 'v2' },
        e3: { DataType: 'String', StringValue: 'v3' },
        e4: { DataType: 'String', StringValue: 'v4' },
        e5: { DataType: 'String', StringValue: 'v5' },
        e6: { DataType: 'String', StringValue: 'v6' },
        e7: { DataType: 'String', StringValue: 'v7' },
        e8: { DataType: 'String', StringValue: 'v8' },
        e9: { DataType: 'String', StringValue: 'v9' },
        e10: { DataType: 'String', StringValue: 'v10' }
      }
    }
    const headers = {
      traceparent: 'tp',
      tracestate: 'ts',
      newrelic: 'nr'
    }

    attachHeaders({ message, headers })

    // availSlots = 0, i=1 > 0, breaks immediately
    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      10,
      'should not add any headers when availSlots = 0'
    )
    end()
  })

  await t.test('boundary: 9 existing attributes (availSlots=1) - adds 1 header', (t, end) => {
    const message = {
      MessageAttributes: {
        e1: { DataType: 'String', StringValue: 'v1' },
        e2: { DataType: 'String', StringValue: 'v2' },
        e3: { DataType: 'String', StringValue: 'v3' },
        e4: { DataType: 'String', StringValue: 'v4' },
        e5: { DataType: 'String', StringValue: 'v5' },
        e6: { DataType: 'String', StringValue: 'v6' },
        e7: { DataType: 'String', StringValue: 'v7' },
        e8: { DataType: 'String', StringValue: 'v8' },
        e9: { DataType: 'String', StringValue: 'v9' }
      }
    }
    const headers = {
      traceparent: 'tp',
      tracestate: 'ts',
      newrelic: 'nr'
    }

    attachHeaders({ message, headers })

    // availSlots = 1, i=1 not > 1 (add traceparent, i=2), i=2 > 1 (break)
    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      10,
      'should add 1 header (traceparent only)'
    )
    assert.ok(message.MessageAttributes.traceparent, 'traceparent should be added')
    assert.strictEqual(message.MessageAttributes.tracestate, undefined, 'tracestate should not be added')
    assert.strictEqual(message.MessageAttributes.newrelic, undefined, 'newrelic should not be added')
    end()
  })

  await t.test('boundary: 8 existing attributes (availSlots=2) - adds 2 headers', (t, end) => {
    const message = {
      MessageAttributes: {
        e1: { DataType: 'String', StringValue: 'v1' },
        e2: { DataType: 'String', StringValue: 'v2' },
        e3: { DataType: 'String', StringValue: 'v3' },
        e4: { DataType: 'String', StringValue: 'v4' },
        e5: { DataType: 'String', StringValue: 'v5' },
        e6: { DataType: 'String', StringValue: 'v6' },
        e7: { DataType: 'String', StringValue: 'v7' },
        e8: { DataType: 'String', StringValue: 'v8' }
      }
    }
    const headers = {
      traceparent: 'tp',
      tracestate: 'ts',
      newrelic: 'nr'
    }

    attachHeaders({ message, headers })

    // availSlots = 2, i=1 not > 2 (add traceparent, i=2), i=2 not > 2 (add tracestate, i=3), i=3 > 2 (break)
    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      10,
      'should add 2 headers (traceparent and tracestate)'
    )
    assert.ok(message.MessageAttributes.traceparent, 'traceparent should be added')
    assert.ok(message.MessageAttributes.tracestate, 'tracestate should be added')
    assert.strictEqual(message.MessageAttributes.newrelic, undefined, 'newrelic should not be added')
    end()
  })

  await t.test('boundary: 7 existing attributes (availSlots=3) - adds 3 headers', (t, end) => {
    const message = {
      MessageAttributes: {
        e1: { DataType: 'String', StringValue: 'v1' },
        e2: { DataType: 'String', StringValue: 'v2' },
        e3: { DataType: 'String', StringValue: 'v3' },
        e4: { DataType: 'String', StringValue: 'v4' },
        e5: { DataType: 'String', StringValue: 'v5' },
        e6: { DataType: 'String', StringValue: 'v6' },
        e7: { DataType: 'String', StringValue: 'v7' }
      }
    }
    const headers = {
      traceparent: 'tp',
      tracestate: 'ts',
      newrelic: 'nr'
    }

    attachHeaders({ message, headers })

    // availSlots = 3, can add all 3 priority headers
    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      10,
      'should add all 3 priority headers'
    )
    assert.ok(message.MessageAttributes.traceparent)
    assert.ok(message.MessageAttributes.tracestate)
    assert.ok(message.MessageAttributes.newrelic)
    end()
  })

  await t.test('should ignore non-priority headers regardless of count', (t, end) => {
    const message = {
      MessageAttributes: {
        e1: { DataType: 'String', StringValue: 'v1' }
      }
    }
    const headers = {
      h1: 'v1',
      h2: 'v2',
      h3: 'v3',
      h4: 'v4',
      h5: 'v5',
      h6: 'v6',
      h7: 'v7',
      h8: 'v8',
      h9: 'v9'
    }

    attachHeaders({ message, headers })

    // Non-priority headers are ignored, so nothing is added
    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      1,
      'should not add any non-priority headers'
    )
    end()
  })

  await t.test('should add all priority headers when space is available', (t, end) => {
    const message = {
      MessageAttributes: {
        e1: { DataType: 'String', StringValue: 'v1' }
      }
    }
    const headers = {
      traceparent: 'tp-value',
      tracestate: 'ts-value',
      newrelic: 'nr-value'
    }

    attachHeaders({ message, headers })

    // With 1 existing, availSlots = 10 - 1 = 9 (>= 3)
    // Should add all 3 priority headers
    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      4,
      'should have 1 existing + 3 priority headers'
    )
    assert.ok(message.MessageAttributes.traceparent)
    assert.ok(message.MessageAttributes.tracestate)
    assert.ok(message.MessageAttributes.newrelic)
    end()
  })

  await t.test('should preserve existing attributes and not overwrite them', (t, end) => {
    const message = {
      MessageAttributes: {
        existing: { DataType: 'Number', StringValue: '123' }
      }
    }
    const headers = {
      traceparent: 'tp-value'
    }

    attachHeaders({ message, headers })

    assert.strictEqual(
      message.MessageAttributes.existing.DataType,
      'Number',
      'existing attribute DataType should not change'
    )
    assert.strictEqual(
      message.MessageAttributes.existing.StringValue,
      '123',
      'existing attribute value should not change'
    )
    assert.strictEqual(
      message.MessageAttributes.traceparent.DataType,
      'String',
      'new header should have String DataType'
    )
    end()
  })

  await t.test('should handle empty string header values', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      traceparent: ''
    }

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      1,
      'should add header with empty string value'
    )
    assert.strictEqual(
      message.MessageAttributes.traceparent.StringValue,
      '',
      'should preserve empty string value'
    )
    end()
  })

  await t.test('should ignore non-priority headers even with 10 in headers object', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      h1: 'v1',
      h2: 'v2',
      h3: 'v3',
      h4: 'v4',
      h5: 'v5',
      h6: 'v6',
      h7: 'v7',
      h8: 'v8',
      h9: 'v9',
      h10: 'v10'
    }

    attachHeaders({ message, headers })

    // Only priority headers are processed, so nothing is added
    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      0,
      'should not add any non-priority headers'
    )
    end()
  })

  await t.test('should add all 3 priority headers when no existing attributes', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      traceparent: 'tp',
      tracestate: 'ts',
      newrelic: 'nr'
    }

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      3,
      'should add all 3 priority headers'
    )
    end()
  })

  await t.test('should ignore non-priority headers mixed with priority headers', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      traceparent: 'tp',
      otherHeader: 'should-not-be-added',
      anotherHeader: 'also-ignored'
    }

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      1,
      'should only add priority headers'
    )
    assert.ok(message.MessageAttributes.traceparent, 'traceparent should be added')
    assert.strictEqual(message.MessageAttributes.otherHeader, undefined, 'non-priority header should not be added')
    assert.strictEqual(message.MessageAttributes.anotherHeader, undefined, 'non-priority header should not be added')
    end()
  })

  await t.test('should skip priority headers not present in headers object', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      traceparent: 'tp-value'
      // tracestate and newrelic not provided
    }

    attachHeaders({ message, headers })

    assert.strictEqual(
      Object.keys(message.MessageAttributes).length,
      1,
      'should only add headers that exist in headers object'
    )
    assert.ok(message.MessageAttributes.traceparent, 'traceparent should be added')
    assert.strictEqual(message.MessageAttributes.tracestate, undefined, 'tracestate should not be added')
    assert.strictEqual(message.MessageAttributes.newrelic, undefined, 'newrelic should not be added')
    end()
  })

  await t.test('should handle undefined header values', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      traceparent: 'tp-value',
      tracestate: undefined,
      newrelic: 'nr-value'
    }

    attachHeaders({ message, headers })

    // Should add headers even with undefined values because Object.hasOwn returns true
    assert.ok(message.MessageAttributes.traceparent)
    assert.ok(message.MessageAttributes.tracestate, 'tracestate with undefined value should be added')
    assert.strictEqual(message.MessageAttributes.tracestate.StringValue, undefined)
    assert.ok(message.MessageAttributes.newrelic)
    end()
  })

  await t.test('should handle null header values', (t, end) => {
    const message = {
      MessageAttributes: {}
    }
    const headers = {
      traceparent: null
    }

    attachHeaders({ message, headers })

    assert.ok(message.MessageAttributes.traceparent, 'traceparent with null value should be added')
    assert.strictEqual(message.MessageAttributes.traceparent.StringValue, null)
    end()
  })
})

test('retrieveHeaders function', async (t) => {
  await t.test('should return empty object when message has no MessageAttributes', (t, end) => {
    const message = {}

    const headers = retrieveHeaders({ message })

    assert.deepEqual(headers, {}, 'should return empty object')
    assert.strictEqual(Object.keys(headers).length, 0)
    end()
  })

  await t.test('should return empty object when MessageAttributes is empty', (t, end) => {
    const message = {
      MessageAttributes: {}
    }

    const headers = retrieveHeaders({ message })

    assert.deepEqual(headers, {}, 'should return empty object')
    assert.strictEqual(Object.keys(headers).length, 0)
    end()
  })

  await t.test('should retrieve traceparent header', (t, end) => {
    const message = {
      MessageAttributes: {
        traceparent: {
          DataType: 'String',
          StringValue: 'traceparent-value'
        }
      }
    }

    const headers = retrieveHeaders({ message })

    assert.strictEqual(Object.keys(headers).length, 1)
    assert.strictEqual(headers.traceparent, 'traceparent-value')
    end()
  })

  await t.test('should retrieve tracestate header', (t, end) => {
    const message = {
      MessageAttributes: {
        tracestate: {
          DataType: 'String',
          StringValue: 'tracestate-value'
        }
      }
    }

    const headers = retrieveHeaders({ message })

    assert.strictEqual(Object.keys(headers).length, 1)
    assert.strictEqual(headers.tracestate, 'tracestate-value')
    end()
  })

  await t.test('should retrieve newrelic header', (t, end) => {
    const message = {
      MessageAttributes: {
        newrelic: {
          DataType: 'String',
          StringValue: 'newrelic-value'
        }
      }
    }

    const headers = retrieveHeaders({ message })

    assert.strictEqual(Object.keys(headers).length, 1)
    assert.strictEqual(headers.newrelic, 'newrelic-value')
    end()
  })

  await t.test('should retrieve all DT headers when present', (t, end) => {
    const message = {
      MessageAttributes: {
        traceparent: {
          DataType: 'String',
          StringValue: 'tp-value'
        },
        tracestate: {
          DataType: 'String',
          StringValue: 'ts-value'
        },
        newrelic: {
          DataType: 'String',
          StringValue: 'nr-value'
        }
      }
    }

    const headers = retrieveHeaders({ message })

    assert.strictEqual(Object.keys(headers).length, 3)
    assert.strictEqual(headers.traceparent, 'tp-value')
    assert.strictEqual(headers.tracestate, 'ts-value')
    assert.strictEqual(headers.newrelic, 'nr-value')
    end()
  })

  await t.test('should only retrieve DT headers and ignore other attributes', (t, end) => {
    const message = {
      MessageAttributes: {
        traceparent: {
          DataType: 'String',
          StringValue: 'tp-value'
        },
        customAttribute: {
          DataType: 'String',
          StringValue: 'custom-value'
        },
        anotherAttribute: {
          DataType: 'Number',
          StringValue: '123'
        }
      }
    }

    const headers = retrieveHeaders({ message })

    assert.strictEqual(Object.keys(headers).length, 1)
    assert.strictEqual(headers.traceparent, 'tp-value')
    assert.strictEqual(headers.customAttribute, undefined)
    assert.strictEqual(headers.anotherAttribute, undefined)
    end()
  })

  await t.test('should retrieve subset of DT headers when only some present', (t, end) => {
    const message = {
      MessageAttributes: {
        traceparent: {
          DataType: 'String',
          StringValue: 'tp-value'
        },
        newrelic: {
          DataType: 'String',
          StringValue: 'nr-value'
        }
        // tracestate not present
      }
    }

    const headers = retrieveHeaders({ message })

    assert.strictEqual(Object.keys(headers).length, 2)
    assert.strictEqual(headers.traceparent, 'tp-value')
    assert.strictEqual(headers.newrelic, 'nr-value')
    assert.strictEqual(headers.tracestate, undefined)
    end()
  })

  await t.test('should return empty object when only non-DT headers present', (t, end) => {
    const message = {
      MessageAttributes: {
        customAttribute1: {
          DataType: 'String',
          StringValue: 'value1'
        },
        customAttribute2: {
          DataType: 'String',
          StringValue: 'value2'
        }
      }
    }

    const headers = retrieveHeaders({ message })

    assert.deepEqual(headers, {})
    assert.strictEqual(Object.keys(headers).length, 0)
    end()
  })

  await t.test('should handle message with MessageAttributes set to null', (t, end) => {
    const message = {
      MessageAttributes: null
    }

    const headers = retrieveHeaders({ message })

    assert.deepEqual(headers, {})
    assert.strictEqual(Object.keys(headers).length, 0)
    end()
  })

  await t.test('should handle message with MessageAttributes set to undefined', (t, end) => {
    const message = {
      MessageAttributes: undefined
    }

    const headers = retrieveHeaders({ message })

    assert.deepEqual(headers, {})
    assert.strictEqual(Object.keys(headers).length, 0)
    end()
  })
})
