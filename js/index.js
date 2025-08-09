const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
require("dotenv").config();

// Create bot instance (polling mode)
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Function to check link with IPQS
async function checkLink(chatId, link, replyToMessageId, isGroup, messageId, senderId, senderName, msg) {
    try {
        // Step 1: Send scanning message
        let scanningMsg = await bot.sendMessage(chatId, "🔍 *Scanning link...* ⏳", {
            parse_mode: "Markdown",
            reply_to_message_id: replyToMessageId
        });

        // Step 2: Fake progress animation
        const stages = ["🔍 Scanning... 20%", "🔍 Scanning... 55%", "🔍 Scanning... 90%"];
        for (const stage of stages) {
            await new Promise((res) => setTimeout(res, 500));
            await bot.editMessageText(stage, {
                chat_id: chatId,
                message_id: scanningMsg.message_id,
                parse_mode: "Markdown"
            });
        }

        // Step 3: Call IPQS API
        const res = await axios.get(
            `https://ipqualityscore.com/api/json/url/${process.env.IPQS_API_KEY}/${encodeURIComponent(link)}`,
            { params: { strictness: 1 } }
        );

        const isMalicious = res.data.unsafe || res.data.risk_score > 50;

        // Step 4: Delete malicious message if in group
        if (isGroup && isMalicious) {
            try {
                await bot.deleteMessage(chatId, messageId);

                // Send private warning
                await bot.sendMessage(senderId, `⚠ Hello *${senderName}*,
Your link has been removed from *${msg.chat.title}* because it was flagged as malicious.

🛑 Risk Score: ${res.data.risk_score}%
🔗 Link: ${link}`, { parse_mode: "Markdown" });
            } catch (err) {
                console.log("Cannot delete message or send private warning:", err.message);
            }
        }

        // Step 5: Send scan results in chat
        if (isMalicious) {
            await bot.editMessageText(
                `🚨🚨🚨 *MALICIOUS LINK DETECTED!* 🚨🚨🚨

🛑 *RISK SCORE:* ${res.data.risk_score}%
🔗 *LINK:* ${link}

⚠ This link may be used for phishing, scams, or malware.
💡 Avoid clicking and warn others.`,
                {
                    chat_id: chatId,
                    message_id: scanningMsg.message_id,
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🔎 View Detailed Report", url: res.data.domain || link }]
                        ]
                    }
                }
            );
        } else {
            await bot.editMessageText(`✅ *Safe Link*  
${link}`, {
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
        console.error("Error checking link:", error.message);
        await bot.sendMessage(chatId, "❌ Error scanning the link.");
    }
}

// Listen for all messages in private & group chats
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const isGroup = msg.chat.type.includes("group");

    if (!text) return;

    // Detect links
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const foundLinks = text.match(urlPattern);

    if (foundLinks) {
        for (const link of foundLinks) {
            await checkLink(
                chatId,
                link,
                msg.message_id,
                isGroup,
                msg.message_id,
                msg.from.id,
                msg.from.first_name || "User",
                msg
            );
        }
    }
});

// Keep alive (Railway / Render)
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(3000, () => console.log("Server running on port 3000"));
