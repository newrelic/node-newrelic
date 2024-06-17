This directory contains resources for Docker containers that are used in
our versioned tests. A typical case would be to mount a directory as a volume.
For example:

```yaml
  mysql:
    container_name: nr_node_mysql
    platform: ${DOCKER_PLATFORM:-linux/amd64}
    image: mysql:8.3
    volumes:
      - "./docker/mysql:/etc/mysql/conf.d"
    ports:
      - "3306:3306"
    environment:
      MYSQL_ALLOW_EMPTY_PASSWORD: 1
    healthcheck:
      test: ["CMD", "mysql" ,"-h", "mysql", "-P", "3306", "-u", "root", "-e", "SELECT 1"]
      interval: 1s
      timeout: 10s
      retries: 30
```
