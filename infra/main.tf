# Funções serverless de autenticação de um ambiente:
#   - oficina-auth-cpf-<env>:   POST /auth/cpf -> valida CPF, consulta o cliente no RDS e emite JWT
#   - oficina-authorizer-<env>: Lambda Authorizer das rotas protegidas da API
# O authorizer é associado às rotas pela stack environment do oficina-infra-k8s,
# que localiza a função pelo nome.
locals {
  tags = {
    Project     = "oficina-mecanica"
    Repository  = "oficina-lambda-auth"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  platform = data.terraform_remote_state.platform.outputs
  database = data.terraform_remote_state.database.outputs
  gateway  = data.terraform_remote_state.gateway.outputs

  newrelic = var.newrelic_layer_arn != ""

  # Com a layer do New Relic, o wrapper ESM invoca o handler original.
  handler_newrelic = "/opt/nodejs/node_modules/newrelic-esm-lambda-wrapper/index.handler"

  env_comum = merge(
    {
      APP_ENV       = var.environment
      JWT_SECRET_ID = "${var.project}/${var.environment}/jwt"
      NODE_OPTIONS  = "--enable-source-maps"
    },
    local.newrelic ? {
      NEW_RELIC_LAMBDA_HANDLER               = "index.handler"
      NEW_RELIC_USE_ESM                      = "true"
      NEW_RELIC_ACCOUNT_ID                   = var.newrelic_account_id
      NEW_RELIC_LICENSE_KEY                  = var.newrelic_license_key
      NEW_RELIC_EXTENSION_SEND_FUNCTION_LOGS = "true"
    } : {},
  )

  funcoes = {
    auth-cpf = {
      nome      = "${var.project}-auth-cpf-${var.environment}"
      descricao = "Autenticacao de clientes por CPF: valida CPF, consulta status no RDS e emite JWT"
      memoria   = 256
      timeout   = 10
      na_vpc    = true
      env_extra = {
        DB_SECRET_ID      = "${var.project}/${var.environment}/db"
        TOKEN_TTL_SECONDS = tostring(var.token_ttl_seconds)
        # Cadeia de certificados da AWS (inclui RDS) para TLS com verificação.
        NODE_EXTRA_CA_CERTS = "/var/runtime/ca-cert.pem"
      }
    }
    authorizer = {
      nome      = "${var.project}-authorizer-${var.environment}"
      descricao = "Lambda Authorizer do API Gateway: valida JWT de clientes e funcionarios"
      memoria   = 128
      timeout   = 5
      na_vpc    = false
      env_extra = {}
    }
  }
}

data "terraform_remote_state" "platform" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "oficina-infra-k8s/platform/terraform.tfstate"
    region = var.aws_region
  }
}

data "terraform_remote_state" "gateway" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "oficina-infra-k8s/environment/${var.environment}/terraform.tfstate"
    region = var.aws_region
  }
}

data "terraform_remote_state" "database" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "oficina-infra-db/${var.environment}/terraform.tfstate"
    region = var.aws_region
  }
}

# Learner Lab: as funções usam a role pré-provisionada (leitura de segredos, ENIs na VPC e logs).
data "aws_iam_role" "lambda" {
  name = var.lambda_role_name
}

# ---------------------------------------------------------------------------
# Funções
# ---------------------------------------------------------------------------
data "archive_file" "funcao" {
  for_each = local.funcoes

  type        = "zip"
  source_dir  = "${path.module}/../dist/${each.key}"
  output_path = "${path.module}/.build/${each.key}.zip"
}

resource "aws_cloudwatch_log_group" "funcao" {
  for_each = local.funcoes

  name              = "/aws/lambda/${each.value.nome}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "funcao" {
  for_each = local.funcoes

  function_name    = each.value.nome
  description      = each.value.descricao
  role             = data.aws_iam_role.lambda.arn
  runtime          = var.runtime
  architectures    = ["x86_64"]
  handler          = local.newrelic ? local.handler_newrelic : "index.handler"
  filename         = data.archive_file.funcao[each.key].output_path
  source_code_hash = data.archive_file.funcao[each.key].output_base64sha256
  memory_size      = each.value.memoria
  timeout          = each.value.timeout
  layers           = local.newrelic ? [var.newrelic_layer_arn] : []

  environment {
    variables = merge(local.env_comum, each.value.env_extra)
  }

  # auth-cpf roda nas subnets privadas para alcançar o RDS (saída via NAT para o Secrets Manager).
  dynamic "vpc_config" {
    for_each = each.value.na_vpc ? [1] : []
    content {
      subnet_ids         = local.platform.private_subnet_ids
      security_group_ids = [local.database.db_client_security_group_id]
    }
  }

  depends_on = [aws_cloudwatch_log_group.funcao]
}

# ---------------------------------------------------------------------------
# Rota pública POST /auth/cpf na HTTP API do ambiente
# ---------------------------------------------------------------------------
resource "aws_apigatewayv2_integration" "auth_cpf" {
  api_id                 = local.gateway.api_id
  description            = "Lambda de autenticacao por CPF"
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.funcao["auth-cpf"].invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

resource "aws_apigatewayv2_route" "auth_cpf" {
  api_id             = local.gateway.api_id
  route_key          = "POST /auth/cpf"
  target             = "integrations/${aws_apigatewayv2_integration.auth_cpf.id}"
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "auth_cpf" {
  statement_id  = "AllowApiGatewayAuthCpf"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.funcao["auth-cpf"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${local.gateway.api_execution_arn}/*/*/auth/cpf"
}
