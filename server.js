import { Telegraf } from "telegraf";
import userModel from "./src/models/user.model.js";
import connectDb from "./src/config/db.js";

const bot = new Telegraf(process.env.TELEGRAM_BOT_API);

try {
  connectDb();
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

bot.launch();
// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
