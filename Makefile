MOCHA        = node_modules/.bin/mocha
MOCHA_NOBIN  = node_modules/.bin/_mocha
COVER        = node_modules/.bin/cover
TAP          = node_modules/.bin/tap
NODE_VERSION = $(shell node --version)
INTEGRATION  = $(shell find . -name *.tap.js -print)
# only want to find root package.json files, not those in node_modules
INT_PACKAGES = $(shell echo test/integration/versioned/*/package.json)
STARTDIR     = $(shell pwd)
TESTKEY      = test/lib/test-key.key
TESTCERT     = test/lib/self-signed-test-certificate.crt
TESTSUBJ     = "/O=testsuite/OU=Node.js agent team/CN=ssl.lvh.me"

.PHONY: all build test-cov test clean notes pending pending-core unit integration
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

integration: node_modules $(TESTCERT)
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
	rm -rf $(TESTKEY) $(TESTCERT)

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

$(TESTKEY):
	@openssl genrsa -out $(TESTKEY) 1024

$(TESTCERT): $(TESTKEY)
	@openssl req \
		-new \
		-subj $(TESTSUBJ) \
		-key $(TESTKEY) \
		-out server.csr
	@openssl x509 \
		-req \
		-days 365 \
		-in server.csr \
		-signkey $(TESTKEY) \
		-out $(TESTCERT)
	@rm server.csr
