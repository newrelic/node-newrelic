While working on tests that target amqplib, it is possible that a debugging
session will leave stale messages in the datastore. This can cause future runs
of the test to fail if the test is expecting only specific messages to be in
the queue. This problem can be solved by either restarting the container
between runs (slow, but effective), or by utilizing the `rabbitmqadmin` tool
to purge messages:

```sh
docker exec -it nr_node_rabbit /bin/bash
# List out available queues
rabbitmqadmin list queues
# Get the current messages in a queue named "testQueue"
rabbitmqadmin get queue=testQueue
# Purge all messages in the queue named "testQueue"
rabbitmqadmin purge queue name=testQueue
```

You may also find that you need to inspect the data in a queue more closely
than the `get queue=` command above allows. For this task, you can use the
"Qu Desktop" application. It is available at https://qu.barbaleon.co.uk/.
Simple define a new connection with "guest" as the username and password.
