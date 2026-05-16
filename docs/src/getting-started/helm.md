# Helm (Recommended)

The recommended way to deploy Yet Another Status Page in production is the official Helm chart, published as an OCI artifact to GitHub Container Registry. It bundles an optional PostgreSQL subchart, supports Ingress + TLS, persistent media uploads, NetworkPolicy, PodDisruptionBudget, and external databases.

## Prerequisites

- A Kubernetes cluster `>= 1.25`
- [Helm](https://helm.sh/) `>= 3.8` (required for OCI registries)
- `kubectl` configured for your cluster

### Install / update Helm

```bash
# macOS (Homebrew)
brew install helm
brew upgrade helm

# Linux (script)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify
helm version
```

## Quick install

```bash
# 1. Create a namespace
kubectl create namespace status

# 2. Generate a Payload secret (32+ chars)
PAYLOAD_SECRET=$(openssl rand -hex 32)

# 3. Install the chart
helm upgrade --install status \
  oci://ghcr.io/hostzero-gmbh/charts/yet-another-status-page \
  --namespace status \
  --set serverUrl=https://status.example.com \
  --set secret.payloadSecret="$PAYLOAD_SECRET"
```

The chart pulls the matching application image (`ghcr.io/hostzero-gmbh/yet-another-status-page:v<chart appVersion>`) and provisions a PostgreSQL StatefulSet via the bitnami subchart. After a minute or two, the deployment becomes ready and the admin panel is reachable at `<serverUrl>/admin`.

## Updating

To upgrade to a newer chart and matching application version:

```bash
# Pin to a specific version (recommended for production)
helm upgrade status \
  oci://ghcr.io/hostzero-gmbh/charts/yet-another-status-page \
  --namespace status \
  --version 1.2.3 \
  --reuse-values
```

`--reuse-values` keeps your existing configuration. Drop it (and pass the same `--set ...` / `-f values.yaml` flags) if you want to change configuration during the upgrade.

To list available chart versions:

```bash
helm search repo oci://ghcr.io/hostzero-gmbh/charts/yet-another-status-page --versions
```

To roll back:

```bash
helm history status -n status
helm rollback status <revision> -n status
```

## Configuration

All options are documented inline in the chart's [`values.yaml`](https://github.com/Hostzero-GmbH/yet-another-status-page/blob/main/charts/yet-another-status-page/values.yaml). Common patterns:

### Required

```yaml
serverUrl: https://status.example.com
secret:
  payloadSecret: "<32+ random characters>"
```

### Ingress with cert-manager

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: status.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: status-tls
      hosts:
        - status.example.com
```

### External PostgreSQL

Disable the bundled subchart and point at your own database:

```yaml
postgresql:
  enabled: false

externalDatabase:
  existingSecret: status-db
  existingSecretKey: DATABASE_URI
```

The referenced secret must contain a key with a full `postgresql://user:password@host:5432/dbname` URI.

### Media uploads

Files uploaded through the Payload admin land in `/app/public/media`. By default the chart provisions a `5Gi` `ReadWriteOnce` PVC. Increase or disable it via `persistence.size` / `persistence.enabled`. For multi-replica deployments, switch to object storage (e.g. configure `@payloadcms/storage-vercel-blob` via `extraEnv`) or use a `ReadWriteMany` storage class.

### Hardening

```yaml
networkPolicy:
  enabled: true        # restricts egress to DNS, Postgres, SMTP, HTTPS

podDisruptionBudget:
  enabled: true
  minAvailable: 1

replicaCount: 2        # requires RWX persistence or external storage
```

## Backup and restore

When using the bundled PostgreSQL:

```bash
# Backup
kubectl exec -n status status-postgresql-0 -- \
  env PGPASSWORD=$(kubectl get secret -n status status-postgresql -o jsonpath='{.data.password}' | base64 -d) \
  pg_dump -U hostzero hostzero_status > backup.sql

# Restore
kubectl exec -i -n status status-postgresql-0 -- \
  env PGPASSWORD=$(kubectl get secret -n status status-postgresql -o jsonpath='{.data.password}' | base64 -d) \
  psql -U hostzero hostzero_status < backup.sql
```

For the media PVC, snapshot it via your CSI driver or copy out with `kubectl cp`.

## Uninstall

```bash
helm uninstall status -n status

# PVCs are intentionally retained. Remove them explicitly if desired:
kubectl delete pvc -n status -l app.kubernetes.io/instance=status
```
