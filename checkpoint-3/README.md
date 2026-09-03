# Checkpoint 3-1 - Movie Ratings Serverless Function

Esta função em Node.js recebe o nome de um filme e retorna as notas obtidas no TMDB e no OMDb.

## Requisitos

- Node.js
- GCP (Google Cloud Platform)
- GCP Workflows habilitado
- Chaves de API do TMDB e OMDb
- Variáveis de ambiente configuradas em um arquivo .env

## Estrutura

- `index.js` - função HTTP/Cloud Function em Node.js
- `workflow.yaml` - workflow do GCP para orquestrar chamadas externas
- `.env` - variáveis locais sensíveis
- `.env.example` - modelo para configuração local
- `.gitignore` - garante que senhas e chaves não entrem no Git

## Variáveis de ambiente

Copie o modelo e ajuste os valores:

```bash
cp .env.example .env
```

Exemplo:

```env
PORT=3000
TMDB_API_KEY=seu_token_tmdb
OMDB_API_KEY=seu_token_omdb
USE_GCP_WORKFLOW=false
WORKFLOW_ENDPOINT=https://workflowexecutions.googleapis.com/v1/projects/SEU_PROJETO/locations/REGION/workflows/NOME_DO_WORKFLOW/executions
GCP_PROJECT_ID=seu_projeto_gcp
GCP_REGION=us-central1
```

## Executar localmente

```bash
npm install
npm start
```

Exemplo de chamada:

```bash
curl "http://localhost:3000/?movie=Inception"
```

## Como a função funciona

1. A função recebe o parâmetro `movie` na URL ou no corpo da requisição.
2. Verifica se `USE_GCP_WORKFLOW=true`.
3. Se estiver habilitado, invoca um Google Cloud Workflow.
4. Senão, chama as APIs do TMDB e OMDb diretamente.
5. Retorna um JSON contendo as avaliações e metadados do filme.

## Deploy no GCP

### 1) Habilitar APIs

```bash
gcloud services enable cloudfunctions.googleapis.com workflowexecutions.googleapis.com run.googleapis.com
```

### 2) Criar o workflow via gcloud

```bash
gcloud workflows deploy movie-ratings-workflow \
  --source=workflow.yaml \
  --location=us-central1
```

### 3) Publicar a Cloud Function

```bash
gcloud functions deploy movie-ratings-function \
  --gen2 \
  --runtime=nodejs22 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point=httpHandler \
  --region=us-central1 \
  --source=.
```

> Ajuste os valores conforme seu projeto GCP. O arquivo `.env` não deve ser enviado para o repositório público.

## Observação

Esta implementação foi montada como estudo de aprendizado, sem foco em testes automatizados, conforme solicitado.
