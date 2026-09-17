# Checkpoint 5 - CI/CD com GitHub Actions

Este checkpoint automatiza a validação e o deploy da função de avaliações de filmes no Google Cloud. O pipeline está em [`.github/workflows/deploy-checkpoint-5.yml`](../.github/workflows/deploy-checkpoint-5.yml) e publica o Workflow e a Cloud Function Gen2.

## Fluxo do pipeline

1. Um push na branch `main` que altere `checkpoint-5/**` inicia o workflow.
2. O job `validate` instala as dependências, verifica a sintaxe JavaScript e executa `npm test`.
3. O job `deploy` só começa se a validação for aprovada.
4. O GitHub Actions autentica no GCP usando OIDC e Workload Identity Federation, sem chave JSON no repositório.
5. O Workflow é publicado primeiro.
6. A Cloud Function é publicada com as variáveis de ambiente necessárias.
7. Um smoke test chama a função implantada e falha o pipeline se a resposta HTTP não for bem-sucedida.

O deploy também pode ser iniciado manualmente pela opção **Run workflow** na aba **Actions** do GitHub.

## Configuração no GitHub

No GitHub, abra **Settings > Secrets and variables > Actions** e cadastre os valores diretamente no nível do repositório. Este workflow não exige a criação de um ambiente GitHub chamado `production`:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `GCP_PROJECT_ID` | Secret | Project ID real do GCP, por exemplo `meu-projeto-123` |
| `GCP_REGION` | Secret | Região, por exemplo `us-central1` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Secret | Recurso completo do provider WIF |
| `GCP_DEPLOYER_SERVICE_ACCOUNT` | Secret | E-mail da conta de serviço de deploy |

Crie os segredos:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `TMDB_API_KEY` | Secret | Chave do TMDB |
| `OMDB_API_KEY` | Secret | Chave do OMDb |

O workflow usa exclusivamente os **Repository Secrets** listados acima. Use exatamente esses nomes. Se um valor obrigatório estiver vazio, o job `Validate deployment configuration` interromperá a execução informando qual configuração falta.

O workflow usa diretamente os Secrets `GCP_PROJECT_ID` e `GCP_REGION` dentro do job `deploy`. Antes do `setup-gcloud`, ele limpa qualquer propriedade de projeto herdada pelo runner; depois configura o projeto explicitamente com o valor validado. Variables com os mesmos nomes não são consideradas.

Importante: `GCP_PROJECT_ID` não é o nome/apelido exibido no console e não pode ser `SEU_PROJECT_ID`. Para descobrir o valor correto:

```bash
gcloud projects list --format='table(projectId,name)'
```

Copie o valor da coluna `PROJECT_ID` para o Secret ou Variable `GCP_PROJECT_ID`. Por exemplo, se a saída mostrar `pos-serverless-event-driven` na coluna `PROJECT_ID`, esse é o valor que deve ser cadastrado.

Depois de alterar um Secret, inicie uma nova execução com **Run workflow** ou faça um novo push. Na página da execução, confirme que o **commit** exibido contém a versão atual do arquivo `.github/workflows/deploy-checkpoint-5.yml`; reexecutar uma execução antiga pode usar a definição antiga do workflow.

As chaves só são usadas durante o deploy e não são escritas em arquivos do repositório. Não configure credenciais em `README.md`, `workflow.yaml` ou no código.

## Configurar Workload Identity Federation

O exemplo abaixo deve ser executado por uma pessoa com permissão administrativa no projeto. Substitua os valores antes de executar:

```bash
export PROJECT_ID="SEU_PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
export GITHUB_OWNER="SUA_ORGANIZACAO_OU_USUARIO"
export GITHUB_REPOSITORY="SEU_REPOSITORIO"
export DEPLOYER_SA="github-actions-deployer"
export POOL_ID="github-pool"
export PROVIDER_ID="github-provider"
export REGION="us-central1"

gcloud services enable \
  iamcredentials.googleapis.com \
  iam.googleapis.com \
  sts.googleapis.com \
  cloudfunctions.googleapis.com \
  workflows.googleapis.com \
  workflowexecutions.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

gcloud iam service-accounts create "$DEPLOYER_SA" \
  --project="$PROJECT_ID" \
  --display-name="GitHub Actions deployer"

gcloud iam workload-identity-pools create "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --display-name="GitHub Actions pool"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub provider" \
  --issuer-uri="https://token.actions.githubusercontent.com/" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository == '${GITHUB_OWNER}/${GITHUB_REPOSITORY}'"

export SERVICE_ACCOUNT="${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT" \
  --project="$PROJECT_ID" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_OWNER}/${GITHUB_REPOSITORY}"
```

Esse binding permite que o repositório federado gere o token temporário da conta de serviço. A permissão `iam.serviceAccounts.getAccessToken` já faz parte de `roles/iam.workloadIdentityUser`; não conceda `roles/iam.serviceAccountTokenCreator` neste fluxo direto sem uma necessidade adicional de impersonação.

Para verificar o binding aplicado:

```bash
gcloud iam service-accounts get-iam-policy "$SERVICE_ACCOUNT" \
  --project="$PROJECT_ID" \
  --format=json
```

Confirme que o resultado contém exatamente este membro, usando o owner e o nome real do repositório:

```text
principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/attribute.repository/GITHUB_OWNER/GITHUB_REPOSITORY
```

Se o binding estiver ausente ou diferente, execute novamente o comando acima. O `PROJECT_NUMBER` deve ser o número do mesmo projeto que contém o pool WIF, e `GITHUB_REPOSITORY` deve ser somente o nome do repositório, sem duplicar o owner.

Conceda à conta de serviço apenas as permissões necessárias ao deploy. Uma configuração inicial comum para este projeto é:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role=roles/cloudfunctions.developer

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role=roles/workflows.editor

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role=roles/serviceusage.serviceUsageConsumer

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role=roles/run.admin

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role=roles/artifactregistry.writer

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role=roles/iam.serviceAccountUser
```

O deploy de Cloud Functions Gen2 também pode exigir permissões para Cloud Build, Artifact Registry e a conta de serviço de runtime. Ajuste essas permissões conforme a política da organização, evitando `roles/owner`.

O valor da variável `GCP_WORKLOAD_IDENTITY_PROVIDER` deve ser o resultado de:

```bash
gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --format='value(name)'
```

O valor de `GCP_DEPLOYER_SERVICE_ACCOUNT` é:

```text
github-actions-deployer@SEU_PROJECT_ID.iam.gserviceaccount.com
```

## Evidência da execução

Após configurar os valores, faça um commit na branch `main` ou use **Run workflow**. A evidência da entrega deve mostrar:

- Job `validate` concluído com sucesso.
- Autenticação Google Cloud concluída sem uso de chave JSON.
- Etapas `Deploy Workflow` e `Deploy Cloud Function` concluídas.
- `Smoke test deployed function` retornando a resposta da função.
- Hash do commit e data da execução visíveis no GitHub Actions.

Na aba **Actions**, abra a execução do workflow e capture um screenshot dos jobs verdes e outro dos logs de deploy. Não publique valores de secrets nos screenshots.

## Links úteis

- [GitHub Actions](https://docs.github.com/actions)
- [Autenticação GCP com GitHub Actions](https://github.com/google-github-actions/auth)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Cloud Functions Gen2](https://cloud.google.com/functions/docs/2nd-gen/deploy)
- [Cloud Workflows](https://cloud.google.com/workflows/docs/deploying-workflow)

A observabilidade implementada no checkpoint anterior é preservada: os logs estruturados continuam sendo enviados ao Cloud Logging após cada deploy.
