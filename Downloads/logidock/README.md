# 🏭 LogiDock — Sistema de Gestão de Docas

Sistema mobile-first para gerenciamento de docas de carregamento em centros de distribuição.

## Estrutura do Projeto

```
logidock/
├── public/               ← Arquivos servidos pelo Vercel
│   ├── index.html        ← HTML principal
│   ├── app.css           ← Estilos
│   ├── app.js            ← Lógica da aplicação
│   └── firebase.js       ← Integração Firebase (tempo real)
├── src/
│   ├── css/app.css       ← Fonte CSS
│   ├── js/app.js         ← Fonte JS
│   └── firebase/
│       ├── firestore.rules        ← Regras de segurança
│       └── firestore.indexes.json ← Índices do banco
├── .github/
│   └── workflows/
│       └── deploy.yml    ← CI/CD automático
├── vercel.json           ← Configuração Vercel
├── package.json
└── README.md
```

---

## PASSO 1 — Subir para o GitHub

```bash
# 1. Clone ou crie o repositório
git init
git add .
git commit -m "feat: LogiDock v1.0"

# 2. Crie o repositório no GitHub (github.com → New repository)
#    Nome sugerido: logidock

# 3. Conecte e envie
git remote add origin https://github.com/SEU_USUARIO/logidock.git
git branch -M main
git push -u origin main
```

---

## PASSO 2 — Criar o banco de dados no Firebase

### 2.1 Criar o projeto

1. Acesse **https://console.firebase.google.com**
2. Clique em **"Adicionar projeto"**
3. Nome: `logidock` → Continuar
4. Google Analytics: pode desativar → **Criar projeto**

### 2.2 Criar o Firestore (banco de dados)

1. No menu lateral: **Build → Firestore Database**
2. Clique em **"Criar banco de dados"**
3. Modo: selecione **"Iniciar no modo de teste"** (permite leitura/escrita por 30 dias)
4. Localização: `southamerica-east1` (São Paulo) → **Concluído**

### 2.3 Aplicar as regras de segurança

1. No Firestore → aba **"Regras"**
2. Apague o conteúdo existente
3. Cole o conteúdo do arquivo `src/firebase/firestore.rules`
4. Clique em **"Publicar"**

### 2.4 Obter as credenciais

1. No Firebase Console → **Configurações do projeto** (ícone ⚙️)
2. Aba **"Geral"** → role até **"Seus apps"**
3. Clique em **"Adicionar app"** → ícone **Web (`</>`)**
4. Apelido: `logidock-web` → **Registrar app**
5. Copie o objeto `firebaseConfig` exibido

### 2.5 Inserir credenciais no projeto

Abra o arquivo `public/firebase.js` e substitua os campos `COLE_AQUI_*`:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",        // ← cole o valor real
  authDomain:        "logidock.firebaseapp.com",
  projectId:         "logidock-12345",
  storageBucket:     "logidock-12345.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

Salve e faça commit:
```bash
git add public/firebase.js
git commit -m "config: Firebase credentials"
git push
```

---

## PASSO 3 — Hospedar no Vercel

### Opção A — Interface Web (mais fácil)

1. Acesse **https://vercel.com** e faça login com GitHub
2. Clique em **"Add New Project"**
3. Selecione o repositório `logidock`
4. **Framework Preset**: Other
5. **Root Directory**: deixe vazio (raiz)
6. Clique em **"Deploy"**
7. Pronto! Vercel gera uma URL como `logidock.vercel.app`

### Opção B — CLI (linha de comando)

```bash
npm i -g vercel
vercel login
vercel --prod
```

### Configurar deploy automático (CI/CD)

Para que cada `git push` faça deploy automático:

1. No Vercel → **Settings → Tokens** → criar token → copie
2. No GitHub → **Settings → Secrets → Actions** → adicionar:
   - `VERCEL_TOKEN` → token copiado
   - `VERCEL_ORG_ID` → encontre em Vercel Settings → General
   - `VERCEL_PROJECT_ID` → encontre em Vercel → projeto → Settings

---

## PASSO 4 — Acessar no celular

Após o deploy, sua URL será algo como:
```
https://logidock.vercel.app
```

**Para adicionar à tela inicial do celular (Android):**
1. Abra no Chrome
2. Menu (⋮) → "Adicionar à tela inicial"

**Para iOS (Safari):**
1. Abra no Safari
2. Compartilhar → "Adicionar à Tela de Início"

---

## Coleções do Firestore

| Coleção | Descrição | Tempo Real |
|---------|-----------|-----------|
| `docks` | Estado das 6 docas | ✅ Sim |
| `queue` | Fila de veículos | ✅ Sim |
| `schedules` | Agendamentos | ✅ Sim |
| `carriers` | Transportadoras | ✅ Sim |
| `history` | Log de operações | ✅ Sim |
| `config` | Configurações do CD | ✅ Sim |
| `stats` | Métricas do turno | ✅ Sim |

---

## Funcionalidades

- **Dashboard** — visão geral em tempo real
- **Grade de Docas** — 6 docas com status e operações
- **Agenda** — agendamentos com filtro, busca e exportação CSV
- **Fila** — gestão de veículos aguardando + chamar para doca
- **Histórico** — log completo de todas as operações
- **Configurações** — turnos, transportadoras, nome do CD
- **Offline** — funciona sem internet via localStorage como fallback
- **Tempo real** — múltiplos usuários veem o mesmo estado via Firebase

---

## Desenvolvimento local

```bash
# Instale o serve
npm install -g serve

# Rode localmente
serve public -p 3000

# Acesse
open http://localhost:3000
```
