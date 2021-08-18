/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('path')
const util = require('util')
const fs = require('fs')
const Ajv = require('ajv')
const ajv = new Ajv()
const restify = require('restify')
const codec = require('../../lib/util/codec')
const logger = require('../../lib/logger').child({ component: 'fake_collector' })

const ACTUAL_HOST = 'collector-1.integration-test'
const PORT = 8089
const PATHS = {
  connect: path.join(__dirname, 'schemas/connect.json'),
  container: path.join(__dirname, 'schemas/transaction_sample_data.json'),
  trace: path.join(__dirname, 'schemas/transaction_trace.json'),
  error: path.join(__dirname, 'schemas/error_data.json'),
  metric: path.join(__dirname, 'schemas/metric_data.json'),
  sql: path.join(__dirname, 'schemas/sql_trace_data.json'),
  sqlParams: path.join(__dirname, 'schemas/sql_params.json')
}
const { SSL_HOST } = require('./agent_helper')

const schemas = {}
Object.keys(PATHS).forEach(function (key) {
  schemas[key] = JSON.parse(fs.readFileSync(PATHS[key]))
})

function validateSchema(data, schema) {
  const checkSchema = ajv.compile(schema)
  return checkSchema(data)
}

function getHostname(request) {
  return request.header('Host').split(/:/)[0]
}

function decodeTraceData(encodedArray, callback) {
  let toDecode = encodedArray.length
  const decoded = []

  encodedArray.forEach(function (data) {
    const element = data[4]
    codec.decode(element, function (error, extracted) {
      if (error) {
        return callback(error)
      }

      decoded.push(extracted)
      toDecode -= 1
      if (toDecode < 1) {
        callback(null, decoded)
      }
    })
  })
}

function validate(schema, namespace) {
  return function (submitted, validations, callback) {
    const data = submitted

    const report = validateSchema(data, schema)
    if (report.errors.length) {
      validations[namespace] = report.errors
    }
    return callback(null, validations)
  }
}

function getRedirectURL() {
  return util.format('%s:%d', ACTUAL_HOST, PORT)
}

function returnData(validations, returned) {
  if (Object.keys(validations).length) {
    returned.validations = validations
  }
  return returned
}

const validators = {
  originalHost: function originalHost(request, validations) {
    const host = getHostname(request)

    validations.host_name_errors = []

    if (host !== SSL_HOST) {
      validations.host_name_errors.push('not connecting to root collector')
    }

    if (host === ACTUAL_HOST) {
      validations.host_name_errors.push('already connected to redirect target')
    }

    if (validations.host_name_errors.length < 1) {
      delete validations.host_name_errors
    }

    return validations
  },

  redirectedHost: function (request, validations) {
    const host = getHostname(request)
    if (host !== ACTUAL_HOST) {
      validations.host_name_errors = ['did not redirect to ' + ACTUAL_HOST]
    }

    return validations
  },

  connect: validate(schemas.connect, 'connect'),
  errors: validate(schemas.error, 'error_data'),
  metrics: validate(schemas.metric, 'metric_data'),

  transactionTraces: function (transactionData, validations, callback) {
    const data = JSON.parse(transactionData)

    const report = validateSchema(data, schemas.container)
    if (report.errors.length) {
      validations.transaction_sample_data = report.errors
    }

    const traces = data[1]
    decodeTraceData(traces, function (err, traceList) {
      if (err) {
        validations.transaction_traces = [
          util.format('unable to inflate encoded traces. zlib says: %s', err.message)
        ]
        return callback(null, validations)
      }

      validations.transaction_traces = traceList
        .map(function (trace) {
          const validateReport = validateSchema(trace, schemas.trace)
          if (validateReport.errors.length) {
            return validateReport.errors
          }
        })
        .filter(function (trace) {
          if (trace) {
            return true
          }
        })

      if (validations.transaction_traces.length < 1) {
        delete validations.transaction_traces
      }

      return callback(null, validations)
    })
  },

  sqlTraces: function (sqlTraceData, validations, callback) {
    const data = JSON.parse(sqlTraceData)

    const report = validateSchema(data, schemas.sql)
    if (report.errors.length) {
      validations.sql_trace_data = report.errors
    }

    validations.sql_param_decode_errors = []
    validations.sql_params = []

    let toDecode = data.length
    data.forEach(function (trace) {
      codec.decode(trace[9], function (error, extracted) {
        if (error) {
          const message = util.format(
            'unable to inflate encoded SQL parameters. zlib says: %s',
            error.message
          )
          validations.sql_param_decode_errors.push(message)
        } else {
          const validateReport = validateSchema(extracted, schemas.sqlParams)
          if (validateReport.errors.length) {
            validations.sql_params.push(validateReport.errors)
          }
        }

        toDecode -= 1
        if (toDecode < 1) {
          if (validations.sql_param_decode_errors.length < 1) {
            delete validations.sql_param_decode_errors
          }

          if (validations.sql_params.length < 1) {
            delete validations.sql_params
          }

          callback(null, validations)
        }
      })
    })
  },

  queryString: function (query, validation) {
    validation.query_errors = []

    if (!query.marshal_format) {
      validation.query_errors.push('marshal_format not set')
    } else if (query.marshal_format !== 'json') {
      validation.query_errors.push(
        util.format('this validator checks JSON, not %s', query.marshal_format)
      )
    }

    const version = query.protocol_version
    if (!version) {
      validation.query_errors.push('protocol_version not set')
    } else if (version < 9 || version > 17) {
      validation.query_errors.push(
        util.format('protocol_version %d is not between 9 and 17', version)
      )
    }

    if (!query.license_key) {
      validation.query_errors.push('license_key not set')
    }

    if (!query.method) {
      validation.query_errors.push('no method to be invoked')
    }

    if (validation.query_errors.length === 0) {
      delete validation.query_errors
    }

    return validation
  },

  httpHeaders: function (request, validation) {
    validation.header_errors = []

    const encoding = request.header('content-encoding')
    if (!encoding) {
      validation.header_errors.push("'Content-Encoding' not set")
    } else if (!(encoding === 'identity' || encoding === 'deflate')) {
      validation.header_errors.push(
        util.format("Content-Encoding' must be 'identity' or 'deflate', not '%s'", encoding)
      )
    }

    if (request.header('content-type') !== 'application/json') {
      validation.header_errors.push(
        "you really ought to be setting 'Content-Type' to 'application/json'" +
          " (The collector doesn't care, though)"
      )
    }

    // NewRelic-NodeAgent/0.9.1-46 (nodejs 0.8.12 darwin-x64)
    const userAgentPattern = /^NewRelic-[a-zA-Z0-9]+\/[0-9.\-]+ \(.+\)$/
    if (!userAgentPattern.test(request.header('User-Agent'))) {
      validation.header_errors.push("'User-Agent' should conform to New Relic standards")
    }

    if (validation.header_errors.length === 0) {
      delete validation.header_errors
    }

    return validation
  }
}

