# SERVUS | AD Regional Bethânia

Sistema de gestão e planejamento de escalas para equipes ministeriais e voluntários da igreja (Assembleia de Deus Regional Bethânia).

## 🚀 Tecnologias

- **Frontend:** HTML5, CSS3 moderno, JavaScript ES Modules, Vite
- **Backend / Database:** [Supabase](https://supabase.com) (PostgreSQL)
- **Persistência:** 100% direta via Supabase — **Zero localStorage, Zero Cache**
- **Tempo Real:** Supabase Realtime (atualizações instantâneas de escalas e confirmações)

---

## 📋 Funcionalidades

1. **Visão Geral (Dashboard):**
   - Roster do dia com atividades e voluntários escalados.
   - Indicadores de pessoas, escalas do mês, atividades e taxa de confirmação.
   - Calendário semanal com marcação de dias de culto/evento.
   - Alertas de confirmações pendentes e aniversários.

2. **Gestão de Escalas:**
   - Criação e edição de programações (Cultos, Eventos, Ensaios, Reuniões).
   - Atribuição dinâmica de voluntários por atividade.
   - **Validação inteligente de disponibilidade:** bloqueia escala se o voluntário tiver período de ausência/indisponibilidade cadastrado.
   - Filtros por tipo e busca textual.

3. **Agenda (Calendário Mensal):**
   - Visualização dos 42 blocos do mês com badges coloridos por tipo e horário.
   - Lista resumida dos escalados com acesso direto para edição.

4. **Área do Voluntário (Minha Escala):**
   - Seletor de voluntário para consulta rápida.
   - Botão para **Confirmar presença** diretamente no banco de dados Supabase.

5. **Equipe:**
   - Cadastro completo de voluntários (Nome, Telefone, Habilidades/Atividades, Aniversário, Disponibilidade e Motivo).
   - Próximos aniversariantes com contagem regressiva e suporte a notificações push nativas.

6. **Atividades (Frentes de Serviço):**
   - Catálogo de funções (Áudio, Projeção, Transmissão, Fotografia, Vídeo, Social Media, Design, etc.).
   - Contador de atribuições em escalas ativas.

---

## 🛠️ Configuração do Banco de Dados (Supabase)

1. Crie um novo projeto no seu painel [Supabase](https://database.new).
2. Acesse a aba **SQL Editor** no menu lateral esquerdo.
3. Abra o arquivo [`supabase/schema.sql`](./supabase/schema.sql), copie todo o seu conteúdo e execute no SQL Editor.
   - Esse script cria automaticamente as tabelas (`people`, `activities`, `scales`, `scale_assignments`, `system_notifications`), configura as chaves estrangeiras, os índices, as políticas de segurança (RLS), o Realtime e insere a carga inicial (seed data).
4. No painel do Supabase, vá em **Project Settings > API** e copie:
   - **Project URL**
   - **Project API Key (`anon` / `public`)**
5. Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
   ```

---

## 💻 Como Rodar o Projeto

```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor de desenvolvimento
npm run dev

# 3. Compilar para produção
npm run build
```

---

## 🌐 Repositório GitHub

- Repositório: [https://github.com/henrriqueleonardo87-art/servus](https://github.com/henrriqueleonardo87-art/servus)
