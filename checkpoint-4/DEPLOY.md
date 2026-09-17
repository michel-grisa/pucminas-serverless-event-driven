# Deploy do Checkpoint 4 no Google Cloud

Este guia publica o Workflow e a função HTTP no GCP. Execute os comandos a partir da pasta `checkpoint-4`.

## 1. Pré-requisitos

Instale e autentique o Google Cloud CLI:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project SEU_PROJECT_ID
```

Defina as variáveis usadas nos comandos:

```bash
export PROJECT_ID="SEU_PROJECT_ID"
export REGION="us-central1"
export FUNCTION_NAME="movie-ratings-function"
export WORKFLOW_NAME="movie-ratings-workflow"
gcloud config set project "$PROJECT_ID"
```

Confirme que o projeto e a região estão corretos antes de continuar:

```bash
gcloud config get-value project
printf 'Regiao: %s\n' "$REGION"
```

## 2. Habilitar APIs

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  workflows.googleapis.com \
  workflowexecutions.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com
```

## 3. Preparar as variáveis sensíveis

Nunca coloque chaves reais no GitHub, no `README` ou diretamente no `workflow.yaml`. Crie arquivos temporários locais e confira que eles não serão enviados ao Git:

`.env.function.yaml`:

```yaml
TMDB_API_KEY: "SUA_CHAVE_TMDB"
OMDB_API_KEY: "SUA_CHAVE_OMDB"
USE_GCP_WORKFLOW: "true"
WORKFLOW_ENDPOINT: "https://workflowexecutions.googleapis.com/v1/projects/SEU_PROJECT_ID/locations/us-central1/workflows/movie-ratings-workflow/executions"
```

`.env.workflow.yaml`:

```yaml
TMDB_API_KEY: "SUA_CHAVE_TMDB"
OMDB_API_KEY: "SUA_CHAVE_OMDB"
```

Esses arquivos são ignorados pela regra `.env.*` do projeto. Para um ambiente real, prefira Secret Manager e conceda somente as permissões necessárias às identidades da função e do Workflow.

## 4. Publicar o Workflow

```bash
gcloud workflows deploy "$WORKFLOW_NAME" \
  --source=workflow.yaml \
  --location="$REGION" \
  --env-vars-file=.env.workflow.yaml
```

A URL usada pela função é:

```text
https://workflowexecutions.googleapis.com/v1/projects/SEU_PROJECT_ID/locations/REGION/workflows/NOME_DO_WORKFLOW/executions
```

Substitua os valores no `.env.function.yaml` pelo projeto, região e nome reais do Workflow.

## 5. Publicar a função

```bash
gcloud functions deploy "$FUNCTION_NAME" \
  --gen2 \
  --runtime=nodejs22 \
  --region="$REGION" \
  --source=. \
  --entry-point=httpHandler \
  --trigger-http \
  --allow-unauthenticated \
  --env-vars-file=.env.function.yaml
```

O deploy retorna a URL HTTPS da função. Guarde essa URL apenas no ambiente local ou em um gerenciador de segredos.

## 6. Testar o deploy

Obtenha a URL publicada:

```bash
FUNCTION_URL="$(gcloud functions describe "$FUNCTION_NAME" \
  --gen2 --region="$REGION" \
  --format='value(serviceConfig.uri)')"
printf '%s\n' "$FUNCTION_URL"
```

Teste uma requisição válida e uma requisição inválida:

```bash
curl --fail-with-body "$FUNCTION_URL?movie=Inception"
curl --fail-with-body "$FUNCTION_URL"
```

A primeira chamada deve retornar `success: true`. A segunda deve retornar HTTP 400, gerando evidência de sucesso e erro no Cloud Logging.

## 7. Conferir os logs

```bash
gcloud logging read \
  'jsonPayload.service="movie-ratings-function"' \
  --project="$PROJECT_ID" \
  --limit=20 \
  --format=json
```

No console, abra **Logging > Logs Explorer** e filtre:

```text
jsonPayload.service="movie-ratings-function"
```

Para a evidência de sucesso:

```text
jsonPayload.event="request.completed"
```

Para a evidência de erro:

```text
jsonPayload.event="request.failed" OR jsonPayload.event="external_api.failed" OR jsonPayload.event="workflow.failed"
```

Os campos `severity`, `event`, `status_code`, `source` e `duration_ms` devem aparecer nos detalhes do log.

## 8. Criar e consultar métricas

Crie as métricas uma única vez:

```bash
gcloud logging metrics create movie_ratings_requests_total \
  --description="Total de requisicoes concluídas" \
  --log-filter='jsonPayload.event="request.completed"'

gcloud logging metrics create movie_ratings_errors_total \
  --description="Total de erros da aplicacao" \
  --log-filter='jsonPayload.event="request.failed" OR jsonPayload.event="external_api.failed" OR jsonPayload.event="workflow.failed"'

gcloud logging metrics create movie_ratings_latency_ms \
  --description="Latencia das requisicoes em milissegundos" \
  --log-filter='jsonPayload.event="request.completed"' \
  --value-extractor='EXTRACT(jsonPayload.duration_ms)' \
  --metric-kind=DELTA \
  --value-type=DISTRIBUTION
```

Se uma métrica já existir, o comando retornará erro informando que ela já foi criada. Nesse caso, continue para o Metrics Explorer.

Abra **Monitoring > Metrics Explorer** e selecione:

```text
logging.googleapis.com/user/movie_ratings_requests_total
logging.googleapis.com/user/movie_ratings_errors_total
logging.googleapis.com/user/movie_ratings_latency_ms
```

Tire prints do Logs Explorer e do Metrics Explorer mostrando o projeto, o período, os eventos e os valores das métricas. Não inclua chaves, tokens, arquivos `.env` ou arquivos YAML com valores reais.

## 9. Limpeza local

Depois do deploy, remova os arquivos temporários que contêm chaves:

```bash
rm -f .env.function.yaml .env.workflow.yaml
```

As métricas e os logs permanecem no GCP. Para evitar custos desnecessários, revise a retenção dos logs e remova recursos de teste quando a apresentação terminar.
