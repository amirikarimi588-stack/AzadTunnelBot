
const TelegramBot = require("node-telegram-bot-api");

// -----------------------------
// تنظیمات اصلی
// -----------------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const MAIN_CHANNEL = "@Azadtunnel1";       // کانال اصلی
const ADMIN_ID = 8571263967;               // آیدی عددی تو
const CARD_NUMBER = "6219861435903868";    // شماره کارت

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// دیتابیس ساده
let users = {};

function getUser(uid) {
  if (!users[uid]) {
    users[uid] = { services: [], pending: null };
  }
  return users[uid];
}

// چک عضویت کانال
async function isMember(uid) {
  try {
    const m = await bot.getChatMember(MAIN_CHANNEL, uid);
    return ["member", "administrator", "creator"].includes(m.status);
  } catch {
    return false;
  }
}

// -----------------------------
// /start
// -----------------------------
bot.onText(/\/start/, async (msg) => {
  const uid = msg.from.id;

  if (!(await isMember(uid))) {
    const opts = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📢 عضویت در کانال", url: "https://t.me/Azadtunnel1" }],
          [{ text: "✅ تایید عضویت", callback_data: "check" }],
        ],
      },
    };

    bot.sendMessage(
      uid,
      "سلام به آزاد تونل 🏔️\n\nبرای استفاده از ربات باید عضو کانال شوید.\nبعد از عضویت، روی «تایید عضویت» بزنید.",
      opts
    );
  } else {
    sendMenu(uid);
  }
});

// -----------------------------
// منوی اصلی
// -----------------------------
function sendMenu(uid) {
  bot.sendMessage(uid, "منوی اصلی آزاد تونل 🏔️", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛒 خرید سرویس", callback_data: "buy" }],
        [{ text: "👤 حساب کاربری", callback_data: "acc" }],
        [{ text: "📂 سرویس‌های من", callback_data: "my" }],
        [{ text: "💳 کیف پول", callback_data: "wallet" }],
        [{ text: "🆘 پشتیبانی", callback_data: "sup" }],
      ],
    },
  });
}

