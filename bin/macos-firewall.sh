#!/bin/sh
# Script that adds rules to Mac OS X Socket Firewall to avoid
# popups asking to accept incoming network connections when
# running tests.
#
# This script must be run with elevated privileges, i.e.:
#
#   $ sudo ./macos-firewall.sh
#
# Originally from https://github.com/nodejs/node/blob/5398cb55ca10d34ed7ba5592f95b3b9f588e5754/tools/macos-firewall.sh

SFW="/usr/libexec/ApplicationFirewall/socketfilterfw"
NODE_PATH=$(realpath $(which node))

add_and_unblock () {
  if [ -e "$1" ]
  then
    echo Processing "$1"
    $SFW --remove "$1" >/dev/null
    $SFW --add "$1"
    $SFW --unblock "$1"
  fi
}

if [ -f $SFW ];
then
  add_and_unblock "$NODE_PATH"
else
  echo "SocketFirewall not found in location: $SFW"
fi
