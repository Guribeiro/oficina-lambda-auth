variable "environment" {
  description = "Ambiente (hml ou prd)"
  type        = string

  validation {
    condition     = contains(["hml", "prd"], var.environment)
    error_message = "environment deve ser hml ou prd."
  }
}

variable "aws_region" {
  description = "Região AWS"
  type        = string
  default     = "us-east-1"
}

variable "state_bucket" {
  description = "Bucket S3 do Terraform state (TF_VAR_state_bucket)"
  type        = string
}

variable "project" {
  description = "Prefixo dos recursos"
  type        = string
  default     = "oficina"
}

variable "lambda_role_name" {
  description = "Role IAM existente usada pelas funções (Learner Lab)"
  type        = string
  default     = "LabRole"
}

variable "runtime" {
  description = "Runtime Node.js das funções"
  type        = string
  default     = "nodejs22.x"
}

variable "token_ttl_seconds" {
  description = "Validade dos tokens emitidos para clientes (segundos)"
  type        = number
  default     = 3600
}

variable "log_retention_days" {
  description = "Retenção dos logs das funções"
  type        = number
  default     = 14
}

variable "newrelic_layer_arn" {
  description = "ARN da layer New Relic para Node.js (vazio desativa a instrumentação)"
  type        = string
  default     = ""
}

variable "newrelic_account_id" {
  description = "Account ID do New Relic (usado com a layer)"
  type        = string
  default     = ""
}

variable "newrelic_license_key" {
  description = "License key do New Relic (usada pela extensão da layer)"
  type        = string
  default     = ""
  sensitive   = true
}
