/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const httpApiGatewayV1Event = {
  version: '1.0',
  resource: '/my/path',
  path: '/my/path',
  httpMethod: 'GET',
  headers: {
    header1: 'value1',
    header2: 'value2'
  },
  multiValueHeaders: {
    header1: ['value1'],
    header2: ['value1', 'value2']
  },
  queryStringParameters: {
    parameter1: 'value1',
    parameter2: 'value'
  },
  multiValueQueryStringParameters: {
    parameter1: ['value1', 'value2'],
    parameter2: ['value']
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'id',
    authorizer: {
      claims: null,
      scopes: null
    },
    domainName: 'id.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'id',
    extendedRequestId: 'request-id',
    httpMethod: 'GET',
    identity: {
      accessKey: null,
      accountId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '192.0.2.1',
      user: null,
      userAgent: 'user-agent',
      userArn: null,
      clientCert: {
        clientCertPem: 'CERT_CONTENT',
        subjectDN: 'www.example.com',
        issuerDN: 'Example issuer',
        serialNumber: 'a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1',
        validity: {
          notBefore: 'May 28 12:30:02 2019 GMT',
          notAfter: 'Aug  5 09:36:04 2021 GMT'
        }
      }
    },
    path: '/my/path',
    protocol: 'HTTP/1.1',
    requestId: 'id=',
    requestTime: '04/Mar/2020:19:15:17 +0000',
    requestTimeEpoch: 1583349317135,
    resourceId: null,
    resourcePath: '/my/path',
    stage: '$default'
  },
  pathParameters: null,
  stageVariables: null,
  body: 'Hello from Lambda!',
  isBase64Encoded: false
}

// https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
const restApiGatewayV1Event = {
  resource: '/my/path',
  path: '/my/path',
  httpMethod: 'GET',
  headers: {
    header1: 'value1',
    header2: 'value2'
  },
  multiValueHeaders: {
    header1: ['value1'],
    header2: ['value1', 'value2']
  },
  queryStringParameters: {
    parameter1: 'value1',
    parameter2: 'value'
  },
  multiValueQueryStringParameters: {
    parameter1: ['value1', 'value2'],
    parameter2: ['value']
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'id',
    authorizer: {
      claims: null,
      scopes: null
    },
    domainName: 'id.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'id',
    extendedRequestId: 'request-id',
    httpMethod: 'GET',
    identity: {
      accessKey: null,
      accountId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '192.0.2.1',
      user: null,
      userAgent: 'user-agent',
      userArn: null,
      clientCert: {
        clientCertPem: 'CERT_CONTENT',
        subjectDN: 'www.example.com',
        issuerDN: 'Example issuer',
        serialNumber: 'a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1',
        validity: {
          notBefore: 'May 28 12:30:02 2019 GMT',
          notAfter: 'Aug  5 09:36:04 2021 GMT'
        }
      }
    },
    path: '/my/path',
    protocol: 'HTTP/1.1',
    requestId: 'id=',
    requestTime: '04/Mar/2020:19:15:17 +0000',
    requestTimeEpoch: 1583349317135,
    resourceId: null,
    resourcePath: '/my/path',
    stage: '$default'
  },
  pathParameters: null,
  stageVariables: null,
  body: 'Hello from Lambda!',
  isBase64Encoded: false
}

// https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
const httpApiGatewayV2Event = {
  version: '2.0',
  routeKey: '$default',
  rawPath: '/my/path',
  rawQueryString: 'parameter1=value1&parameter1=value2&parameter2=value',
  cookies: ['cookie1', 'cookie2'],
  headers: {
    header1: 'value1',
    header2: 'value1,value2',
    accept: 'application/json'
  },
  queryStringParameters: {
    parameter1: 'value1,value2',
    parameter2: 'value',
    name: 'me',
    team: 'node agent'
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'api-id',
    authentication: {
      clientCert: {
        clientCertPem: 'CERT_CONTENT',
        subjectDN: 'www.example.com',
        issuerDN: 'Example issuer',
        serialNumber: 'a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1',
        validity: {
          notBefore: 'May 28 12:30:02 2019 GMT',
          notAfter: 'Aug  5 09:36:04 2021 GMT'
        }
      }
    },
    authorizer: {
      jwt: {
        claims: {
          claim1: 'value1',
          claim2: 'value2'
        },
        scopes: ['scope1', 'scope2']
      }
    },
    domainName: 'id.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'id',
    http: {
      method: 'POST',
      path: '/my/path',
      protocol: 'HTTP/1.1',
      sourceIp: '192.0.2.1',
      userAgent: 'agent'
    },
    requestId: 'id',
    routeKey: '$default',
    stage: '$default',
    time: '12/Mar/2020:19:03:58 +0000',
    timeEpoch: 1583348638390
  },
  body: 'Hello from Lambda',
  pathParameters: {
    parameter1: 'value1'
  },
  isBase64Encoded: false,
  stageVariables: {
    stageVariable1: 'value1',
    stageVariable2: 'value2'
  }
}

// Event used when one Lambda directly invokes another Lambda.
// https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-retain-records.html#invocation-async-destinations
const lambaV1InvocationEvent = {
  version: '1.0',
  timestamp: '2019-11-14T18:16:05.568Z',
  requestContext: {
    requestId: 'e4b46cbf-b738-xmpl-8880-a18cdf61200e',
    functionArn: 'arn:aws:lambda:us-east-2:123456789012:function:my-function:$LATEST',
    condition: 'RetriesExhausted',
    approximateInvokeCount: 3
  },
  requestPayload: {
    ORDER_IDS: [
      '9e07af03-ce31-4ff3-xmpl-36dce652cb4f',
      '637de236-e7b2-464e-xmpl-baf57f86bb53',
      'a81ddca6-2c35-45c7-xmpl-c3a03a31ed15'
    ]
  },
  responseContext: {
    statusCode: 200,
    executedVersion: '$LATEST',
    functionError: 'Unhandled'
  },
  responsePayload: {
    errorMessage:
      'RequestId: e4b46cbf-b738-xmpl-8880-a18cdf61200e Process exited before completing request'
  }
}

module.exports = {
  restApiGatewayV1Event,
  httpApiGatewayV1Event,
  httpApiGatewayV2Event,
  lambaV1InvocationEvent
}
