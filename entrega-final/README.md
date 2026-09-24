# Entrega Final — API de avaliações e recomendações de filmes

Este projeto entrega uma API serverless em Node.js para consultar avaliações de filmes em múltiplas fontes externas e complementar a resposta com recomendações inteligentes geradas por um modelo Gemini. A solução foi implementada com Google Cloud Functions, Google Cloud Workflows e automação de deploy por GitHub Actions.

## Visão geral

A aplicação recebe um título de filme, consulta dados de avaliação em duas APIs externas e retorna uma resposta estruturada. Além disso, ele gera três recomendações com base no filme buscado, sempre em português, mantendo regras de responsabilidade e segurança para não sugerir conteúdo impróprio, ofensivo ou preconceituoso.

O objetivo da arquitetura foi combinar simplicidade de desenvolvimento com separação de responsabilidades, observabilidade e facilidade de deploy em ambiente real.

## Arquitetura

A solução é organizada em camadas:

1. Camada de entrada
   - A API HTTP recebe requisições GET ou POST.
   - Extrai o parâmetro do filme a partir de `movie`, `title` ou `name`.
   - Normaliza e valida o nome informado.

2. Camada de integração externa
   - TMDB: consulta metadados e avaliação do filme.
   - OMDb: consulta detalhes complementares e nota IMDb.
   - Gemini: gera sugestões relevantes e bem justificadas.

3. Camada de orquestração
   - Google Cloud Workflows coordena as chamadas externas em sequência.
   - Isso reduz acoplamento entre a aplicação e as integrações, além de facilitar manutenção.

4. Camada de automação
   - GitHub Actions valida o código, instala dependências, executa testes e faz deploy no Google Cloud.
   - O deploy usa autenticação via Workload Identity Federation, sem armazenar chaves JSON no repositório.

## Decisões técnicas e justificativas

### 1. Node.js para a API serverless
O projeto foi implementado em Node.js porque é leve, rápido para desenvolver APIs HTTP e bem adequado para integrações assíncronas com serviços externos.

### 2. Cloud Functions Gen2
A função HTTP foi implantada em Cloud Functions Gen2 por ser a solução mais simples para expor um endpoint serverless com baixa operação e escalabilidade automática. Isso evita manter infraestrutura dedicada e reduz a complexidade operacional.

### 3. Workflows para orquestração
A orquestração em Google Cloud Workflows foi escolhida para isolar a lógica que compõe a resposta final. Em vez de centralizar tudo na função HTTP, o fluxo fica mais claro, mais fácil de auditar e mais resiliente a mudanças futuras.

### 4. Integração com Gemini
A recomendação com IA foi adicionada para oferecer um diferencial útil para o usuário. A decisão foi gerar apenas três sugestões, em um JSON estruturado, com um prompt específico para manter o conteúdo responsável e alinhado ao gosto do filme buscado. O objetivo foi evitar uso excessivo do modelo, mantendo o projeto acessível e didático.

### 5. Secrets no GitHub Actions
Todas as chaves foram tratadas como repository secrets e não foram incluídas no código. Isso reduz riscos de vazamento e mantém o processo de deploy adequado para ambiente real.

### 6. Workload Identity Federation
Em vez de usar credenciais estáticas de conta de serviço em JSON, o deploy usa OIDC com Workload Identity Federation. Isso melhora a segurança porque a autenticação é temporária e não depende de um arquivo fixo no repositório.

### 7. Observabilidade
Os logs estruturados foram mantidos para registrar início e fim de requisições, falhas em APIs externas e erros em workflows. Isso ajuda muito no diagnóstico de problemas em produção.

## Estrutura do repositório

- `entrega-final/index.js`: aplicação principal, handlers, integrações e lógica de resposta
- `entrega-final/workflow.yaml`: fluxo de orquestração do Google Cloud Workflows
- `entrega-final/test.js`: testes unitários para parse da URL e parsing das recomendações
- `entrega-final/.env.example`: exemplo de variáveis de ambiente
- `.github/workflows/deploy-entrega-final.yml`: pipeline de validação e deploy

## Variáveis de ambiente

As principais variáveis utilizadas são:

- `TMDB_API_KEY`
- `OMDB_API_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `USE_GCP_WORKFLOW`
- `WORKFLOW_ENDPOINT`
- `GCP_PROJECT_ID`
- `GCP_REGION`

O modelo recomendado para o Gemini é:

- `gemini-3.5-flash-lite`

## Fluxo de execução

1. O usuário envia uma requisição com o nome do filme.
2. A função extrai e normaliza o título.
3. O Workflow consulta TMDB e OMDb.
4. O serviço chama o Gemini para gerar recomendações.
5. A resposta final é montada em JSON.
6. O deploy e a validação são automatizados pelo GitHub Actions.

## Como configurar o projeto localmente

1. Copie o exemplo de ambiente:

```bash
cp .env.example .env
```

2. Preencha as chaves reais:

```env
TMDB_API_KEY=sua_chave_tmdb
OMDB_API_KEY=sua_chave_omdb
GEMINI_API_KEY=sua_chave_gemini
GEMINI_MODEL=gemini-3.5-flash-lite
USE_GCP_WORKFLOW=false
WORKFLOW_ENDPOINT=https://workflowexecutions.googleapis.com/v1/projects/SEU_PROJETO/locations/REGION/workflows/NOME_DO_WORKFLOW/executions
```

3. Instale as dependências:

```bash
npm install
```

4. Rode os testes:

```bash
npm test
```

5. Inicie a aplicação localmente:

```bash
node index.js --server
```

6. Faça uma chamada de teste:

```bash
curl "http://localhost:3000/?movie=Inception"
```

## Configuração no GitHub Actions

No GitHub, em Settings > Secrets and variables > Actions, devem existir os secrets abaixo:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `TMDB_API_KEY`
- `OMDB_API_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (opcional, com fallback para `gemini-3.5-flash-lite`)

O workflow usa o padrão de Repository Secrets, respeitando a organização do repositório.

## Deploy

O workflow responsável pelo deploy é:

- `.github/workflows/deploy-entrega-final.yml`

Ele faz:

1. validação do código
2. instalação de dependências
3. execução de testes
4. autenticação no Google Cloud por OIDC
5. deploy do Workflow
6. deploy da Cloud Function
7. smoke test final

## Observações finais

Este projeto foi pensado como uma entrega didática, com foco em arquitetura serverless, integração com APIs externas, uso de IA responsável e pipeline automatizado para produção.

A solução mantém uma boa separação entre aplicação, orquestração e deploy, o que facilita manutenção, evolução e compreensão da arquitetura como um conjunto coeso de decisões técnicas.
