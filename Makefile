MOCHA        = node_modules/.bin/mocha
MOCHA_NOBIN  = node_modules/.bin/_mocha
COVER        = node_modules/.bin/cover
TAP          = node_modules/.bin/tap
NODE_VERSION = $(shell node --version)
INTEGRATION  =  test/integration/*.tap.js
INTEGRATION  += test/integration/*/*.tap.js
INTEGRATION  += test/integration/*/*/*.tap.js
INTEGRATION  += test/versioned/*/*.tap.js
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
.PHONY: unit integration ssl ca-gen
.PHONY: sub_node_modules $(SUBNPM)

all: build test

clean:
	find . -depth -type d -name node_modules -print0 | xargs -0 rm -r
	rm -rf npm-debug.log newrelic_agent.log .coverage_data cover_html
	rm -rf $(SSLKEY) $(CACERT) $(CAINDEX) $(CASERIAL) $(CERTIFICATE)
	rm -rf test/lib/*.old test/lib/*.attr

node_modules: package.json
	@rm -rf node_modules
	npm --loglevel warn install

build: clean node_modules
	@echo "Currently using node $(NODE_VERSION)."

test: unit integration

drone:
	npm install
	npm install oracle
	make test-force-all

test-force-all:
	export NR_NODE_TEST_FORCE_ALL=true
	npm install
	npm install oracle
	make test

test-clean:
	rm -rf test/integration/test-mongodb
	rm -rf test/integration/test-mysql
	rm newrelic_agent.log

test-ci: node_modules sub_node_modules $(CERTIFICATE)
	@rm -f newrelic_agent.log
	@$(MOCHA) test/unit --recursive --reporter min
	@$(TAP) $(INTEGRATION)

unit: node_modules
	@rm -f newrelic_agent.log
	@$(MOCHA) test/unit --recursive

sub_node_modules: $(SUBNPM)

$(SUBNPM):
	@$(MAKE) -s -C $(@:npm-%=%) node_modules

ca-gen:
	@./bin/update-ca-bundle.sh

integration: node_modules sub_node_modules ca-gen $(CERTIFICATE)
	@HOST=`boot2docker ip 2>/dev/null`; \
	if test "$${HOST}"; then \
	  echo "Using boot2docker host through IP $${HOST}"; \
	  export NR_NODE_TEST_MEMCACHED_HOST=$${HOST}; \
	  export NR_NODE_TEST_MONGODB_HOST=$${HOST}; \
	  export NR_NODE_TEST_MYSQL_HOST=$${HOST}; \
	  export NR_NODE_TEST_REDIS_HOST=$${HOST}; \
	  export NR_NODE_TEST_CASSANDRA_HOST=$${HOST}; \
	  export NR_NODE_TEST_POSTGRES_HOST=$${HOST}; \
	fi; \
	time $(TAP) $(INTEGRATION)

coverage: clean node_modules $(CERTIFICATE)
	@$(COVER) run $(MOCHA_NOBIN) -- test/unit --recursive
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
	@$(MOCHA) test/unit --recursive --reporter list | egrep '^\s+\-'

pending-core: node_modules
	@$(MOCHA) test/unit --recursive --reporter list | egrep '^\s+\-' | grep -v 'agent instrumentation of'

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

services:
	if docker ps -a | grep -q "[^a-zA-Z_]nr_node_memcached[^a-zA-Z_]"; then \
	  docker start nr_node_memcached; \
	else \
	  docker run -d --name nr_node_memcached -p 11211:11211 borja/docker-memcached; \
	fi
	if docker ps -a | grep -q "[^a-zA-Z_]nr_node_mongodb[^a-zA-Z_]"; then \
	  docker start nr_node_mongodb; \
	else \
	  docker run -d --name nr_node_mongodb -p 27017:27017 dockerfile/mongodb; \
	fi
	if docker ps -a | grep -q "[^a-zA-Z_]nr_node_mysql[^a-zA-Z_]"; then \
	  docker start nr_node_mysql; \
	else \
	  docker run -d --name nr_node_mysql -p 3306:3306 orchardup/mysql; \
	fi
	if docker ps -a | grep -q "[^a-zA-Z_]nr_node_redis[^a-zA-Z_]"; then \
	  docker start nr_node_redis; \
	else \
	  docker run -d --name nr_node_redis -p 6379:6379 redis; \
	fi
	if docker ps -a | grep -q "[^a-zA-Z_]nr_node_cassandra[^a-zA-Z_]"; then \
	  docker start nr_node_cassandra; \
	else \
	  docker run -d --name nr_node_cassandra -p 9042:9042 zmarcantel/cassandra; \
	fi
	if docker ps -a | grep -q "[^a-zA-Z_]nr_node_postgres[^a-zA-Z_]"; then \
	  docker start nr_node_postgres; \
	else \
	  docker run -d --name nr_node_postgres -p 5432:5432 zaiste/postgresql; \
	fi
	if docker ps -a | grep -q "[^a-zA-Z_]nr_node_oracle[^a-zA-Z_]"; then \
	  docker start nr_node_oracle; \
	else \
	  docker run -d --name nr_node_oracle -p 1521:1521 alexeiled/docker-oracle-xe-11g; \
	fi

	@echo "\nTo run individual integration tests, run 'source test/docker_env_vars.sh' to set\
	 the environment variables for all services.\n"

update_cross_agent_tests:
	rm -rf test/lib/cross_agent_tests
	git clone git@source.datanerd.us:newrelic/cross_agent_tests.git test/lib/cross_agent_tests
	rm -rf test/lib/cross_agent_tests/.git
