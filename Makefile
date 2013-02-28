MOCHA        = node_modules/.bin/mocha
MOCHA_NOBIN  = node_modules/.bin/_mocha
COVER        = node_modules/.bin/cover
TAP          = node_modules/.bin/tap
NODE_VERSION = $(shell node --version)
INTEGRATION  = $(shell find . -name *.tap.js -print)
# only want to find root package.json files, not those in node_modules
INT_PACKAGES = $(shell echo test/integration/versioned/*/package.json)
STARTDIR     = $(shell pwd)
# SSL
SSLKEY       = test/lib/test-key.key
# certificate authority, so curl doesn't complain
CACERT       = test/lib/ca-certificate.crt
CASUBJ       = "/O=testsuite/OU=New Relic CA/CN=Node.js test CA"
CACONFIG     = test/lib/test-ca.conf
CAINDEX      = test/lib/ca-index
CASERIAL     = test/lib/ca-serial
# actual certificate configuration
CERTIFICATE  = test/lib/self-signed-test-certificate.crt
SUBJECT      = "/O=testsuite/OU=Node.js agent team/CN=ssl.lvh.me"

.PHONY: all build test-cov test clean notes pending pending-core
.PHONY: unit integration ssl

all: build test

node_modules: package.json
	@rm -rf node_modules
	npm install

build: clean node_modules
	@echo "Running node $(NODE_VERSION)."

test-cov: clean node_modules
	@$(COVER) run $(MOCHA_NOBIN)
	@for tapfile in $(INTEGRATION) ; do \
		$(COVER) run $$tapfile ; \
	done
	@$(COVER) combine
	@$(COVER) report html
	@$(COVER) report

test: unit integration

unit: node_modules
	@rm -f newrelic_agent.log
	@$(MOCHA)

integration: node_modules $(CERTIFICATE)
	@rm -f test/integration/newrelic_agent.log
	@for package in $(INT_PACKAGES) ; do \
		dir=$$(dirname $$package) ; \
		cd $$dir ; \
		rm -rf node_modules ; \
		npm install ; \
		cd $(STARTDIR) ; \
	done
	@time $(TAP) $(INTEGRATION)

clean:
	rm -rf npm-debug.log newrelic_agent.log .coverage_data cover_html
	rm -rf $(SSLKEY) $(CACERT) $(CAINDEX) $(CASERIAL) $(CERTIFICATE)
	rm -rf test/lib/*.old test/lib/*.attr

notes:
	find . -wholename ./node_modules -prune -o \
	       -wholename ./cover_html -prune -o \
	       -name newrelic_agent.log -prune -o \
	       \( -name ".*" -a \! -name . \) -prune -o \
	      -type f -exec egrep -n -H --color=always -C 2 'FIXME|TODO|NOTE|TBD|hax' {} \; | less -r

pending: node_modules
	@$(MOCHA) --reporter list | egrep '^\s+\-'

pending-core: node_modules
	@$(MOCHA) --reporter list | egrep '^\s+\-' | grep -v 'agent instrumentation of'

ssl: $(CERTIFICATE)

$(SSLKEY):
	@openssl genrsa -out $(SSLKEY) 1024

$(CAINDEX):
	@touch $(CAINDEX)

$(CASERIAL):
	@echo 000a > $(CASERIAL)

$(CACERT): $(SSLKEY) $(CAINDEX) $(CASERIAL)
	@openssl req \
		-new \
		-subj $(CASUBJ) \
		-key $(SSLKEY) \
		-days 3650 \
		-x509 \
		-out $(CACERT)

$(CERTIFICATE): $(CACERT)
	@openssl req \
		-new \
		-subj $(SUBJECT) \
		-key $(SSLKEY) \
		-out server.csr
	@openssl ca \
		-batch \
		-cert $(CACERT) \
		-config $(CACONFIG) \
		-keyfile $(SSLKEY) \
		-in server.csr \
		-out $(CERTIFICATE)
	@rm -f server.csr
