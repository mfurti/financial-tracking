FROM postgres:17-bookworm
ARG VCS_REF=development
LABEL org.opencontainers.image.source="https://github.com/mfurti/financial-tracking" \
      org.opencontainers.image.revision="$VCS_REF"
RUN apt-get update && apt-get install -y --no-install-recommends age && rm -rf /var/lib/apt/lists/*
COPY backup.sh restore.sh prune-backups.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/prune-backups.sh
ENTRYPOINT ["bash", "-c", "while true; do /usr/local/bin/backup.sh || echo 'backup failed' >&2; sleep 86400; done"]
