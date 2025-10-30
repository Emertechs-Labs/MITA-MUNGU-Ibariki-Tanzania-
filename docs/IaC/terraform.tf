# Tanzania Transparent Platform - Infrastructure as Code
# Terraform configuration for regional infrastructure deployment

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  backend "s3" {
    bucket = "tanzania-platform-terraform-state"
    key    = "infrastructure.tfstate"
    region = "eu-west-1"
  }
}

# Provider configurations for each region
provider "aws" {
  alias  = "dar-es-salaam"
  region = "eu-west-1"  # Closest AWS region

  default_tags {
    tags = {
      Project     = "Tanzania-Transparent-Platform"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

provider "aws" {
  alias  = "dodoma"
  region = "eu-west-1"

  default_tags {
    tags = {
      Project     = "Tanzania-Transparent-Platform"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "region" {
  description = "Primary deployment region"
  type        = string
  default     = "dar-es-salaam"
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "node_instance_type" {
  description = "EC2 instance type for worker nodes"
  type        = string
  default     = "t3.large"
}

variable "node_count" {
  description = "Number of worker nodes"
  type        = number
  default     = 3
}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"

  providers = {
    aws = aws.dar-es-salaam
  }

  name = "tanzania-platform-${var.environment}"
  cidr = "10.0.0.0/16"

  azs             = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = var.environment == "staging"

  tags = {
    Environment = var.environment
  }
}

# EKS Cluster
module "eks" {
  source = "./modules/eks"

  providers = {
    aws = aws.dar-es-salaam
  }

  cluster_name    = "tanzania-platform-${var.environment}"
  cluster_version = var.cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # EKS Managed Node Group
  eks_managed_node_groups = {
    general = {
      instance_types = [var.node_instance_type]
      min_size       = var.environment == "production" ? 3 : 1
      max_size       = var.environment == "production" ? 10 : 5
      desired_size   = var.node_count

      labels = {
        Environment = var.environment
        NodeGroup   = "general"
      }

      taints = []
    }

    # GPU nodes for AI workloads
    ai = {
      instance_types = ["g4dn.xlarge"]
      min_size       = 0
      max_size       = 3
      desired_size   = var.environment == "production" ? 1 : 0

      labels = {
        Environment = var.environment
        NodeGroup   = "ai"
        Workload    = "ai-moderation"
      }

      taints = [
        {
          key    = "workload"
          value  = "ai"
          effect = "NO_SCHEDULE"
        }
      ]
    }
  }

  # Security group rules
  cluster_security_group_additional_rules = {
    ingress_nodes_ephemeral_ports_tcp = {
      description                = "Node groups to cluster API via ephemeral ports"
      protocol                   = "tcp"
      from_port                  = 1025
      to_port                    = 65535
      type                       = "ingress"
      source_node_security_group = true
    }
  }

  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }

    egress_all = {
      description = "Node all egress"
      protocol    = "-1"
      from_port   = 0
      to_port    = 0
      type        = "egress"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  tags = {
    Environment = var.environment
  }
}

# RDS Database
module "db" {
  source = "./modules/db"

  providers = {
    aws = aws.dar-es-salaam
  }

  identifier = "tanzania-platform-${var.environment}"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.large"

  allocated_storage = 100
  storage_encrypted = true

  db_name  = "tanzaniaplatform"
  username = "platformadmin"
  port     = 5432

  vpc_security_group_ids = [module.db_security_group.security_group_id]
  db_subnet_group_name   = module.db_subnet_group.db_subnet_group_name

  maintenance_window = "Mon:00:00-Mon:03:00"
  backup_window      = "03:00-06:00"

  backup_retention_period = 30
  skip_final_snapshot     = var.environment == "staging"
  final_snapshot_identifier = "tanzania-platform-${var.environment}-final"

  performance_insights_enabled = true
  monitoring_interval         = 60

  tags = {
    Environment = var.environment
  }
}

# ElastiCache Redis
module "redis" {
  source = "./modules/redis"

  providers = {
    aws = aws.dar-es-salaam
  }

  cluster_id      = "tanzania-platform-${var.environment}"
  engine          = "redis"
  node_type       = "cache.r6g.large"
  num_cache_nodes = 1

  parameter_group_name = "default.redis7"
  port                = 6379

  subnet_group_name = module.redis_subnet_group.redis_subnet_group_name
  security_group_ids = [module.redis_security_group.security_group_id]

  maintenance_window = "sun:05:00-sun:09:00"
  snapshot_window    = "00:00-05:00"

  tags = {
    Environment = var.environment
  }
}

# S3 Buckets
module "s3" {
  source = "./modules/s3"

  providers = {
    aws = aws.dar-es-salaam
  }

  buckets = {
    "tanzania-platform-user-uploads-${var.environment}" = {
      versioning = true
      encryption = true
      lifecycle_rules = [
        {
          enabled = true
          expiration = {
            days = 365
          }
          filter = {
            prefix = "temp/"
          }
        }
      ]
    }

    "tanzania-platform-logs-${var.environment}" = {
      versioning = false
      encryption = true
      lifecycle_rules = [
        {
          enabled = true
          expiration = {
            days = 90
          }
        }
      ]
    }

    "tanzania-platform-backups-${var.environment}" = {
      versioning = true
      encryption = true
      lifecycle_rules = [
        {
          enabled = true
          expiration = {
            days = 2555  # 7 years
          }
          transitions = [
            {
              days          = 30
              storage_class = "STANDARD_IA"
            },
            {
              days          = 365
              storage_class = "GLACIER"
            }
          ]
        }
      ]
    }
  }

  tags = {
    Environment = var.environment
  }
}

# CloudFront CDN
module "cdn" {
  source = "./modules/cdn"

  providers = {
    aws = aws.dar-es-salaam
  }

  aliases = [
    var.environment == "production" ? "platform.tanzania.gov.tz" : "staging.platform.tanzania.gov.tz"
  ]

  origin = {
    domain_name = module.alb.lb_dns_name
    origin_id   = "platform-alb"

    custom_origin_config = {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior = {
    target_origin_id       = "platform-alb"
    viewer_protocol_policy = "redirect-to-https"

    allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values = {
      query_string = true
      cookies = {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  tags = {
    Environment = var.environment
  }
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  providers = {
    aws = aws.dar-es-salaam
  }

  name = "tanzania-platform-${var.environment}"

  vpc_id          = module.vpc.vpc_id
  subnets         = module.vpc.public_subnets
  security_groups = [module.alb_security_group.security_group_id]

  target_groups = [
    {
      name             = "api"
      backend_protocol = "HTTP"
      backend_port     = 80
      target_type      = "ip"

      health_check = {
        enabled             = true
        interval            = 30
        path                = "/health"
        port                = "traffic-port"
        healthy_threshold   = 3
        unhealthy_threshold = 3
        timeout             = 6
        protocol            = "HTTP"
        matcher             = "200-399"
      }
    }
  ]

  http_tcp_listeners = [
    {
      port               = 80
      protocol           = "HTTP"
      target_group_index = 0
    }
  ]

  https_listeners = [
    {
      port               = 443
      protocol           = "HTTPS"
      certificate_arn    = module.acm.acm_certificate_arn
      target_group_index = 0
    }
  ]

  tags = {
    Environment = var.environment
  }
}

# ACM Certificate
module "acm" {
  source = "./modules/acm"

  providers = {
    aws = aws.dar-es-salaam
  }

  domain_name = var.environment == "production" ? "platform.tanzania.gov.tz" : "staging.platform.tanzania.gov.tz"
  zone_id     = data.aws_route53_zone.platform.zone_id

  subject_alternative_names = [
    "*.${var.environment == "production" ? "platform.tanzania.gov.tz" : "staging.platform.tanzania.gov.tz"}"
  ]

  tags = {
    Environment = var.environment
  }
}

# Route 53
data "aws_route53_zone" "platform" {
  provider = aws.dar-es-salaam
  name     = "tanzania.gov.tz"
}

resource "aws_route53_record" "platform" {
  provider = aws.dar-es-salaam

  zone_id = data.aws_route53_zone.platform.zone_id
  name    = var.environment == "production" ? "platform" : "staging.platform"
  type    = "A"

  alias {
    name                   = module.cdn.cloudfront_distribution_domain_name
    zone_id               = module.cdn.cloudfront_distribution_zone_id
    evaluate_target_health = false
  }
}

# Outputs
output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = module.db.db_instance_endpoint
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.redis.cluster_configuration[0].configuration_endpoint
}

output "cdn_domain" {
  description = "CloudFront distribution domain"
  value       = module.cdn.cloudfront_distribution_domain_name
}

output "alb_dns" {
  description = "Application Load Balancer DNS"
  value       = module.alb.lb_dns_name
}</content>
<parameter name="filePath">E:\Polymath Universata\Projects\MIT(Mungu Ibariki Tanzania)\docs\IaC\terraform.tf