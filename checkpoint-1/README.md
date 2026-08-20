# Checkpoint 1 - Função Serverless na Nuvem

Este projeto contém uma função serverless simples que gera nomes mitológicos baseados em datas, responde a requisições HTTP e foi implantada em ambiente de nuvem.

## Provedor Utilizado
* GCP (Google Cloud Platform)

## Como rodar localmente

### Pré-requisitos
* Node.js instalado (versão 18 ou superior)
* Terminal de comandos aberto

### Passo a passo
1. Clone o repositório para sua máquina:
   ```bash
   git clone https://github.com/seu-usuario/cloud-serverless-checkpoint1.git
   ```

2. Entre na pasta do projeto:
   ```bash
   cd cloud-serverless-checkpoint1
   ```

3. Instale as dependências do projeto:
   ```bash
   npm install
   ```

4. Rode o servidor de testes local:
   ```bash
   npm start
   ```

Por padrão, o servidor roda em **http://localhost:3000/**.

#### Exemplos de chamadas:
* **Dia e Mês específicos:** [http://localhost:3000/?day=1&month=8](http://localhost:3000/?day=1&month=8)
* **Formato de data string:** [http://localhost:3000/?date=01/08](http://localhost:3000/?date=01/08)
* **Data atual (fallback):** [http://localhost:3000/](http://localhost:3000/)

#### Exemplo de Resposta (`200 OK`):
```json
{
  "success": true,
  "day": 1,
  "month": 8,
  "dayName": "diabolic",
  "monthName": "dragon",
  "combinedName": "diabolic dragon",
  "resolvedAt": "2026-08-19T14:30:00.000Z",
  "source": "date parameter (01/08)"
}
```,old_string:
---