function handleGenerically(validator) {
  return function handle(req, res, validations, next) {
    validators.redirectedHost(req, validations)
    validator(req.body, validations, function (error, validationList) {
      if (error) {
        return next(error)
      }

      res.send(returnData(validationList, { return_value: {} }))
      return next()
    })
  }
}

const methods = {
  preconnect: function (req, res, validations, next) {
    validators.originalHost(req, validations)

    if (!Array.isArray(req.body) || req.body.length) {
      validations.body_errors = ["preconnect expects a body of '[]'"]
    }

    res.send(returnData(validations, { return_value: getRedirectURL() }))
    return next()
  },

  connect: function (req, res, validations, next) {
    validators.redirectedHost(req, validations)
    validators.connect(req.body, validations, function (error, validationList) {
      if (error) {
        return next(error)
      }

      res.send(
        returnData(validationList, {
          return_value: {
            agent_run_id: 1337,
            collect_errors: true,
            collect_traces: true,
            apdex_t: 0.5,
            encoding_key: req.query.license_key
          }
        })
      )

      return next()
    })
  },

  transaction_sample_data: handleGenerically(validators.transactionTraces),
  error_data: handleGenerically(validators.errors),
  metric_data: handleGenerically(validators.metrics),
  sql_trace_data: handleGenerically(validators.sqlTraces)
}

function bootstrap(options, callback) {
  const server = restify.createServer({
    key: fs.readFileSync(path.join(__dirname, './test-key.key')),
    certificate: fs.readFileSync(path.join(__dirname, './self-signed-test-certificate.crt'))
  })

  server.use(restify.plugins.queryParser({ mapParams: false }))
  server.use(restify.plugins.bodyParser({ mapParams: false }))

  restify.defaultResponseHeaders = function () {
    // the collector *always* leaves the content-type set to text/plain
    this.header('Content-Type', 'text/plain')
  }

  server.on(
    'after',
    restify.plugins.auditLogger({
      log: logger,
      event: 'after'
    })
  )

  server.post('/agent_listener/invoke_raw_method', function (req, res, next) {
    const validations = {}
    validators.queryString(req.query, validations)
    validators.httpHeaders(req, validations)

    if (!methods[req.query.method]) {
      validations.query_errors.push('unfamiliar method invoked; bailing out')
      res.send(404, validations)
      next()
    } else {
      methods[req.query.method](req, res, validations, next)
    }
  })

  server.pre(function (req, res, next) {
    // Restify will short-circuit with UnsupportedMediaTypeError for non-gzip encodings.
    // It will try its best when there is no encoding, so we force that here to
    // handle our identity case.
    if (req.headers['content-encoding'] !== 'gzip') {
      req.headers['content-encoding'] = undefined
    }

    return next()
  })

  server.listen(options.port, function () {
    callback(null, server)
  })
}

module.exports = bootstrap
