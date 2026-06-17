# Blogger Migracao

Pasta isolada para preparar a futura publicacao do site hibrido no Blogger.

## Endpoint correto

Para criar posts, a Blogger API v3 usa:

```http
POST https://www.googleapis.com/blogger/v3/blogs/{blogId}/posts/
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Com a biblioteca `googleapis`, o script usa `blogger.posts.insert()`.

## Autenticacao

Use OAuth 2.0 com o scope:

```text
https://www.googleapis.com/auth/blogger
```

API Key nao serve para criar post. Ela e util principalmente para leitura de dados publicos.

## Configuracao local

```bash
cp .env.example .env
```

Preencha:

```text
BLOGGER_BLOG_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
BLOGGER_POST_STATUS=DRAFT
```

Nunca commitar `.env`.

## Testar autenticacao

```bash
npm run token:test
```

## Criar post de teste como rascunho

```bash
npm run post:draft
```

## Publicar ao vivo

Use apenas quando o fluxo estiver validado:

```bash
npm run post:live
```

## Proxima integracao com o site hibrido

Quando a migracao for autorizada, o publicador atual do site hibrido pode chamar
`src/blogger-client.js` para enviar somente materias aprovadas no fluxo editorial.
