const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
require("dotenv").config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // Detect any links in the message
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const foundLinks = text.match(urlPattern);

    if (foundLinks) {
        for (const link of foundLinks) {
            // Step 1: Send initial scanning message
            let scanningMsg = await bot.sendMessage(chatId, "🔍 *Scanning link...* ⏳", { parse_mode: "Markdown" });

            // Step 2: Fake progress animation
            const stages = ["🔍 Scanning link... 10%", "🔍 Scanning link... 45%", "🔍 Scanning link... 80%"];
            for (const stage of stages) {
                await new Promise((res) => setTimeout(res, 800));
                await bot.editMessageText(stage, {
                    chat_id: chatId,
                    message_id: scanningMsg.message_id,
                    parse_mode: "Markdown"
                });
            }

            // Step 3: Check the link using API
            try {
                const res = await axios.get(`https://api.phishcheck.me/?url=${encodeURIComponent(link)}`);

                // Step 4: Show result
                if (res.data.risk_score > 50 || res.data.suspicious) {
                    await bot.editMessageText(`⚠ *Malicious Link Detected!* \n${link}`, {
                        chat_id: chatId,
                        message_id: scanningMsg.message_id,
                        parse_mode: "Markdown",
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "🔎 View Report", url: `https://www.virustotal.com/gui/url/${encodeURIComponent(link)}` }],
                                [{ text: "🚫 Ignore", callback_data: "ignore" }]
                            ]
                        }
                    });
                } else {
                    await bot.editMessageText(`✅ *Safe Link* \n${link}`, {
                        chat_id: chatId,
                        message_id: scanningMsg.message_id,
                        parse_mode: "Markdown",
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "🌐 Open Link", url: link }]
                            ]
                        }
                    });
                }
            } catch (error) {
                await bot.editMessageText("❌ Error checking link.", {
                    chat_id: chatId,
                    message_id: scanningMsg.message_id
                });
                console.error(error);
            }
        }
    }
});
