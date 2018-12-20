#! /bin/sh

SSLKEY="test/lib/test-key.key"
CACERT="test/lib/ca-certificate.crt"
CAINDEX="test/lib/ca-index"
CASERIAL="test/lib/ca-serial"
CERTIFICATE="test/lib/self-signed-test-certificate.crt"

find . -depth -type d -name node_modules -print0 | xargs -0 rm -rf
find . -name package-lock.json -print0 | xargs -0 rm -rf
find . -name newrelic_agent.log -print0 | xargs -0 rm -rf
rm -rf npm-debug.log newrelic_agent.log .coverage_data cover_html
rm -rf $SSLKEY $CACERT $CAINDEX $CASERIAL $CERTIFICATE
rm -rf test/lib/*.old test/lib/*.attr
rm -rf docs/