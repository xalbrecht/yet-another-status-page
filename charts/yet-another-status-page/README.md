# yet-another-status-page

A Helm chart for the [yet-another-status-page](https://github.com/Hostzero-GmbH/yet-another-status-page) — a self-hosted status page built on Payload CMS and Next.js.

## TL;DR

```bash
helm install status oci://ghcr.io/hostzero-gmbh/charts/yet-another-status-page \
  --set serverUrl=https://status.example.com \
  --set secret.payloadSecret=$(openssl rand -hex 32)
```

## Installing

This chart depends on the [bitnami/postgresql](https://github.com/bitnami/charts/tree/main/bitnami/postgresql) subchart. Pull dependencies before packaging:

```bash
helm dependency update charts/yet-another-status-page
```

### Required values

- `serverUrl` — public URL the page is served at (e.g. `https://status.example.com`).
- `secret.payloadSecret` — random 32+ character string used by Payload to sign tokens. Generate with `openssl rand -hex 32`.

### Database options

| Mode | Configuration |
| --- | --- |
| Bundled Postgres (default) | `postgresql.enabled: true`. Subchart manages credentials in `<release>-postgresql`. |
| External DB via secret | `postgresql.enabled: false`, `externalDatabase.existingSecret: my-db`, `externalDatabase.existingSecretKey: DATABASE_URI`. |
| External DB via plain value | `postgresql.enabled: false`, `secret.databaseUri: postgres://...`. |

### Ingress example

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

## Uploads

Media uploaded through the Payload admin is written to `/app/public/media`. By default a PVC of `5Gi` is created (`persistence.enabled: true`). Disable it for stateless deployments behind object storage (e.g. configure `@payloadcms/storage-vercel-blob` via `extraEnv`).

## Values

See [`values.yaml`](./values.yaml) for the full list with inline documentation.
