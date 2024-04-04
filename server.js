import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import userModel from "./src/models/user.model.js";
import eventsModel from "./src/models/events.model.js";
import connectDb from "./src/config/db.js";
import OpenAI from "openai";
// import time from "time";
const bot = new Telegraf(process.env.TELEGRAM_BOT_API);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY, // This is the default and can be omitted
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

try {
  connectDb();
  console.log("Connected to the database");
} catch (error) {
  console.log(error);
  process.kill(process.pid, "SIGTERM");
}

bot.start(async (ctx) => {
  const from = ctx.update.message.from;
  try {
    await userModel.findOneAndUpdate(
      {
        tgId: from.id,
      },
      {
        $setOnInsert: {
          firstName: from.first_name,
          lastName: from.last_name,
          isBot: from.is_bot,
          username: from.username,
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    await ctx.reply(
      `💌 Welcome ${from.first_name} to the mail creation bot! 🌟 I'm here to help you craft messages for any occasion. 🎉 Just let me know what you need, and I'll assist you in creating a message that sparkles with joy and warmth. 💖 Feel free to share your details, and let's create something wonderful together! ✨`
    );
  } catch (error) {
    console.error("Error while saving user data", error);
    await ctx.reply("Sorry, something went wrong. Please try again later.");
  } 
});

bot.command("generate", async (ctx) => {
  // get list of events form the users
  // make open API CALL
  // store token count
  // send response
  const from = ctx.update.message.from;
  // await sleep(1000);
  const events = await eventsModel.find({
    tgId: from.id,
  });
  // await sleep(1000);
  console.log(
    events
      .slice(-1)
      .filter((event) => event.text)
      .join(",")
  );
  if (events.length === 0) {
    await ctx.reply(
      "💌 You haven't shared any messages with me yet. Please send me a message to get started. 🌟"
    );
    return;
  }

  try {
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Act as a senior mail replying/generating authority. Generate a mail response for the following customer query along with the mail subject:",
        },
        {
          role: "user",
          content: `Write Like a Human, for human, be polite, be professional., Write a mail for me for the mentioned content and respectable audience along with subject. Don't forget to add a subject line. Ensure Tone of Conversation is polite and professional.:\n${
            events[events.length - 1].text
          }`,
        },
      ],
      model: process.env.OPENAI_MODEL,
    });

    console.log("chatCompletion", chatCompletion);
    await userModel.findOneAndUpdate(
      {
        tgId: from.id,
      },
      {
        $inc: {
          promptTokens: chatCompletion.usage.prompt_tokens,
          completionTokens: chatCompletion.usage.completion_tokens,
        },
      }
    );
    await ctx.reply("💌 Generating messages... 🌟");
    await ctx.reply(chatCompletion.choices[0].message.content);
  } catch (error) {
    console.log("Error while generating message", error);
    await ctx.reply("Sorry, something went wrong.Can't generate Now.");
  }
});

bot.on(message("text"), async (ctx) => {
  const from = ctx.update.message.from;
  const message = ctx.update.message.text;
  try {
    await eventsModel.create({
      text: message,
      tgId: from.id,
    });
    await ctx.reply(
      "📝 Got it! I've received your message and will keep them coming. Once I've sent all the messages, please send me a text with /generate."
    );
  } catch (error) {
    console.error("Error while saving event data", error);
    await ctx.reply("Sorry, something went wrong. Please try again later.");
  }
});

bot.launch();
// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
