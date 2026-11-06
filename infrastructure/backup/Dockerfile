FROM postgres:17-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends age && rm -rf /var/lib/apt/lists/*
COPY backup.sh restore.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/backup.sh /usr/local/bin/restore.sh
ENTRYPOINT ["bash", "-c", "while true; do /usr/local/bin/backup.sh || echo 'backup failed' >&2; sleep 86400; done"]
