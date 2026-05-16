{{/*
Expand the name of the chart.
*/}}
{{- define "yasp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "yasp.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label value.
*/}}
{{- define "yasp.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "yasp.labels" -}}
helm.sh/chart: {{ include "yasp.chart" . }}
{{ include "yasp.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: yet-another-status-page
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "yasp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "yasp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: status-page
{{- end }}

{{/*
Service account name.
*/}}
{{- define "yasp.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "yasp.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Container image (repo:tag).
*/}}
{{- define "yasp.image" -}}
{{- $tag := .Values.image.tag | default (printf "v%s" .Chart.AppVersion) }}
{{- printf "%s:%s" .Values.image.repository $tag }}
{{- end }}

{{/*
Name of the secret holding PAYLOAD_SECRET and DATABASE_URI.
*/}}
{{- define "yasp.secretName" -}}
{{- if .Values.existingSecret }}
{{- .Values.existingSecret }}
{{- else }}
{{- include "yasp.fullname" . }}
{{- end }}
{{- end }}

{{/*
DATABASE_URI for the in-chart bitnami/postgresql subchart.
Mirrors the subchart's connection string conventions.
*/}}
{{- define "yasp.bundledDatabaseUri" -}}
{{- $pg := .Values.postgresql -}}
{{- $user := $pg.auth.username -}}
{{- $db := $pg.auth.database -}}
{{- $host := printf "%s-postgresql.%s.svc.cluster.local" .Release.Name .Release.Namespace -}}
{{- printf "postgresql://%s:$(POSTGRES_PASSWORD)@%s:5432/%s" $user $host $db -}}
{{- end }}
