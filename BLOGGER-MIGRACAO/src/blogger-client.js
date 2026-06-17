const { google } = require("googleapis");
require("dotenv").config();

const BLOGGER_SCOPE = "https://www.googleapis.com/auth/blogger";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

function createOAuthClient() {
  const client = new google.auth.OAuth2(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
  );

  client.setCredentials({
    refresh_token: requiredEnv("GOOGLE_REFRESH_TOKEN"),
  });

  return client;
}

function createBloggerClient() {
  return google.blogger({
    version: "v3",
    auth: createOAuthClient(),
  });
}

async function publishPost({ title, content, labels = [], status = "DRAFT" }) {
  const blogId = requiredEnv("BLOGGER_BLOG_ID");
  const blogger = createBloggerClient();

  const response = await blogger.posts.insert({
    blogId,
    isDraft: status !== "LIVE",
    requestBody: {
      kind: "blogger#post",
      title,
      content,
      labels,
    },
  });

  return response.data;
}

async function getAccessTokenForTest() {
  const client = createOAuthClient();
  const token = await client.getAccessToken();
  return token && token.token;
}

module.exports = {
  BLOGGER_SCOPE,
  createBloggerClient,
  createOAuthClient,
  getAccessTokenForTest,
  publishPost,
};
