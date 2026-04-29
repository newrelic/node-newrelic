/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const attachHeaders = require('#agentlib/subscribers/aws-sdk/utils/attach-headers.js')

test('should not modify message when no headers provided', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({})
  const context = {}

  attachHeaders({ message, context, subscriber })

  assert.strictEqual(
    Object.keys(message.MessageAttributes).length,
    0,
    'should have no message attributes'
  )
  end()
})

test('should add headers in priority order when message has no existing attributes', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
    newrelic: 'newrelic-value',
    traceparent: 'traceparent-value',
    tracestate: 'tracestate-value'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should add only traceparent when only traceparent provided', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
    traceparent: 'traceparent-value'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should add only tracestate when only tracestate provided', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
    tracestate: 'tracestate-value'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should add only newrelic when only newrelic provided', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
    newrelic: 'newrelic-value'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should add all priority headers when no existing attributes (availSlots=10)', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  // The function only processes priority headers (traceparent, tracestate, newrelic)
  // Non-priority headers are ignored
  const subscriber = createMockSubscriber({
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
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should not modify message when empty headers object provided with existing attributes', (t, end) => {
  const message = {
    MessageAttributes: {
      existing1: { DataType: 'String', StringValue: 'value1' }
    }
  }
  const subscriber = createMockSubscriber({})
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should add all priority headers when 3 existing attributes (availSlots=7)', (t, end) => {
  const message = {
    MessageAttributes: {
      existing1: { DataType: 'String', StringValue: 'value1' },
      existing2: { DataType: 'String', StringValue: 'value2' },
      existing3: { DataType: 'String', StringValue: 'value3' }
    }
  }
  const subscriber = createMockSubscriber({
    traceparent: 'tp-value',
    tracestate: 'ts-value',
    newrelic: 'nr-value',
    other1: 'other1-value',
    other2: 'other2-value'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('boundary: 10 existing attributes (availSlots=0) - adds 0 headers', (t, end) => {
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
  const subscriber = createMockSubscriber({
    traceparent: 'tp',
    tracestate: 'ts',
    newrelic: 'nr'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

  // availSlots = 0, i=1 > 0, breaks immediately
  assert.strictEqual(
    Object.keys(message.MessageAttributes).length,
    10,
    'should not add any headers when availSlots = 0'
  )
  end()
})

test('boundary: 9 existing attributes (availSlots=1) - adds 1 header', (t, end) => {
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
  const subscriber = createMockSubscriber({
    traceparent: 'tp',
    tracestate: 'ts',
    newrelic: 'nr'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('boundary: 8 existing attributes (availSlots=2) - adds 2 headers', (t, end) => {
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
  const subscriber = createMockSubscriber({
    traceparent: 'tp',
    tracestate: 'ts',
    newrelic: 'nr'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('boundary: 7 existing attributes (availSlots=3) - adds 3 headers', (t, end) => {
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
  const subscriber = createMockSubscriber({
    traceparent: 'tp',
    tracestate: 'ts',
    newrelic: 'nr'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should ignore non-priority headers regardless of count', (t, end) => {
  const message = {
    MessageAttributes: {
      e1: { DataType: 'String', StringValue: 'v1' }
    }
  }
  const subscriber = createMockSubscriber({
    h1: 'v1',
    h2: 'v2',
    h3: 'v3',
    h4: 'v4',
    h5: 'v5',
    h6: 'v6',
    h7: 'v7',
    h8: 'v8',
    h9: 'v9'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

  // Non-priority headers are ignored, so nothing is added
  assert.strictEqual(
    Object.keys(message.MessageAttributes).length,
    1,
    'should not add any non-priority headers'
  )
  end()
})

test('should add all priority headers when space is available', (t, end) => {
  const message = {
    MessageAttributes: {
      e1: { DataType: 'String', StringValue: 'v1' }
    }
  }
  const subscriber = createMockSubscriber({
    traceparent: 'tp-value',
    tracestate: 'ts-value',
    newrelic: 'nr-value'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should preserve existing attributes and not overwrite them', (t, end) => {
  const message = {
    MessageAttributes: {
      existing: { DataType: 'Number', StringValue: '123' }
    }
  }
  const subscriber = createMockSubscriber({
    traceparent: 'tp-value'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should handle empty string header values', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
    traceparent: ''
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should ignore non-priority headers even with 10 in headers object', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
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
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

  // Only priority headers are processed, so nothing is added
  assert.strictEqual(
    Object.keys(message.MessageAttributes).length,
    0,
    'should not add any non-priority headers'
  )
  end()
})

test('should add all 3 priority headers when no existing attributes', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
    traceparent: 'tp',
    tracestate: 'ts',
    newrelic: 'nr'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

  assert.strictEqual(
    Object.keys(message.MessageAttributes).length,
    3,
    'should add all 3 priority headers'
  )
  end()
})

test('should ignore non-priority headers mixed with priority headers', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
    traceparent: 'tp',
    otherHeader: 'should-not-be-added',
    anotherHeader: 'also-ignored'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should skip priority headers not present in headers object', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
    traceparent: 'tp-value'
    // tracestate and newrelic not provided
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

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

test('should handle undefined header values', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
    traceparent: 'tp-value',
    tracestate: undefined,
    newrelic: 'nr-value'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

  // Should add headers even with undefined values because Object.hasOwn returns true
  assert.ok(message.MessageAttributes.traceparent)
  assert.ok(message.MessageAttributes.tracestate, 'tracestate with undefined value should be added')
  assert.strictEqual(message.MessageAttributes.tracestate.StringValue, undefined)
  assert.ok(message.MessageAttributes.newrelic)
  end()
})

test('should handle null header values', (t, end) => {
  const message = {
    MessageAttributes: {}
  }
  const subscriber = createMockSubscriber({
    traceparent: null
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

  assert.ok(message.MessageAttributes.traceparent, 'traceparent with null value should be added')
  assert.strictEqual(message.MessageAttributes.traceparent.StringValue, null)
  end()
})

test('should create MessageAttributes if missing', (t, end) => {
  const message = {}
  const subscriber = createMockSubscriber({
    traceparent: 'tp-value'
  })
  const context = {}

  attachHeaders({ message, context, subscriber })

  assert.ok(message.MessageAttributes, 'MessageAttributes should be created')
  assert.strictEqual(
    Object.keys(message.MessageAttributes).length,
    1,
    'should have 1 message attribute'
  )
  assert.strictEqual(
    message.MessageAttributes.traceparent.StringValue,
    'tp-value'
  )
  end()
})

test('should call insertDTHeaders with correct parameters', (t, end) => {
  const message = {}
  const context = {}
  let insertDTHeadersCalled = false
  let capturedParams = null

  const subscriber = {
    insertDTHeaders(params) {
      insertDTHeadersCalled = true
      capturedParams = params
      params.headers.traceparent = 'test-value'
    }
  }

  attachHeaders({ message, context, subscriber })

  assert.ok(insertDTHeadersCalled, 'insertDTHeaders should be called')
  assert.ok(capturedParams, 'params should be captured')
  assert.ok(capturedParams.headers, 'headers should be in params')
  assert.strictEqual(capturedParams.ctx, context, 'context should be passed as ctx')
  end()
})

/**
 * Creates a mock subscriber with a configurable insertDTHeaders method.
 *
 * @param {object} headersToInsert The headers that should be inserted by
 * insertDTHeaders.
 *
 * @returns {object} Mock subscriber object.
 */
function createMockSubscriber(headersToInsert = {}) {
  return {
    insertDTHeaders({ headers }) {
      Object.assign(headers, headersToInsert)
    }
  }
}
