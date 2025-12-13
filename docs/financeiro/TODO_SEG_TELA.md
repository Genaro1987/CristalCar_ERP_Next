# TODO SEG_TELA e filtros por empresa

A infraestrutura de **SEG_TELA** ainda não está disponível neste projeto. Assim que for criada, registrar as telas financeiras abaixo usando os códigos já aplicados no `HeaderBar` e no menu lateral:

- FIN_DASHBOARD
- FIN_LANCAMENTOS
- FIN_PLANO_CONTA
- FIN_CENTRO_CUSTO
- FIN_ESTRUTURA_DRE
- FIN_ESTRUTURA_DRE_CONTA
- FIN_DRE
- FIN_OBJETIVOS
- FIN_OBJETIVOS_SEMANAIS

## Onde registrar
- Criar uma migration similar às demais em `db/migrations`, populando `SEG_TELA` e tabelas de permissão correspondentes.
- Reutilizar os caminhos/descrições do `HeaderBar` de cada página em `app/financeiro/*/page.tsx`.

## Observação sobre filtros
Enquanto as APIs financeiras não forem implementadas, manter o lembrete de que toda consulta deve receber o **ID_EMPRESA** da sessão atual (ver hook `useEmpresaSelecionada`) para evitar mistura de dados entre empresas.
