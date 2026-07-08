<div align="center">

# SLA Monitoring Dashboard

**Cálculo, versionamento e reporte automatizado de indicadores de SLA para infraestrutura de rede.**

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Trino](https://img.shields.io/badge/Trino-Iceberg-DD00A1?logo=trino&logoColor=white)

**[Ver demo ao vivo](https://LuanRodrigues15.github.io/SLA-monitoring-dashboard/)** · entre com um clique em "Entrar como Admin (Demo)", sem cadastro

</div>

---

## Destaques

- 31 indicadores consolidados a partir de 2 sistemas que não se comunicavam entre si (rede e tickets)
- Fechamento mensal reduzido de dias para minutos
- Pacote de auditoria (Excel + TXT) gerado e enviado automaticamente via SFTP, com validação prévia e log de auditoria

## Screenshots

| | |
|---|---|
| Login | Painel de gestão (grid de indicadores) |
| <img width="800" alt="Tela de login" src="https://github.com/user-attachments/assets/17ce7422-0753-4238-9f64-bcf1751c68c7" /> | <img width="800" alt="Painel de gestão" src="https://github.com/user-attachments/assets/3d9c9eb8-05a2-4872-97ca-0560052199a0" /> |
| Indicador Detalhe (detalhamento adaptativo) | Histórico de KPI |
| <img width="800" alt="Indicador Detalhe" src="https://github.com/user-attachments/assets/0c2fc1b5-2996-4147-98f3-62e055065da4" /> | <img width="800" alt="Histórico de KPI" src="https://github.com/user-attachments/assets/5fc10efa-efc4-4c10-8b86-cf011476ecf1" /> |
| Central de Envio dos KPIs | Gerenciamento de usuários |
| <img width="800" alt="Central de Envio dos KPIs" src="https://github.com/user-attachments/assets/1c50aa5a-cf07-477b-abac-dc612d1bcd88" /> | <img width="800" alt="Gerenciamento de usuários" src="https://github.com/user-attachments/assets/669b4b75-6d14-4ee3-b3b7-e2f60f480da7" /> |

## Sobre o projeto

Desenvolvi este projeto durante meu **estágio na SONDA**, para resolver um problema real de um contrato de infraestrutura de rede: toda operadora precisa provar, mês a mês, a um auditor externo, que cumpriu o SLA acordado, disponibilidade, tempo de resposta, tempo de solução, satisfação, reabertura de chamados. Isso envolvia **31 indicadores diferentes**, calculados a partir de dois sistemas que não conversavam entre si (rede e tickets), com fechamento mensal e envio de um pacote formal (Excel + TXT) ao auditor. Antes desse sistema, boa parte disso era feito manualmente em planilhas.

A motivação era eliminar esse processo manual, com três objetivos:

- **Visão gerencial**: monitoramento rápido da saúde do contrato através de indicadores visuais de meta (o grid da tela Operação).
- **Capacidade de auditoria**: detalhamento granular para identificar ofensores e causas raízes (a tela de Indicador Detalhe).
- **Conformidade contratual**: automação do envio dos dados formatados ao auditor externo, garantindo o cumprimento do SLA de entrega de informação.

Esses três objetivos viraram três módulos integrados:

1. **Painel de gestão** (telas Operação/Gestão): grid dos 31 indicadores com regras visuais de meta (verde/alerta/crítico) aplicadas automaticamente, filtro por competência e agrupamento por categoria ou tipo de serviço.
2. **Detalhamento adaptativo** (tela Indicador Detalhe): um único componente que se adapta ao indicador selecionado: alterna entre gráfico de tendência, ranking dos principais ofensores ou composição (satisfação/status), com grid de dados brutos para auditoria pontual.
3. **Automação de envio**: geração do pacote (Excel + TXTs) no layout exigido, com validação prévia antes do envio SFTP ao auditor externo.

O resultado: transparência (dados centralizados e claros), agilidade (navegação do macro ao micro em poucos cliques) e confiabilidade (eliminação de erros humanos na manipulação manual dos indicadores).

> **Nota sobre os dados:** este repositório e a demo publicada aqui **não contêm nenhum dado real do cliente ou do contrato original**. Por conta de LGPD e de confidencialidade contratual, generalizei nomes, schemas, domínios, credenciais e a lógica de cálculo específica do contrato: o que está aqui é uma reconstrução própria, feita para fins de portfólio, com dados fictícios gerados só para ilustrar a interface. A arquitetura e os desafios de engenharia refletem o tipo de problema real enfrentado, sem expor informação sensível de ninguém.

## Arquitetura

```
┌─────────────────┐   ┌─────────────────┐
│  Monitoramento  │   │    Sistema de   │
│     de rede     │   │     tickets     │
└────────┬────────┘   └────────┬────────┘
         │                     │
         └──────────┬──────────┘
                    ▼
            Trino (query engine) → Apache Iceberg (lakehouse)
                    │
   ┌────────────────────────────────┐
   │  FastAPI                        │
   │  ├─ kpi_calculator (SQL inline) │
   │  ├─ cache TTL 1h                │
   │  └─ APScheduler (07h / 13h)     │
   └────────────────┬────────────────┘
        ┌────────────┼─────────────┐
        ▼                          ▼
 React (SPA, RBAC)         zip_builder + sftp_sender
                            (Excel + TXT → SFTP)
```

## Decisões de arquitetura

**Trino + Iceberg em vez de consultar os sistemas diretamente.** A empresa já vinha migrando sua infraestrutura de dados para Trino + Iceberg; usar esse pipeline permitiu tratar monitoramento de rede e tickets como um único modelo de consulta, em vez de manter integrações diferentes (e formatos de dado diferentes) espalhadas pelo backend.

**Cache de 1h no FastAPI.** Os 31 indicadores são recalculados via query ao Trino a cada carregamento da tela: sem cache, isso significava bater no Trino repetidamente para os mesmos dados. O TTL de 1h reduz essa carga sem comprometer a atualidade, e o cache é invalidado imediatamente sempre que um recálculo roda, então nunca serve um valor desatualizado até o TTL expirar (o agendador já recalcula os valores 2x/dia).

**Componente único e adaptativo para o detalhamento, em vez de telas por tipo de indicador.** Os 31 indicadores compartilham estruturas de visualização muito parecidas entre si (tendência, ranking de ofensores, composição). Manter telas separadas por tipo significaria duplicar praticamente a mesma lógica visual; centralizar num componente adaptativo reduziu bastante o trabalho de manutenção.

## Stack

| Camada | Tecnologias |
|---|---|
| Backend | Python 3.11, FastAPI, Trino (PyTrino), Apache Iceberg, APScheduler, paramiko |
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Zustand, Recharts |
| Deploy | Docker Compose (self-hosted) · GitHub Actions (demo estática) |

## Rodando localmente

```powershell
copy backend\.env.example backend\.env   # preencha com seu ambiente

cd backend && & .\.venv\Scripts\uvicorn.exe app.main:app --reload
cd frontend && npm install && npm run dev
```

Sem backend configurado, dá pra rodar só o frontend em **modo demo** (mesmo usado na demo ao vivo, com dados fictícios gerados em memória via `frontend/src/api/mock/`):

```powershell
cd frontend
$env:VITE_DEMO_MODE="true"; npm run dev
```

---

<details>
<summary><strong>Detalhes: os 31 indicadores, roles, endpoints e estrutura do projeto</strong></summary>

### Os 31 indicadores (exemplo ilustrativo)

| Cód | Categoria | Tipo | Fonte |
|-----|-----------|------|-------|
| 01 | Manutenção corretiva | Manual | Registros de manutenção (importação histórica) |
| 02–08 | Disponibilidade / Entrega de banda | Automático | Monitoramento de rede |
| 09–11 | Satisfação | Automático | Sistema de tickets |
| 12–31 | Tempo de resposta / solução / efetividade / reabertura | Automático | Sistema de tickets |

Lógica inline em `backend/app/services/kpi_calculator.py`, sem arquivos SQL externos.

### Roles

| Ação | readonly | auditor[^1] | gestor | admin |
|------|:---:|:---:|:---:|:---:|
| Ver indicadores/histórico | ✓ | ✓ | ✓ | ✓ |
| Gerar pacote | – | – | ✓ | ✓ |
| Enviar SFTP | – | – | ✓ | ✓ |
| Gerenciar usuários | – | – | – | ✓ |

[^1]: `auditor` é um papel externo ao time (o próprio auditor do contrato), com acesso somente leitura, mesmo escopo de `readonly`.

### Endpoints principais

`POST /api/auth/login` · `GET /api/kpis` · `GET /api/indicadores/{cod}` · `GET /api/indicadores/{cod}/historico` · `POST /api/envio/zip` · `POST /api/envio/sftp` · CRUD em `/api/users`

### Estrutura

```
SLA-monitoring-dashboard/
├── backend/app/
│   ├── services/kpi_calculator.py   ← lógica dos 31 indicadores
│   ├── services/zip_builder.py      ← Excel + TXTs → ZIP (batch queries)
│   ├── services/sftp_sender.py      ← envio SFTP + log de auditoria
│   └── core/trino_client.py         ← bind manual + normalização de tipos
├── frontend/src/
│   ├── api/mock/                    ← dados fictícios do modo demo
│   ├── store/                       ← Zustand (auth, filtros, tema)
│   └── pages/                       ← telas da aplicação
└── .github/workflows/                ← deploy automático da demo (GitHub Pages)
```

</details>

## Segurança

JWT HS256 · bcrypt · segredos fora do repositório (`backend/.env.example`) · CORS configurável.
