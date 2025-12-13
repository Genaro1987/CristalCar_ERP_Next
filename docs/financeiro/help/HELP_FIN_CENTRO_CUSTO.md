# Centro de Custo (FIN_CENTRO_CUSTO)

## Importância da tela
Controla onde cada gasto é aplicado, permitindo análise gerencial por área, projeto ou unidade de negócio.

## Funcionamento e processo
1. Cadastre centros raiz e adicione níveis filhos conforme a estrutura organizacional.
2. Utilize códigos únicos para facilitar integrações e importações.
3. Defina a ordem de exibição para uma visualização em árvore mais clara.
4. Ative ou inative centros sem perder histórico.

## Campos obrigatórios e opcionais
- **Obrigatórios:** Nome, Código (único), Ativo, Ordem.
- **Opcionais:** Centro de custo pai (para hierarquia).

## Regras e validações
- Código deve ser único em toda a hierarquia.
- Contas financeiras que exigem centro de custo tornam este campo obrigatório nos lançamentos.
- Filtros por ativo e por nome/código ajudam a localizar rapidamente estruturas grandes.
