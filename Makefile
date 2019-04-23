MOCHA        = node_modules/.bin/mocha
MOCHA_NOBIN  = node_modules/.bin/_mocha
TAP          = node_modules/.bin/tap
ESLINT       = node_modules/.bin/eslint
JSDOC        = node_modules/.bin/jsdoc
NODE_VERSION = $(shell node --version)
PACKAGE_VERSION = $(shell node -e 'console.log(require("./package").version)')
INTEGRATION  =  test/integration/*.tap.js
INTEGRATION  += test/integration/*/*.tap.js
INTEGRATION  += test/integration/*/*/*.tap.js
SMOKE        = test/smoke/*.tap.js
PRERELEASE	 = test/prerelease/*/*.tap.js
# subcomponents manage their own modules
PACKAGES = $(shell find . -name package.json -and -not -path '*/node_modules/*' -and -not -path '*/example*')
# strip the package.json from the results
NPMDIRS = $(PACKAGES:/package.json=)
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
.PHONY: unit integration ssl ca-gen smoke lint
.PHONY: sub_node_modules $(SUBNPM)

all: build test

clean:
	find . -depth -type d -name node_modules -print0 | xargs -0 rm -rf
	find . -name package-lock.json -print0 | xargs -0 rm -rf
	find . -name newrelic_agent.log -print0 | xargs -0 rm -rf
	rm -rf npm-debug.log newrelic_agent.log .coverage_data cover_html
	rm -rf $(SSLKEY) $(CACERT) $(CAINDEX) $(CASERIAL) $(CERTIFICATE)
	rm -rf test/lib/*.old test/lib/*.attr
	rm -rf docs/

node_modules: package.json
	@rm -rf node_modules
	npm --loglevel warn install

build: clean node_modules
	@echo "Currently using node $(NODE_VERSION)."

test: unit integration

lint: node_modules
	$(ESLINT) ./*.js lib

test-force-all:
	export NR_NODE_TEST_FORCE_ALL=true
	npm install
	npm install oracle
	make test

test-ci: node_modules sub_node_modules $(CERTIFICATE)
	@rm -f newrelic_agent.log
	@$(MOCHA) test/unit --recursive --reporter min
	@$(TAP) $(INTEGRATION)

unit: node_modules
	@rm -f newrelic_agent.log
	@cd test && npm install --no-package-lock;
	@$(MOCHA) -r nock -c test/unit --recursive

sub_node_modules:
	@node test/bin/install_sub_deps

ca-gen:
	@./bin/update-ca-bundle.sh

docker:
	@HOST=`docker-machine ip default 2>/dev/null`; \
	if test "$${HOST}"; then \
	  echo "Using docker-machine host through IP $${HOST}"; \
	  export NR_NODE_TEST_MEMCACHED_HOST=$${HOST}; \
	  export NR_NODE_TEST_MONGODB_HOST=$${HOST}; \
	  export NR_NODE_TEST_MYSQL_HOST=$${HOST}; \
	  export NR_NODE_TEST_REDIS_HOST=$${HOST}; \
	  export NR_NODE_TEST_CASSANDRA_HOST=$${HOST}; \
	  export NR_NODE_TEST_POSTGRES_HOST=$${HOST}; \
	  export NR_NODE_TEST_RABBIT_HOST=$${HOST}; \
	fi; \

integration: node_modules sub_node_modules ca-gen $(CERTIFICATE) docker
	time $(TAP) $(INTEGRATION) --timeout=120

versioned: node_modules ca-gen $(CERTIFICATE) docker
	time ./bin/run-versioned-tests.sh

prerelease: node_modules ca-gen $(CERTIFICATE) docker
	@node test/bin/install_sub_deps prerelease
	time $(TAP) $(PRERELEASE)

smoke: clean
	npm install --production --loglevel warn
	npm install tap@12.4.0
	@cd test/smoke && npm install
	time $(TAP) $(SMOKE)

notes:
	find . -name node_modules -prune -o \
	       -name cover_html -prune -o \
	       -name newrelic_agent.log -prune -o \
	       \( -name ".*" -a \! -name . \) -prune -o \
	      -type f -exec egrep -n -H --color=always -C 2 'FIXME|TODO|NOTE|TBD|hax|HAX' {} \; | less -r

pending: node_modules
	@$(MOCHA) test/unit --recursive --reporter list | egrep '^\s+\-'

pending-core: node_modules
	@$(MOCHA) test/unit --recursive --reporter list | egrep '^\s+\-' | grep -v 'agent instrumentation of'

ssl: $(CERTIFICATE)

docs: node_modules
	$(JSDOC) -c ./jsdoc-conf.json --private -r .

public-docs: node_modules
	$(JSDOC) -c ./jsdoc-conf.json --tutorials examples/shim api.js lib/shim/ lib/transaction/handle.js
	cp examples/shim/*.png out/

publish-docs:
	git checkout gh-pages
	git pull origin gh-pages
	git merge -
	make public-docs
	git rm -r docs
	mv out docs
	git add docs
	git commit -m "docs: update for ${PACKAGE_VERSION}"
	git push origin gh-pages && git push public gh-pages:gh-pages

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

security:
	npm audit

services:
	./bin/docker-services.sh

	@echo "\nTo run individual integration tests, run 'source test/docker_env_vars.sh' to set\
	 the environment variables for all services.\n"

update_cross_agent_tests:
	rm -rf test/lib/cross_agent_tests
	git clone git@source.datanerd.us:newrelic/cross_agent_tests.git test/lib/cross_agent_tests
	rm -rf test/lib/cross_agent_tests/.git

# versions prior to 1.4(ish) can't upgrade themselves directly to latest so hop to 1.4.28 first.
# Only upgrade to latest if we are on node 0.x
update_npm_global:
	if npm -v | grep -q "^1"; then \
	  npm install -g npm@1.4.28; \
	fi

	if node -v | grep -q "^v0"; then \
	  npm install -g npm@3; \
	fi

	echo "\nUpgrading npm is expected to have many warnings due to tolerance changes over the years.\n"
