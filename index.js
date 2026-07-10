const TelegramBot = require("node-telegram-bot-api");

// -----------------------------
// تنظیمات اصلی
// -----------------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const MAIN_CHANNEL = "@Azadtunnel1";       // کانال اصلی
const ADMIN_ID = 8571263967;               // آیدی عددی تو
const CARD_NUMBER = "6219861435903868";    // شماره کارت (به نام کریمی)

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// -----------------------------
// کیبورد ثابت پایین صفحه
// -----------------------------
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      ["🛒 خرید سرویس", "📂 سرویس‌های من"],
      ["👤 حساب کاربری", "💳 کیف پول"],
      ["🆘 پشتیبانی"]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

// -----------------------------
// دیتابیس ساده
// -----------------------------
let users = {};
let waitingConfig = {}; // ادمین → کاربر هدف برای ارسال کانفیگ

function getUser(uid) {
  if (!users[uid]) {
    users[uid] = { services: [], pending: null };
  }
  return users[uid];
}

// -----------------------------
// چک عضویت کانال
// -----------------------------
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
    bot.sendMessage(uid, "منوی اصلی آزاد تونل 🏔️", mainKeyboard);
  }
});

// -----------------------------
// منوی اصلی (با دکمه‌های ثابت)
// -----------------------------
bot.on("message", (msg) => {
  const uid = msg.from.id;
  const text = msg.text;
  const u = getUser(uid);

  if (!text) return;

  // اگر ادمین در حالت انتظار کانفیگ است، متن را به عنوان کانفیگ بفرست
  if (waitingConfig[uid]) {
    const target = waitingConfig[uid];

    bot.sendMessage(
      target,
      `✅ فیش تایید شد.\nاین هم کانفیگ شما:\n\n${text}`
    );

    bot.sendMessage(uid, "✔️ کانفیگ برای کاربر ارسال شد.");
    delete waitingConfig[uid];
    return;
  }

  if (text === "🛒 خرید سرویس") {
    bot.sendMessage(uid, "🌐 لطفاً نوع تعرفه را انتخاب کنید:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌤 تعرفه‌های سبک", callback_data: "light" }],
          [{ text: "🌋 تعرفه‌های سنگین", callback_data: "heavy" }],
        ],
      },
    });
  }

  if (text === "📂 سرویس‌های من") {
    if (!u.services.length) {
      bot.sendMessage(uid, "📂 هیچ سرویسی ثبت نشده است.");
    } else {
      const txt =
        "📂 سرویس‌های شما:\n" +
        u.services.map((s) => `- ${s.desc}`).join("\n");
      bot.sendMessage(uid, txt);
    }
  }

  if (text === "👤 حساب کاربری") {
    bot.sendMessage(uid, `👤 حساب کاربری:\nآیدی عددی: ${uid}`);
  }

  if (text === "💳 کیف پول") {
    bot.sendMessage(uid, "💳 کیف پول: 0 تومان\n(در حال حاضر کیف پول فعال نیست.)");
  }

  if (text === "🆘 پشتیبانی") {
    bot.sendMessage(uid, "🆘 پشتیبانی:\nبرای ارتباط با پشتیبانی به این آیدی پیام دهید:\n@Azadtunnel1");
  }
});

