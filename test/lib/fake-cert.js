/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const selfCert = require('self-cert')

/**
 * @typedef {object} FakeCert
 * @property {string} privateKey PEM formatted private key.
 * @property {string} publicKey PEM formatted public key.
 * @property {string} certificate PEM formatted TLS certificate.
 * @property {Buffer} privateKeyBuffer Same as privateKey.
 * @property {Buffer} publicKeyBuffer Same as publicKey.
 * @property {Buffer} certificateBuffer Same as certificate.
 */

/**
 * Generate a self-signed certificate. When `commonName` is not provided, the
 * certificate will target the local system; it will use `os.hostname()` as the
 * common name. It always adds all local interfaces's IP addresses as
 * subject alternate names.
 *
 * @param {object} [params] params object
 * @param {string|null} [params.commonName] The subject name for the
 * certificate. This is useful when generating a certificate for remote hosts,
 * e.g. when generating a proxy certificate for staging-collector.newrelic.com.
 *
 * @returns {FakeCert}
 */
module.exports = function fakeCert({ commonName = null } = {}) {
  const cert = selfCert({
    // We set the certificate bits to 2,048 because we don't need 4,096 bit
    // certificates for tests. This speeds up certificate generation time by
    // a significant amount, and thus speeds up tests that rely on these
    // certificates.
    bits: 2_048,
    attrs: {
      commonName,
      stateName: 'Georgia',
      locality: 'Atlanta',
      orgName: 'New Relic',
      shortName: 'new_relic'
    },
    expires: new Date('2099-12-31')
  })

  cert.privateKeyBuffer = Buffer.from(cert.privateKey, 'utf8')
  cert.publicKeyBuffer = Buffer.from(cert.publicKey, 'utf8')
  cert.certificateBuffer = Buffer.from(cert.certificate, 'utf8')

  return cert
}
