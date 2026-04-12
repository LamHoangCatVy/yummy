# Deploy YUMMY — Không cần Docker local

## Bước 1 — Push code lên GitHub

```bash
git add .
git commit -m "ready to deploy"
git push origin main
```

## Bước 2 — Tạo Docker Hub account + repo

1. Vào [hub.docker.com](https://hub.docker.com) → Sign up (miễn phí)
2. Tạo repo tên `yummy` (public)
3. Vào Account Settings → Security → **New Access Token** → copy token

## Bước 3 — Thêm secrets vào GitHub repo

Vào GitHub repo → Settings → Secrets → Actions → New secret:

| Secret name | Giá trị |
|-------------|---------|
| `DOCKERHUB_USERNAME` | username Docker Hub của bạn |
| `DOCKERHUB_TOKEN` | token vừa tạo ở bước 2 |

## Bước 4 — Chạy GitHub Actions

Vào tab **Actions** trên GitHub → chọn workflow **Build & Push Docker Image** → **Run workflow**

Đợi ~5 phút → image sẽ có tại `yourusername/yummy:latest` trên Docker Hub.

---

## Deploy lên AWS App Runner (từ Docker Hub image)

```bash
# Cần AWS CLI + đã configure credentials
AWS_ACCOUNT=123456789012
AWS_REGION=us-east-1
DOCKER_IMAGE=yourusername/yummy:latest

aws apprunner create-service \
  --service-name yummy \
  --source-configuration "{
    \"ImageRepository\": {
      \"ImageIdentifier\": \"$DOCKER_IMAGE\",
      \"ImageRepositoryType\": \"ECR_PUBLIC\",
      \"ImageConfiguration\": {
        \"Port\": \"3000\",
        \"RuntimeEnvironmentVariables\": {
          \"AI_PROVIDER\": \"bedrock\",
          \"AWS_REGION\": \"$AWS_REGION\",
          \"AWS_ACCESS_KEY_ID\": \"YOUR_KEY\",
          \"AWS_SECRET_ACCESS_KEY\": \"YOUR_SECRET\",
          \"BEDROCK_MODEL\": \"amazon.nova-micro-v1:0\"
        }
      }
    }
  }" \
  --instance-configuration '{"Cpu":"1 vCPU","Memory":"2 GB"}' \
  --region $AWS_REGION
```

App Runner trả về URL dạng: `https://xxxxxxxx.us-east-1.awsapprunner.com`

---

## Hoặc deploy lên Railway (đơn giản hơn, không cần AWS CLI)

1. Vào [railway.app](https://railway.app) → New Project → **Deploy Docker Image**
2. Nhập image: `yourusername/yummy:latest`
3. Thêm env vars:
   - `AI_PROVIDER=bedrock`
   - `AWS_ACCESS_KEY_ID=...`
   - `AWS_SECRET_ACCESS_KEY=...`
   - `AWS_REGION=us-east-1`
   - `BEDROCK_MODEL=amazon.nova-micro-v1:0`
4. Deploy → Railway tự cấp domain HTTPS

**Railway free tier: $5 credit/tháng — đủ để demo.**

---

## Bedrock setup (bắt buộc)

1. AWS Console → Bedrock → **Model access** → Enable **Amazon Nova Micro**
2. IAM → User → Add permissions:
   - `bedrock:InvokeModel`
   - `bedrock:InvokeModelWithResponseStream`
