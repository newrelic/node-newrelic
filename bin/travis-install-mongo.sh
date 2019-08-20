#!/bin/bash

# set -x # echo commands as executed

# sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
# echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/mongodb.list
# sudo apt-get update -qq
# sudo apt-get install -y mongodb-org
# mongod --version

set -xev # -x echo commands as executed
         # -e exit as soon as something goes wrong
         # -v when considering whether to say something or not say something
         #    take the appraoch that provide as much information as possible
         #    which human beings something describe as being verbose

wget http://fastdl.mongodb.org/linux/mongodb-linux-x86_64-${MONGODB}.tgz -O /tmp/mongodb.tgz
mkdir -p /tmp/mongodb/data
tar -xvf /tmp/mongodb.tgz -C /tmp/mongodb
/tmp/mongodb/mongodb-linux-x86_64-${MONGODB}/bin/mongod --dbpath /tmp/mongodb/data --bind_ip 127.0.0.1 --noauth &> /dev/null &