// -----------------------------
// هندلر دکمه‌های اینلاین
// -----------------------------
bot.on("callback_query", async (c) => {
  const uid = c.from.id;
  const u = getUser(uid);

  // دکمه مخصوص ارسال کانفیگ (فقط برای ادمین)
  if (c.data.startsWith("sendcfg_")) {
    if (uid !== ADMIN_ID) {
      bot.answerCallbackQuery(c.id, { text: "این دکمه فقط برای ادمین است." });
      return;
    }

    const targetUser = c.data.split("_")[1];
    waitingConfig[uid] = targetUser;

    bot.sendMessage(
      uid,
      "🔧 لطفاً کانفیگ یا عکس QR را ارسال کنید.\nپس از ارسال، ربات آن را برای کاربر ارسال می‌کند."
    );

    bot.answerCallbackQuery(c.id, { text: "در انتظار کانفیگ..." });
    return;
  }

  // تایید عضویت
  if (c.data === "check") {
    if (await isMember(uid)) {
      bot.editMessageText("✅ عضویت شما در کانال تایید شد.\n\nمنوی اصلی برای شما فعال شد. 🌟", {
        chat_id: uid,
        message_id: c.message.message_id,
      });
      bot.sendMessage(uid, "منوی اصلی آزاد تونل 🏔️", mainKeyboard);
    } else {
      bot.answerCallbackQuery(c.id, { text: "❌ هنوز عضو کانال نیستی. لطفاً اول عضو کانال شو." });
    }
    return;
  }

  // خرید سرویس
  if (c.data === "buy") {
    bot.editMessageText("🌐 لطفاً نوع تعرفه را انتخاب کنید:", {
      chat_id: uid,
      message_id: c.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌤 تعرفه‌های سبک", callback_data: "light" }],
          [{ text: "🌋 تعرفه‌های سنگین", callback_data: "heavy" }],
        ],
      },
    });
    return;
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
    return;
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
      `📄 *فیش شما آماده است*\n\n` +
      `🛒 *نوع سرویس:* ${desc}\n` +
      `💰 *قیمت:* ${price} تومان\n\n` +
      `💳 *شماره کارت:* \`${CARD_NUMBER}\`\n` +
      `👤 *به نام:* کریمی\n\n` +
      `📸 لطفاً بعد از واریز، *عکس فیش* را ارسال کنید تا تایید شود.\n\n` +
      `✅ با تشکر از اعتماد شما 🌟`,
      {
        chat_id: uid,
        message_id: c.message.message_id,
        parse_mode: "Markdown"
      }
    );
    return;
  }

  // تعرفه‌های سبک
  if (c.data === "light") {
    bot.editMessageText("🌤 لطفاً مدت زمان سرویس را انتخاب کنید:", {
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
    return;
  }

  // سبک → انتخاب حجم
  if (["l1", "l2", "l3"].includes(c.data)) {
    const prices = {
      l1: { 5: 20000, 10: 40000, 20: 60000, 30: 120000, 50: 200000 },
      l2: { 5: 30000, 10: 60000, 20: 120000, 30: 180000, 50: 300000 },
      l3: { 5: 40000, 10: 80000, 20: 160000, 30: 240000, 50: 400000 },
    };

    const opts = {
      inline_keyboard: Object.entries(prices[c.data]).map(([g, p]) => [
        { text: `${g}GB / ${p} تومان`, callback_data: `${c.data}_${g}` },
      ]),
    };

    bot.editMessageText("📦 لطفاً حجم سرویس را انتخاب کنید:", {
      chat_id: uid,
      message_id: c.message.message_id,
      reply_markup: opts,
    });
    return;
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
      `📄 *فیش شما آماده است*\n\n` +
      `🛒 *نوع سرویس:* ${desc}\n` +
      `💰 *قیمت:* ${price} تومان\n\n` +
      `💳 *شماره کارت:* \`${CARD_NUMBER}\`\n` +
      `👤 *به نام:* کریمی\n\n` +
      `📸 لطفاً بعد از واریز، *عکس فیش* را ارسال کنید تا تایید شود.\n\n` +
      `✨ از انتخاب شما سپاسگزاریم 🌟`,
      {
        chat_id: uid,
        message_id: c.message.message_id,
        parse_mode: "Markdown"
      }
    );
    return;
  }

  // حساب کاربری (اینلاین)
  if (c.data === "acc") {
    bot.editMessageText(
      `👤 حساب کاربری:\nآیدی عددی: ${uid}\nتعداد سرویس‌ها: ${u.services.length}`,
      { chat_id: uid, message_id: c.message.message_id }
    );
    return;
  }

  // سرویس‌های من (اینلاین)
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
    return;
  }

  // کیف پول (اینلاین)
  if (c.data === "wallet") {
    bot.editMessageText("💳 کیف پول: 0 تومان", {
      chat_id: uid,
      message_id: c.message.message_id,
    });
    return;
  }

  // پشتیبانی (اینلاین)
  if (c.data === "sup") {
    bot.editMessageText("🆘 پشتیبانی:\n@Azadtunnel1", {
      chat_id: uid,
      message_id: c.message.message_id,
    });
    return;
  }
});

// -----------------------------
// دریافت عکس فیش (کاربر) و عکس QR (ادمین)
// -----------------------------
bot.on("photo", (msg) => {
  const uid = msg.from.id;

  // اگر ادمین در حالت انتظار کانفیگ است و عکس فرستاد → عکس را برای کاربر بفرست
  if (waitingConfig[uid]) {
    const target = waitingConfig[uid];

    bot.sendPhoto(
      target,
      msg.photo[msg.photo.length - 1].file_id,
      { caption: "🔐 کانفیگ شما آماده است" }
    );

    bot.sendMessage(uid, "✔️ عکس QR برای کاربر ارسال شد.");
    delete waitingConfig[uid];
    return;
  }

  const u = getUser(uid);

  if (!u.pending) {
    bot.sendMessage(uid, "❌ سفارشی ثبت نشده.\nلطفاً ابتدا از منوی «🛒 خرید سرویس» یک سرویس انتخاب کنید.");
    return;
  }

  bot.sendMessage(uid, "📸 فیش دریافت شد. منتظر تایید باشید ✅");

  bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, {
    caption:
      `📥 فیش جدید:\n` +
      `👤 کاربر: ${uid}\n` +
      `🛒 سرویس: ${u.pending.desc}\n` +
      `💰 قیمت: ${u.pending.price} تومان`,
    reply_markup: {
      inline_keyboard: [
        [{ text: "✔️ ارسال کانفیگ", callback_data: `sendcfg_${uid}` }]
      ]
    }
  });
});

