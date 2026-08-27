# Checkpoint 2 - Mensageria na Nuvem com GCP Pub/Sub

Este projeto contém uma arquitetura baseada em eventos e mensageria que resolve nomes mitológicos baseados em datas. Ele é dividido em duas partes fundamentais que se comunicam de forma assíncrona utilizando o **Google Cloud Pub/Sub**:
1. **Produtor (Publisher / Postador)**: Envia payloads com dados de datas para um tópico do Pub/Sub.
2. **Consumidor (Worker / Receptor)**: Escuta uma subscrição (fila de mensagens), resolve os nomes mitológicos com base na data recebida e loga o resultado.

## Provedor Utilizado
* GCP (Google Cloud Platform)

---

## Configurando o serviço Pub/Sub no GCP via Linha de Comando (`gcloud` CLI)

Para rodar este projeto com uma conexão real na nuvem, você precisará de um Tópico e uma Subscrição criados no Google Cloud Pub/Sub, além de uma Conta de Serviço com as permissões corretas. Abaixo estão os comandos necessários utilizando a ferramenta de linha de comando **gcloud CLI**:

### Passo a passo:

1. **Defina o seu ID do Projeto no GCP:**
   ```bash
   # Substitua pelo ID real do seu projeto GCP
   export PROJECT_ID="seu-projeto-id"
   gcloud config set project $PROJECT_ID
   ```

2. **Criar o Tópico (Topic):**
   ```bash
   gcloud pubsub topics create my-topic
   ```

3. **Criar a Subscrição (Subscription):**
   ```bash
   gcloud pubsub subscriptions create my-sub --topic=my-topic
   ```

4. **Criar Autenticaçâo Local:**
   gcloud auth application-default login
   ```

---

## Como rodar localmente

### Pré-requisitos
* Node.js instalado (versão 22 ou superior)
* Dois terminais de comandos abertos (um para o produtor e outro para o consumidor)
* Chave JSON da conta de serviço GCP obtida no passo anterior (`key.json`)

### Passo a passo

1. **Entre na pasta do Checkpoint 2:**
   ```bash
   cd checkpoint-2
   ```

2. **Instale as dependências do projeto:**
   ```bash
   npm install
   ```

3. **Configure as Variáveis de Ambiente:**
   Você precisará apontar o caminho do arquivo JSON da conta de serviço e os nomes do tópico e da subscrição. No terminal, configure:

   * **No Linux/macOS:**
     ```bash
     export GOOGLE_APPLICATION_CREDENTIALS="/caminho/para/o/seu/key.json"
     export INPUT_SUBSCRIPTION="my-sub"
     export OUTPUT_TOPIC="my-topic"
     ```
   * **No Windows (Command Prompt):**
     ```cmd
     set GOOGLE_APPLICATION_CREDENTIALS=C:\caminho\para\o\seu\key.json
     set INPUT_SUBSCRIPTION=my-sub
     set OUTPUT_TOPIC=my-topic
     ```
   * **No Windows (PowerShell):**
     ```powershell
     $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\para\o\seu\key.json"
     $env:INPUT_SUBSCRIPTION="my-sub"
     $env:OUTPUT_TOPIC="my-topic"
     ```

4. **Rodar os Scripts Localmente (Produtor e Consumidor)**

   Para demonstrar o fluxo completo de publicação e recebimento de mensagens, utilizaremos dois terminais ativos (certifique-se de configurar as variáveis de ambiente em ambos os terminais).

   #### Terminal 1: Iniciar o Consumidor (Worker/Receptor)
   O consumidor ficará ativamente ouvindo a subscrição por novas mensagens:
   ```bash
   npm start
   ```
   *(Executa o script `index.js` que se conecta ao Pub/Sub e fica aguardando e processando mensagens em tempo real)*

   #### Terminal 2: Iniciar o Produtor (Publisher/Postador)
   Com o consumidor rodando no Terminal 1, use o segundo terminal para postar mensagens no tópico do Pub/Sub:

   * **Postar com uma data específica:**
     ```bash
     npm run publish -- --date=01/08
     ```
   * **Postar com dia e mês explícitos:**
     ```bash
     npm run publish -- --day=25 --month=12
     ```
   * **Postar sem argumentos (usa a data atual de hoje):**
     ```bash
     npm run publish
     ```

   #### Como funciona a comunicação:
   1. O script `publisher.js` é executado no **Terminal 2**, resolve e valida a data passada nos argumentos, empacota os dados em formato JSON e os publica no tópico do Pub/Sub.
   2. O script `index.js` (Worker) rodando no **Terminal 1** detecta a nova mensagem na assinatura `my-sub`, puxa a mensagem (pull), decodifica o payload JSON, resolve os nomes mitológicos correspondentes e os exibe no console.
   3. Após o processamento correto, o Worker faz o "Ack" (confirmação de recebimento) para retirar a mensagem da fila.

---
