/**
 * Automacao Diaria do Caique — BuzzPop
 * 
 * TODO de manha:
 *   1. npm run hybrid:refresh (coleta + escreve + valida)
 *   2. npm run site:final && npm run site:gh-pages
 *   3. git add -A && git commit -m "curadoria do dia" && git push
 *   4. Esperar GitHub Pages build (~30s)
 *   5. Enviar mensagem de teste para Rafael no Telegram
 *   6. Se Rafael aprovar, enviar para grupo Buzz Pop no WhatsApp
 * 
 * Para enviar mensagem no Telegram do Rafael:
 *   usage: node scripts/automacao-caique-buzzpop.cjs --send-test
 * 
 * Para enviar para o grupo WhatsApp Buzz Pop:
 *   usage: node scripts/automacao-caique-buzzpop.cjs --send-group
 */

const GITHUB_PAGES_URL = "https://criatixagencia-collab.github.io/site-hibrido/selecao-dia/";
const TELEGRAM_RAFAEL = "8447763556";
const WHATSAPP_GROUP = "120363427477009794@g.us";

function buildMessage() {
  return `📋 *Seleção do Dia — BuzzPop*

As notícias mais quentes do entretenimento brasileiro.

${GITHUB_PAGES_URL}

🔥 *Muito noticiada:*
• Lucas Lima se declara à namorada
• Paula Fernandes assume romance

📈 *Em alta:*
• Gil do Vigor celebra doutorado
• Tati Machado anuncia gravidez
• Graciele chora com cirurgia da filha
• Viih Tube e Eliezer no Encontro
• Programas da Globo na Copa
• Taylor Swift no Hall da Fama
• Olivia Rodrigo desabafa
• Ivete Sangalo com a taça

📰 *Ver a página completa:*
${GITHUB_PAGES_URL}

#BuzzPop #Entretenimento`;
}

const action = process.argv[2];
if (action === "--send-test") {
  console.log("=== MENSAGEM PARA RAFAEL (Telegram) ===");
  console.log(buildMessage());
  console.log("");
  console.log("Use sessions_send para a sessao Telegram do Rafael");
  console.log("Session key: agent:main:telegram:direct:8447763556");
} else if (action === "--send-group") {
  console.log("=== MENSAGEM PARA GRUPO BUZZ POP (WhatsApp) ===");
  console.log(buildMessage());
  console.log("");
  console.log("Use sessions_send para o grupo WhatsApp Buzz Pop");
  console.log("Group ID: " + WHATSAPP_GROUP);
} else {
  console.log(buildMessage());
  console.log("");
  console.log("Use --send-test para Rafael ou --send-group para o Buzz Pop");
}
