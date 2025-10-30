# Deployment Strategy - Kubernetes & Terraform for Regional Rollout

## Overview

The Tanzania Transparent Platform employs Infrastructure as Code (IaC) using Terraform for cloud provisioning and Kubernetes for container orchestration, enabling reliable, scalable, and secure deployment across Tanzania's 26 regions.

## Quick Deployment Options

### Vercel Deployment (Frontend - Recommended for Prototyping/Demos)
For rapid prototyping and live demos, deploy the frontend to Vercel:

1. **Prerequisites**:
   - GitHub repository connected to Vercel account.
   - `frontend/vercel.json` configured for API routing.

2. **Steps**:
   - Import repo on [vercel.com](https://vercel.com).
   - Select `preview` branch, root directory `frontend/`.
   - Add env vars: `REACT_APP_API_URL=https://your-backend-url.com`.
   - Deploy – live in 2-3 minutes.

3. **Backend Deployment**:
   - Deploy `src/server/` separately to Heroku/Railway.
   - Update `vercel.json` with actual backend URL.

4. **Pros**: Free, fast, auto-scaling for React apps.
5. **Cons**: Not for full-stack; backend separate.

### Full Infrastructure Deployment (Production)

#### Regional Distribution

**Primary Regions**:
- Dar es Salaam (Main data center)
- Dodoma (Government neutral)

**Secondary Regions**:
- Mwanza, Arusha, Mbeya, Mtwara, Zanzibar
- Regional edge locations

**Network Topology**:
```
┌─────────────────┐    ┌─────────────────┐
│   Global CDN    │    │  Regional Hubs  │
│  (Cloudflare)   │◄──►│   (Kubernetes)  │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Edge Nodes    │    │   Consensus     │
│   (26 Regions)  │◄──►│   (Hedera)      │
└─────────────────┘    └─────────────────┘
```

## Terraform Infrastructure

### Core Modules

#### VPC & Networking
```hcl
module "vpc" {
  source = "./modules/vpc"

  region = var.region
  cidr_block = "10.0.0.0/16"
  availability_zones = ["a", "b", "c"]

  tags = {
    Project = "Tanzania-Platform"
    Environment = var.environment
  }
}
```

#### Kubernetes Cluster
```hcl
module "eks" {
  source = "./modules/eks"

  cluster_name = "tanzania-platform-${var.region}"
  kubernetes_version = "1.28"

  node_groups = {
    general = {
      instance_types = ["t3.large"]
      min_size = 3
      max_size = 10
      desired_size = 5
    }
  }
}
```

#### Database Layer
```hcl
module "database" {
  source = "./modules/database"

  engine = "postgresql"
  engine_version = "15.4"
  instance_class = "db.r6g.large"

  multi_az = true
  backup_retention_period = 30
}
```

#### Storage & Cache
```hcl
module "storage" {
  source = "./modules/storage"

  s3_buckets = {
    "user-uploads" = {
      versioning = true
      encryption = true
    }
    "logs" = {
      lifecycle_rules = [
        {
          enabled = true
          expiration = 90
        }
      ]
    }
  }
}

module "redis" {
  source = "./modules/redis"

  cluster_mode = "enabled"
  num_cache_clusters = 3
  node_type = "cache.r6g.large"
}
```

### Security Configuration

#### IAM Roles
```hcl
resource "aws_iam_role" "platform_service" {
  name = "tanzania-platform-service"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "platform_service" {
  role = aws_iam_role.platform_service.name
  policy_arn = aws_iam_policy.platform_service.arn
}
```

#### Security Groups
```hcl
resource "aws_security_group" "platform" {
  name = "tanzania-platform"

  ingress {
    from_port = 443
    to_port = 443
    protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port = 80
    to_port = 80
    protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port = 0
    to_port = 0
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

## Kubernetes Deployment

### Cluster Architecture

**Control Plane**:
- Multi-master setup for high availability
- etcd clustering for state management
- RBAC for access control

**Worker Nodes**:
- Auto-scaling groups
- Spot instances for cost optimization
- Taints and tolerations for workload isolation

### Core Deployments

#### API Gateway
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: tanzania-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: tanzania-platform/api-gateway:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Voting Service
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voting-service
  namespace: tanzania-platform
spec:
  replicas: 5
  selector:
    matchLabels:
      app: voting-service
  template:
    metadata:
      labels:
        app: voting-service
    spec:
      containers:
      - name: voting-service
        image: tanzania-platform/voting-service:v1.0.0
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: hedera-secrets
        - configMapRef:
            name: app-config
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: logs
        emptyDir: {}
```

#### AI Moderation Service
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-moderation
  namespace: tanzania-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-moderation
  template:
    metadata:
      labels:
        app: ai-moderation
    spec:
      containers:
      - name: ai-moderation
        image: tanzania-platform/ai-moderation:v1.0.0
        ports:
        - containerPort: 5000
        env:
        - name: SINGULARITYNET_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: singularitynet-key
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
            nvidia.com/gpu: "1"
```

### Services & Ingress

#### LoadBalancer Service
```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-lb
  namespace: tanzania-platform
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
  - port: 443
    targetPort: 8443
    protocol: TCP
  selector:
    app: api-gateway
```

#### Ingress Controller
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: platform-ingress
  namespace: tanzania-platform
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.tanzania-democracy.platform
    secretName: platform-tls
  rules:
  - host: api.tanzania-democracy.platform
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway-lb
            port:
              number: 80
```

## CI/CD Pipeline

### GitOps Workflow

**ArgoCD Application**:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tanzania-platform
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/tanzania-democracy/platform
    path: k8s
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: tanzania-platform
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### Deployment Strategy

#### Blue-Green Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voting-service-blue
spec:
  replicas: 5
  selector:
    matchLabels:
      app: voting-service
      version: blue
  template:
    metadata:
      labels:
        app: voting-service
        version: blue
    spec:
      containers:
      - name: voting-service
        image: tanzania-platform/voting-service:v1.1.0
```

#### Canary Deployment
```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: voting-service
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: voting-service
  service:
    port: 80
    targetPort: 3000
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99
      interval: 1m
```

## Monitoring & Observability

### Prometheus & Grafana

**ServiceMonitor**:
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: platform-services
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: platform-service
  endpoints:
  - port: metrics
    interval: 30s
```

### Logging Stack

**EFK Stack Configuration**:
```yaml
apiVersion: logging.kubesphere.io/v1alpha2
kind: Output
metadata:
  name: elasticsearch
  namespace: kubesphere-logging-system
spec:
  elasticsearch:
    hosts:
    - elasticsearch-logging-data.kubesphere-logging-system.svc:9200
    index_name: tanzania-platform
```

## Security Hardening

### Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-policy
  namespace: tanzania-platform
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: voting-service
    ports:
    - protocol: TCP
      port: 3000
```

### Secrets Management
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: hedera-secrets
  namespace: tanzania-platform
type: Opaque
data:
  account-id: <base64-encoded>
  private-key: <base64-encoded>
```

## Regional Rollout Strategy

### Phase 1: Pilot Deployment (Arusha)
- Single region deployment
- Load testing with 10,000 users
- Feature validation and bug fixes

### Phase 2: Multi-Region Expansion
- Deploy to 5 secondary regions
- Cross-region data synchronization
- Performance optimization

### Phase 3: National Rollout
- Full 26-region deployment
- CDN integration
- Monitoring and alerting setup

### Phase 4: Continuous Improvement
- Automated scaling
- Performance monitoring
- Feature enhancements

## Disaster Recovery

### Backup Strategy
- Database snapshots every 6 hours
- Configuration backups daily
- Cross-region replication

### Recovery Procedures
- Automated failover to secondary regions
- Data restoration from backups
- Service restoration playbooks

## Cost Optimization

### Resource Management
- Auto-scaling based on demand
- Spot instances for non-critical workloads
- Reserved instances for predictable loads

### Monitoring Costs
- Budget alerts and limits
- Cost allocation tags
- Regular cost analysis reports

---

*This deployment strategy ensures reliable, secure, and scalable infrastructure for the Tanzania Transparent Platform.*</content>
<parameter name="filePath">E:\Polymath Universata\Projects\MIT(Mungu Ibariki Tanzania)\docs\DEPLOYMENT.md