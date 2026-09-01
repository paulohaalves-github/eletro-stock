# Eletro-Stock

Sistema de gestão de estoque do Outlet **Eletromall**. Cada aparelho é uma unidade rastreável, com serial, condição, fotos de evidência e histórico completo de movimentações.

## Requisitos

- Node.js 20 ou superior
- npm
- MySQL 8 (local ou Docker)

## Banco de dados (MySQL)

A forma mais simples de subir o MySQL localmente:

```bash
docker compose up -d
```

Isso cria o banco `eletro_stock` com o usuário `eletro`.

Se você já tem um MySQL instalado, crie o banco e ajuste o `.env`:

```sql
CREATE DATABASE eletro_stock CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'eletro'@'%' IDENTIFIED BY 'eletrostock';
GRANT ALL PRIVILEGES ON eletro_stock.* TO 'eletro'@'%';
FLUSH PRIVILEGES;
```

```env
DATABASE_URL="mysql://eletro:eletrostock@localhost:3306/eletro_stock"
```

## Instalação

```bash
npm install
copy .env.example .env
docker compose up -d
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

O seed deixa o banco **zerado** (sem produtos, categorias, linhas ou movimentações) e cria só os usuários padrão.

### Usuários padrão

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | admin@eletromall.com | Admin@123 |
| Estoque | estoque@eletromall.com | Estoque@123 |
| Consulta | consulta@eletromall.com | Consulta@123 |

## Variáveis de ambiente

Veja `.env.example`:

- `DATABASE_URL` — conexão MySQL (`mysql://usuario:senha@host:3306/eletro_stock`)
- `AUTH_SECRET` — chave JWT da sessão
- `APP_URL` — URL pública
- `UPLOAD_DIR` — pasta de imagens/anexos
- `MAX_UPLOAD_MB` — tamanho máximo por arquivo

## Scripts

- `npm run db:up` — sobe o MySQL via Docker
- `npm run dev` — ambiente de desenvolvimento
- `npm run build` / `npm start` — produção
- `npm run db:migrate` — migrations
- `npm run db:seed` — zera o banco e cria só os usuários padrão
- `npm run db:reset` — recria o banco e executa o seed

## Arquitetura

- **Frontend:** Next.js App Router, Tailwind CSS 4, dark mode padrão
- **Backend:** Route Handlers em `src/app/api`
- **Regras de negócio:** `src/lib/services`
- **Banco:** Prisma + MySQL 8 (utf8mb4)
- **Auth:** JWT em cookie httpOnly + checagem por perfil em cada API
- **Uploads:** arquivos locais em `/uploads`, servidos por `/api/files`
- **Leitor de código:** `src/lib/scanner.js` e o campo `ScanField` (USB/teclado agora; câmera EAN/QR no futuro)

## Módulos

Dashboard, estoque, entrada, saída, detalhes do produto, movimentações, relatórios (Excel/CSV/PDF), categorias, linhas, usuários e auditoria.

## Produção em Linux

Este guia assume Ubuntu 22.04/24.04 (ou Debian 12) com acesso SSH de root/sudo.

### 1. Pacotes do servidor

```bash
sudo apt update
sudo apt install -y git nginx mysql-server build-essential python3
```

Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

O pacote `sharp` (otimização de fotos) precisa de compilação no Linux. Se o `npm install` falhar, instale também:

```bash
sudo apt install -y libvips-dev
```

### 2. Banco MySQL

```bash
sudo mysql
```

```sql
CREATE DATABASE eletro_stock CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'eletro'@'localhost' IDENTIFIED BY 'SENHA_FORTE';
GRANT ALL PRIVILEGES ON eletro_stock.* TO 'eletro'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Se a senha tiver `/ @ # % espaço ! *`, ela precisa estar **percent-encoded** na `DATABASE_URL`.

### 3. Aplicação

```bash
sudo mkdir -p /var/www/eletro-stock
sudo chown $USER:$USER /var/www/eletro-stock
cd /var/www/eletro-stock
git clone URL_DO_REPOSITORIO .
# ou envie os arquivos por scp/rsync
```

```bash
cp .env.example .env
nano .env
```

Exemplo de `.env` de produção:

```env
DATABASE_URL="mysql://eletro:SENHA_ENCODED@localhost:3306/eletro_stock"
AUTH_SECRET="cole-aqui-um-segredo-longo"
APP_URL="https://estoque.eletromall.com.br"
UPLOAD_DIR="uploads"
MAX_UPLOAD_MB="8"
```

Gere o `AUTH_SECRET`:

```bash
openssl rand -base64 48
```

Instale, migre e compile:

```bash
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run build
mkdir -p uploads
```

O seed deixa o estoque vazio e cria só os três usuários padrão. Rode **apenas na primeira instalação** — se rodar de novo, apaga produtos e histórico. Troque as senhas no primeiro acesso.

### 4. Serviço systemd

Crie `/etc/systemd/system/eletro-stock.service`:

```ini
[Unit]
Description=Eletro-Stock
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/eletro-stock
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ajuste permissões da pasta `uploads` para o usuário do serviço:

```bash
sudo chown -R www-data:www-data /var/www/eletro-stock
sudo chmod -R u+rwX /var/www/eletro-stock/uploads
sudo systemctl daemon-reload
sudo systemctl enable --now eletro-stock
sudo systemctl status eletro-stock
```

### 5. Nginx + HTTPS

Crie `/etc/nginx/sites-available/eletro-stock`:

```nginx
server {
    listen 80;
    server_name estoque.eletromall.com.br;
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/eletro-stock /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d estoque.eletromall.com.br
```

Com `NODE_ENV=production`, o cookie de sessão só é enviado em HTTPS. Sem certificado, o login não funciona no navegador.

### 6. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
```

Não abra a porta 3306 para a internet.

### 7. Atualizar o sistema

```bash
cd /var/www/eletro-stock
sudo systemctl stop eletro-stock
git pull
npm ci
npx prisma migrate deploy
npm run build
sudo systemctl start eletro-stock
```

A pasta `uploads/` precisa ser preservada. Não apague esse diretório em deploys.

### 8. Backup

Banco:

```bash
mysqldump -u eletro -p eletro_stock > /backup/eletro-stock-$(date +%F).sql
```

Fotos e anexos:

```bash
tar -czf /backup/eletro-stock-uploads-$(date +%F).tar.gz /var/www/eletro-stock/uploads
```

Agende os dois no `cron` (diário).

### Checklist rápido

- [ ] Node 20+ e MySQL 8
- [ ] `.env` com `AUTH_SECRET` novo e `APP_URL` em HTTPS
- [ ] `npx prisma migrate deploy` e `npx prisma db seed` **só na primeira instalação**
- [ ] `npm run build` e serviço systemd ativo
- [ ] Nginx com `client_max_body_size 20M` (upload de fotos/planilha)
- [ ] Certificado HTTPS
- [ ] Pasta `uploads` gravável e incluída no backup
- [ ] Senhas padrão do seed alteradas

