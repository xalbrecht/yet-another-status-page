# Installation

Yet Another Status Page can be deployed in several ways. The **recommended** path is the Helm chart on Kubernetes; everything else is provided for evaluation, single-host self-hosting, or managed PaaS users.

## Prerequisites

| Path | Requires |
| --- | --- |
| Helm (recommended) | Kubernetes >= 1.25, Helm >= 3.8, `kubectl` |
| Docker Compose | Docker + Docker Compose |
| From source | Node.js 20+, PostgreSQL 15+ |
| Vercel | A Vercel account |

## Option 1: Helm (Recommended)

The official chart is published as an OCI artifact on GitHub Container Registry. Read the full [Helm guide](helm.md) for configuration details.

```bash
kubectl create namespace status

helm upgrade --install status \
  oci://ghcr.io/hostzero-gmbh/charts/yet-another-status-page \
  --namespace status \
  --set serverUrl=https://status.example.com \
  --set secret.payloadSecret=$(openssl rand -hex 32)
```

Why Helm:

- Built-in Postgres subchart (or bring-your-own via `externalDatabase.existingSecret`)
- Ingress + TLS, NetworkPolicy, PodDisruptionBudget, persistent media uploads
- Versioned chart releases that match the application image tag
- Atomic upgrades and rollbacks (`helm rollback`)

## Option 2: Vercel (One-Click)

Deploy instantly to Vercel with a managed PostgreSQL database:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHostzero-GmbH%2Fyet-another-status-page&env=PAYLOAD_SECRET&envDescription=Required%20environment%20variables%20for%20Yet%20Another%20Status%20Page&envLink=https%3A%2F%2Fhostzero-gmbh.github.io%2Fyet-another-status-page%2Fgetting-started%2Fconfiguration%2F&project-name=yet-another-status-page&repository-name=yet-another-status-page&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

This will:

1. Create a new Vercel project
2. Provision a Vercel Postgres database
3. Prompt you to set `PAYLOAD_SECRET` (generate a random 32+ character string)

All configuration (site name, logos, services, notifications) is done through the admin panel — no code changes required.

## Option 3: Docker Compose (single host)

Suitable for evaluation or small self-hosted setups. See the [Docker Compose guide](../development/docker-compose.md).

```bash
git clone https://github.com/Hostzero-GmbH/yet-another-status-page.git
cd yet-another-status-page

cp .env.example .env
# Edit .env: PAYLOAD_SECRET, POSTGRES_PASSWORD, SERVER_URL

docker compose up -d
```

## Option 4: Pre-built Docker image (BYO Postgres)

```bash
docker run -d \
  --name status-page \
  -p 3000:3000 \
  -e DATABASE_URI=postgres://user:pass@host:5432/db \
  -e PAYLOAD_SECRET=$(openssl rand -hex 32) \
  -e SERVER_URL=https://status.example.com \
  ghcr.io/hostzero-gmbh/yet-another-status-page:latest
```

## Option 5: Build from source

```bash
git clone https://github.com/Hostzero-GmbH/yet-another-status-page.git
cd yet-another-status-page
npm install
npm run build
npm start
```

## First-Time Setup

1. **Access the admin panel** at `<serverUrl>/admin`.
2. **Create the first admin user** when prompted.
3. **Configure the site** under:
   - Configuration → Site Settings (name, description, favicon, logos)
   - Configuration → Email Settings (SMTP)
   - Configuration → SMS Settings (Twilio)
4. **Add services** by creating service groups and services that represent your infrastructure.
5. **Go live** at `<serverUrl>`.
