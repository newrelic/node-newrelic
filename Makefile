MOCHA        = node_modules/.bin/mocha
MOCHA_NOBIN  = node_modules/.bin/_mocha
COVER        = node_modules/.bin/cover
TAP          = node_modules/.bin/tap
NODE_VERSION = $(shell node --version)
INTEGRATION  =  $(wildcard test/integration/*.tap.js)
INTEGRATION  += $(wildcard test/versioned/*/*.tap.js)
# subcomponents manage their own modules
NPMDIRS =  $(wildcard test/lib/bootstrap/*)
NPMDIRS += $(wildcard test/versioned/*)
SUBNPM = $(NPMDIRS:%=npm-%)
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

.PHONY: all build test-cov test clean notes pending pending-core test-clean
.PHONY: unit integration ssl
.PHONY: sub_node_modules $(SUBNPM)

all: build test

clean:
	rm -rf npm-debug.log newrelic_agent.log .coverage_data cover_html
	rm -rf $(SSLKEY) $(CACERT) $(CAINDEX) $(CASERIAL) $(CERTIFICATE)
	rm -rf test/lib/*.old test/lib/*.attr

node_modules: package.json
	@rm -rf node_modules
	npm --loglevel warn install

build: clean node_modules
	@echo "Currently using node $(NODE_VERSION)."

test: unit integration

test-clean:
	rm -rf test/integration/test-mongodb
	rm -rf test/integration/test-mysql
	rm newrelic_agent.log

test-ci: node_modules sub_node_modules $(CERTIFICATE)
	@rm -f newrelic_agent.log
	@$(MOCHA) --reporter min
	@$(TAP) $(INTEGRATION)

unit: node_modules
	@rm -f newrelic_agent.log
	@$(MOCHA)

sub_node_modules: $(SUBNPM)

$(SUBNPM):
	@$(MAKE) -s -C $(@:npm-%=%) node_modules

integration: node_modules sub_node_modules $(CERTIFICATE)
	@time $(TAP) $(INTEGRATION)

coverage: clean node_modules $(CERTIFICATE)
	@$(COVER) run $(MOCHA_NOBIN)
	@for tapfile in $(INTEGRATION) ; do \
		$(COVER) run $$tapfile ; \
	done
	@$(COVER) combine
	@$(COVER) report html
	@$(COVER) report

notes:
	find . -name node_modules -prune -o \
	       -name cover_html -prune -o \
	       -name newrelic_agent.log -prune -o \
	       \( -name ".*" -a \! -name . \) -prune -o \
	      -type f -exec egrep -n -H --color=always -C 2 'FIXME|TODO|NOTE|TBD|hax|HAX' {} \; | less -r

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
