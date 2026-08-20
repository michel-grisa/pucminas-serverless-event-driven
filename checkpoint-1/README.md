# Mythological Name Generator Serverless Function

A lightweight and highly portable Node.js serverless function that maps a day and a month to unique, stylized mythological name combinations (e.g., `01/08` maps to `diabolic dragon`).

## Local Development & Testing

### 1. Run the Local Simulator
Start the built-in HTTP server:
```bash
npm start
```
By default, the server runs at **http://localhost:3000/**.

#### Try calling it:
* **Specific Day & Month:** [http://localhost:3000/?day=1&month=8](http://localhost:3000/?day=1&month=8)
* **Date string format:** [http://localhost:3000/?date=01/08](http://localhost:3000/?date=01/08)
* **Current Day/Month (fallback):** [http://localhost:3000/](http://localhost:3000/)

#### Example Response (`200 OK`):
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
```
---

## Docker Support

### Build the Image locally
```bash
docker build -t mythological-names-service .
```

### Run the Container locally
```bash
docker run -p 3000:3000 mythological-names-service
```
Open `http://localhost:3000/?date=01/08` in your browser.

## Features

- **No external dependencies:** Fully built on Node.js core modules.
- **Leap-year-aware Date Validation:** Rejects impossible calendar dates (like Feb 30th or April 31st).
- **Flexible Input Parsing:**
  - Standard query parameters: `?day=1&month=8`
  - Combined date query parameter: `?date=01/08` or `?date=01-08` or `?date=2026-08-01`
  - Fallback: Uses the current system date if no query is provided.
- **Multi-Environment Support:**
  - Exported AWS Lambda handler (`handler`)
  - Exported standard HTTP Request/Response handler for Vercel/Google Cloud Functions (`httpHandler` / `default`)
  - Local HTTP server simulation (`npm start`)
  - **Docker Containerized Support** (ideal for GCP Cloud Run or AWS Fargate)

## Name Tables

### Days (1 - 31)
1. diabolic, 2. celestial, 3. shadowy, 4. radiant, 5. ferocious, 6. mystic, 7. venomous, 8. golden, 9. eternal, 10. chaotic, 11. cosmic, 12. silent, 13. haunted, 14. ancient, 15. swift, 16. iron, 17. frost, 18. stormy, 19. emerald, 20. blazing, 21. obsidian, 22. spectral, 23. thunderous, 24. whispering, 25. lunar, 26. solar, 27. wild, 28. grim, 29. phantom, 30. cursed, 31. immortal

### Months (1 - 12)
1. phoenix, 2. griffin, 3. unicorn, 4. basilisk, 5. chimera, 6. gorgon, 7. kraken, 8. dragon, 9. wyvern, 10. werewolf, 11. vampire, 12. valkyrie



---

## Google Cloud Platform (GCP) Cloud Run Deployment

Google Cloud Run is the recommended serverless container service. It automatically scales containers to zero when not in use.

### Step 1: Install & Initialize Google Cloud CLI
Ensure you have the [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and initialized:
```bash
# Log in to your GCP Account
gcloud auth login

# Set your target GCP Project ID
gcloud config set project YOUR_PROJECT_ID
```

### Step 2: Enable Required GCP APIs
Enable both Artifact Registry (where your image lives) and Cloud Run (where your container runs):
```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

### Step 3: Create an Artifact Registry Repository
Create a repository for your Docker image. Replace `us-central1` with your preferred region:
```bash
gcloud artifacts repositories create mythological-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository for mythological names service"
```

### Step 4: Configure Docker Authentication
Configure your local Docker setup to seamlessly authenticate with Google Artifact Registry:
```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Step 5: Build, Tag, and Push the Docker Image
Build the container for production and tag it with the registry path, then push it to Google Cloud:

```bash
# Define variable parameters
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
REPO="mythological-repo"
IMAGE_NAME="names-service"
TAG="latest"

# 1. Build and tag the image
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE_NAME}:${TAG} .

# 2. Push the image to GCP Artifact Registry
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE_NAME}:${TAG}
```

### Step 6: Deploy to Google Cloud Run
Deploy the pushed container image to Cloud Run:
```bash
gcloud run deploy mythological-names-service \
    --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE_NAME}:${TAG} \
    --region=${REGION} \
    --allow-unauthenticated \
    --port=3000
```

### Step 7: Access Your Deployed Serverless Service
Upon successful deployment, the gcloud CLI will output a Service URL, such as:
`https://mythological-names-service-xxxxxx.a.run.app`

Append query parameters to test it:
`https://mythological-names-service-xxxxxx.a.run.app/?date=01/08`