// -----------------------------
// هندلر دکمه‌ها
// -----------------------------
bot.on("callback_query", async (c) => {
  const uid = c.from.id;
  const u = getUser(uid);

  // تایید عضویت
  if (c.data === "check") {
    if (await isMember(uid)) {
      bot.editMessageText("عضویت تایید شد 👌", {
        chat_id: uid,
        message_id: c.message.message_id,
      });
      sendMenu(uid);
    } else {
      bot.answerCallbackQuery(c.id, { text: "❌ هنوز عضو کانال نیستی" });
    }
  }

  // خرید سرویس
  if (c.data === "buy") {
    bot.editMessageText("نوع تعرفه را انتخاب کنید:", {
      chat_id: uid,
      message_id: c.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌤 تعرفه‌های سبک", callback_data: "light" }],
          [{ text: "🌋 تعرفه‌های سنگین", callback_data: "heavy" }],
        ],
      },
    });
  }

  // تعرفه‌های سنگین
  if (c.data === "heavy") {
    bot.editMessageText("🌋 تعرفه‌های سنگین:", {
      chat_id: uid,
      message_id: c.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: "200GB / 300K", callback_data: "h200" }],
          [{ text: "300GB / 400K", callback_data: "h300" }],
          [{ text: "500GB / 600K", callback_data: "h500" }],
        ],
      },
    });
  }

  // انتخاب سنگین‌ها
  if (["h200", "h300", "h500"].includes(c.data)) {
    const plans = {
      h200: ["200GB / 2 ماهه", 300000],
      h300: ["300GB / 2 ماهه", 400000],
      h500: ["500GB / 2 ماهه", 600000],
    };

    const [desc, price] = plans[c.data];
    u.pending = { desc, price };

    bot.editMessageText(
      `سرویس انتخابی:\n${desc}\nقیمت: ${price} تومان\n\nشماره کارت:\n${CARD_NUMBER}\n\nبعد از واریز، عکس فیش را ارسال کنید.`,
      { chat_id: uid, message_id: c.message.message_id }
    );
  }

  // تعرفه‌های سبک
  if (c.data === "light") {
    bot.editMessageText("مدت زمان:", {
      chat_id: uid,
      message_id: c.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: "۱ ماهه", callback_data: "l1" }],
          [{ text: "۲ ماهه", callback_data: "l2" }],
          [{ text: "۳ ماهه", callback_data: "l3" }],
        ],
      },
    });
  }

  // سبک → انتخاب حجم
  if (c.data.startsWith("l")) {
    const prices = {
      l1: { 5: 20000, 10: 40000, 20: 60000, 30: 120000, 50: 200000 },
      l2: { 5: 30000, 10: 60000, 20: 120000, 30: 180000, 50: 300000 },
      l3: { 5: 40000, 10: 80000, 20: 160000, 30: 240000, 50: 400000 },
    };

    const opts = {
      inline_keyboard: Object.entries(prices[c.data]).map(([g, p]) => [
        { text: `${g}GB / ${p}`, callback_data: `${c.data}_${g}` },
      ]),
    };

    bot.editMessageText("انتخاب حجم:", {
      chat_id: uid,
      message_id: c.message.message_id,
      reply_markup: opts,
    });
  }

  // سبک → انتخاب نهایی
  if (c.data.includes("_")) {
    const [period, size] = c.data.split("_");

    const priceMap = {
      l1: { 5: 20000, 10: 40000, 20: 60000, 30: 120000, 50: 200000 },
      l2: { 5: 30000, 10: 60000, 20: 120000, 30: 180000, 50: 300000 },
      l3: { 5: 40000, 10: 80000, 20: 160000, 30: 240000, 50: 400000 },
    };

    const price = priceMap[period][size];
    const desc = `${size}GB / ${period}`;

    u.pending = { desc, price };

    bot.editMessageText(
      `سرویس انتخابی:\n${desc}\nقیمت: ${price} تومان\n\nشماره کارت:\n${CARD_NUMBER}\n\nبعد از واریز، عکس فیش را ارسال کنید.`,
      { chat_id: uid, message_id: c.message.message_id }
    );
  }

  // حساب کاربری
  if (c.data === "acc") {
    bot.editMessageText(
      `👤 حساب کاربری:\nآیدی عددی: ${uid}\nتعداد سرویس‌ها: ${u.services.length}`,
      { chat_id: uid, message_id: c.message.message_id }
    );
  }

  // سرویس‌های من
  if (c.data === "my") {
    if (!u.services.length) {
      bot.editMessageText("📂 هیچ سرویسی ندارید.", {
        chat_id: uid,
        message_id: c.message.message_id,
      });
    } else {
      const txt =
        "📂 سرویس‌های شما:\n" +
        u.services.map((s) => `- ${s.desc}`).join("\n");

      bot.editMessageText(txt, {
        chat_id: uid,
        message_id: c.message.message_id,
      });
    }
  }

  // کیف پول
  if (c.data === "wallet") {
    bot.editMessageText("💳 کیف پول: 0 تومان", {
      chat_id: uid,
      message_id: c.message.message_id,
    });
  }

  // پشتیبانی
  if (c.data === "sup") {
    bot.editMessageText("🆘 پشتیبانی:\n@Azadtunnel1", {
      chat_id: uid,
      message_id: c.message.message_id,
    });
  }
});

// -----------------------------
// دریافت عکس فیش
// -----------------------------
bot.on("photo", (msg) => {
  const uid = msg.from.id;
  const u = getUser(uid);

  if (!u.pending) {
    bot.sendMessage(uid, "سفارشی ثبت نشده.");
    return;
  }

  bot.sendMessage(uid, "فیش دریافت شد. منتظر تایید باشید.");

  bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, {
    caption: `فیش جدید:\nکاربر: ${uid}\nسرویس: ${u.pending.desc}\nقیمت: ${u.pending.price}`,
  });
});

// -----------------------------
// دستور ادمین برای ارسال کانفیگ
// -----------------------------
bot.onText(/\/sendconfig (.+) (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) {
    bot.sendMessage(msg.chat.id, "اجازه نداری.");
    return;
  }

  const uid = match[1];
  const cfg = match[2];

  bot.sendMessage(uid, `فیش تایید شد.\nاین هم کانفیگ شما:\n\n${cfg}`);
  bot.sendMessage(msg.chat.id, "ارسال شد.");
});
