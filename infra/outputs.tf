output "auth_cpf_function_name" {
  description = "Função de autenticação por CPF"
  value       = aws_lambda_function.funcao["auth-cpf"].function_name
}

output "authorizer_function_name" {
  description = "Função do Lambda Authorizer (associada às rotas pelo oficina-infra-k8s)"
  value       = aws_lambda_function.funcao["authorizer"].function_name
}

output "auth_url" {
  description = "Endpoint de autenticação por CPF"
  value       = "${local.gateway.invoke_url}auth/cpf"
}
