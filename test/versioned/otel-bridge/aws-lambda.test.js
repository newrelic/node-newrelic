/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const otel = require('@opentelemetry/api')

const helper = require('../../lib/agent_helper.js')
const {
    afterEach,
    checkAWSAttributes,
    EXTERN_PATTERN,
    SEGMENT_DESTINATION
} = require('../aws-sdk-v3/common.js')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs/index.js')
const { match } = require('../../lib/custom-assertions')

function checkEntityLinkingSegments({ operations, tx, end }) {
    const root = tx.trace.root

    const segments = checkAWSAttributes({ trace: tx.trace, segment: root, pattern: EXTERN_PATTERN })
    const accountId = tx.agent.config.cloud.aws.account_id
    const testFunctionName = 'my-lambda-function'

    assert(segments.length > 0, 'should have segments')
    assert.ok(accountId, 'account id should be set on agent config')

    segments.forEach((segment) => {
        const attrs = segment.attributes.get(SEGMENT_DESTINATION)

        match(attrs, {
            'aws.operation': operations[0],
            'aws.requestId': String,
            'aws.region': 'us-east-1',
            'aws.service': String,
            'cloud.resource_id': `arn:aws:lambda:${attrs['aws.region']}:${accountId}:function:${testFunctionName}`,
            'cloud.platform': 'aws_lambda'
        })
    })
    end()
}

// Adaptation from test/versioned/aws-sdk-v3/lambda.test.js
test('LambdaClient', async (t) => {
    t.beforeEach(async (ctx) => {
        ctx.nr = {}
        const server = createEmptyResponseServer()
        await new Promise((resolve) => {
            server.listen(0, resolve)
        })
        ctx.nr.server = server
        ctx.nr.agent = helper.instrumentMockedAgent({
            feature_flag: {
                opentelemetry_bridge: true
            },
            instrumentation: {
                // TODO: is this the correct way to disable the lambda instrumentation?
                '@aws-sdk/client-lambda': {
                    enabled: false
                }
            }
        })
        ctx.nr.api = helper.getAgentApi()
        ctx.nr.tracer = otel.trace.getTracer('lambda-client-test')
        const { LambdaClient, ...lib } = require('@aws-sdk/client-lambda')
        ctx.nr.AddLayerVersionPermissionCommand = lib.AddLayerVersionPermissionCommand
        ctx.nr.InvokeCommand = lib.InvokeCommand
        const endpoint = `http://localhost:${server.address().port}`
        ctx.nr.service = new LambdaClient({
            credentials: FAKE_CREDENTIALS,
            endpoint,
            region: 'us-east-1'
        })
    })

    t.afterEach(afterEach)

    await t.test('InvokeCommand', (t, end) => {
        const { service, agent, tracer, InvokeCommand } = t.nr
        agent.config.cloud.aws.account_id = 123456789012
        // Expected otel attributes from spec
        // https://github.com/open-telemetry/opentelemetry-specification/blob/v1.7.0/specification/trace/semantic_conventions/faas.md#example 
        const attributes = {
            'cloud.provider': 'aws',
            'cloud.region': 'us-east-1',
            'faas.trigger': "http",
            'faas.execution': "af9d5aa4-a685-4c5f-a22b-444f80b3cc28",
            'faas.coldstart': true,
            'faas.name': "my-lambda-function",
            'faas.id': "arn:aws:lambda:us-west-2:123456789012:function:my-lambda-function",
            'faas.version': "semver:2.0.0",
            'faas.instance': "my-lambda-function:instance-0001",
        }
        helper.runInTransaction(agent, async (tx) => {
            tx.name = 'lambda-invoke'
            tracer.startActiveSpan(tx.name, { kind: otel.SpanKind.CLIENT, attributes }, async (span) => {
                const cmd = new InvokeCommand({
                    FunctionName: 'my-lambda-function',
                    Payload: JSON.stringify({ prop1: 'test', prop2: 'test 2' })
                })
                await service.send(cmd)
                tx.end()

                // const segment = agent.tracer.getSegment()
                span.end()

                // check segment attributes
                setImmediate(checkEntityLinkingSegments, {
                    operations: ['InvokeCommand'],
                    tx,
                    end
                })
            })
        })
    })
})