// -----------------------------
// دستور ادمین برای ارسال کانفیگ با متن (اختیاری)
// -----------------------------
bot.onText(/\/sendconfig (.+) (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) {
    bot.sendMessage(msg.chat.id, "❌ اجازه نداری از این دستور استفاده کنی.");
    return;
  }

  const uid = match[1];
  const cfg = match[2];

  bot.sendMessage(uid, `✅ فیش تایید شد.\nاین هم کانفیگ شما:\n\n${cfg}`);
  bot.sendMessage(msg.chat.id, "📤 کانفیگ برای کاربر ارسال شد.");
});
``````js
const TelegramBot = require("node-telegram-bot-api");

// -----------------------------
// تنظیمات اصلی
// -----------------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const MAIN_CHANNEL = "@Azadtunnel1";       // کانال اصلی
const ADMIN_ID = 8571263967;               // آیدی عددی تو
const CARD_NUMBER = "6219861435903868";    // شماره کارت (به نام کریمی)

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// -----------------------------
// کیبورد ثابت پایین صفحه
// -----------------------------
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      ["🛒 خرید سرویس", "📂 سرویس‌های من"],
      ["👤 حساب کاربری", "💳 کیف پول"],
      ["🆘 پشتیبانی"]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

// -----------------------------
// دیتابیس ساده
// -----------------------------
let users = {};
let waitingConfig = {}; // ادمین → کاربر هدف برای ارسال کانفیگ

function getUser(uid) {
  if (!users[uid]) {
    users[uid] = { services: [], pending: null };
  }
  return users[uid];
}

// -----------------------------
// چک عضویت کانال
// -----------------------------
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
    bot.sendMessage(uid, "منوی اصلی آزاد تونل 🏔️", mainKeyboard);
  }
});

// -----------------------------
// منوی اصلی (با دکمه‌های ثابت)
// -----------------------------
bot.on("message", (msg) => {
  const uid = msg.from.id;
  const text = msg.text;
  const u = getUser(uid);

  if (!text) return;

  // اگر ادمین در حالت انتظار کانفیگ است، متن را به عنوان کانفیگ بفرست
  if (waitingConfig[uid]) {
    const target = waitingConfig[uid];

    bot.sendMessage(
      target,
      `✅ فیش تایید شد.\nاین هم کانفیگ شما:\n\n${text}`
    );

    bot.sendMessage(uid, "✔️ کانفیگ برای کاربر ارسال شد.");
    delete waitingConfig[uid];
    return;
  }

  if (text === "🛒 خرید سرویس") {
    bot.sendMessage(uid, "🌐 لطفاً نوع تعرفه را انتخاب کنید:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌤 تعرفه‌های سبک", callback_data: "light" }],
          [{ text: "🌋 تعرفه‌های سنگین", callback_data: "heavy" }],
        ],
      },
    });
  }

  if (text === "📂 سرویس‌های من") {
    if (!u.services.length) {
      bot.sendMessage(uid, "📂 هیچ سرویسی ثبت نشده است.");
    } else {
      const txt =
        "📂 سرویس‌های شما:\n" +
        u.services.map((s) => `- ${s.desc}`).join("\n");
      bot.sendMessage(uid, txt);
    }
  }

  if (text === "👤 حساب کاربری") {
    bot.sendMessage(uid, `👤 حساب کاربری:\nآیدی عددی: ${uid}`);
  }

  if (text === "💳 کیف پول") {
    bot.sendMessage(uid, "💳 کیف پول: 0 تومان\n(در حال حاضر کیف پول فعال نیست.)");
  }

  if (text === "🆘 پشتیبانی") {
    bot.sendMessage(uid, "🆘 پشتیبانی:\nبرای ارتباط با پشتیبانی به این آیدی پیام دهید:\n@Azadtunnel1");
  }
});

// -----------------------------
// هندلر دکمه‌های اینلاین
// -----------------------------
bot.on("callback_query", async (c) => {
  const uid = c.from.id;
  const u = getUser(uid);

  // دکمه مخصوص ارسال کانفیگ (فقط برای ادمین)
  if (c.data.startsWith("sendcfg_")) {
    if (uid !== ADMIN_ID) {
      bot.answerCallbackQuery(c.id, { text: "این دکمه فقط برای ادمین است." });
      return;
    }

    const targetUser = c.data.split("_")[1];
    waitingConfig[uid] = targetUser;

    bot.sendMessage(
      uid,
      "🔧 لطفاً کانفیگ یا عکس QR را ارسال کنید.\nپس از ارسال، ربات آن را برای کاربر ارسال می‌کند."
    );

    bot.answerCallbackQuery(c.id, { text: "در انتظار کانفیگ..." });
    return;
  }

  // تایید عضویت
  if (c.data === "check") {
    if (await isMember(uid)) {
      bot.editMessageText("✅ عضویت شما در کانال تایید شد.\n\nمنوی اصلی برای شما فعال شد. 🌟", {
        chat
