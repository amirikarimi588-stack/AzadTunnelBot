const TelegramBot = require("node-telegram-bot-api");

// -----------------------------
// تنظیمات اصلی
// -----------------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const MAIN_CHANNEL = "@Azadtunnel1";
const ADMIN_ID = 8571263967;
const CARD_NUMBER = "6219861435903868";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// -----------------------------
// کیبورد ثابت پایین صفحه برای همه
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

// همیشه منو را فعال نگه می‌دارد
function ensureKeyboard(uid) {
  bot.sendMessage(uid, "منوی اصلی آزاد تونل 🏔️", mainKeyboard);
}

// -----------------------------
// دیتابیس ساده کاربران
// -----------------------------
let users = {};
let waitingConfig = {}; // ادمین → کاربر هدف برای کانفیگ

function getUser(uid) {
  if (!users[uid]) {
    users[uid] = {
      services: [],
      pendingService: null,
      pendingWallet: null,
      balance: 0
    };
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
    bot.sendMessage(
      uid,
      "سلام به آزاد تونل 🏔️\n\nبرای استفاده از ربات باید عضو کانال شوید.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 عضویت در کانال", url: "https://t.me/Azadtunnel1" }],
            [{ text: "✅ تایید عضویت", callback_data: "check" }]
          ]
        }
      }
    );
  } else {
    ensureKeyboard(uid);
  }
});

// -----------------------------
// منوی اصلی (برای همه کاربران)
// -----------------------------
bot.on("message", (msg) => {
  const uid = msg.from.id;
  const text = msg.text;
  const u = getUser(uid);

  // منوی ثابت همیشه فعال باشد
  if (msg.chat.type === "private") {
    ensureKeyboard(uid);
  }

  if (!text) return;

  // اگر ادمین در حالت انتظار کانفیگ است
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

  // منوی خرید سرویس
  if (text === "🛒 خرید سرویس") {
    bot.sendMessage(uid, "🌐 لطفاً نوع تعرفه را انتخاب کنید:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌤 تعرفه‌های سبک", callback_data: "light" }],
          [{ text: "🌋 تعرفه‌های سنگین", callback_data: "heavy" }]
        ]
      }
    });
    return;
  }

  // سرویس‌های من
  if (text === "📂 سرویس‌های من") {
    if (!u.services.length) {
      bot.sendMessage(uid, "📂 هیچ سرویسی ثبت نشده است.");
    } else {
      bot.sendMessage(
        uid,
        "📂 سرویس‌های شما:\n" +
          u.services.map((s) => `- ${s.desc}`).join("\n")
      );
    }
    return;
  }

  // حساب کاربری
  if (text === "👤 حساب کاربری") {
    bot.sendMessage(
      uid,
      `👤 حساب کاربری:\nآیدی عددی: ${uid}\nموجودی کیف پول: ${u.balance} تومان`
    );
    return;
  }

  // کیف پول
  if (text === "💳 کیف پول") {
    bot.sendMessage(
      uid,
      `💳 کیف پول شما:\nموجودی فعلی: ${u.balance} تومان`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ افزایش موجودی", callback_data: "wallet_add" }]
          ]
        }
      }
    );
    return;
  }

  // پشتیبانی
  if (text === "🆘 پشتیبانی") {
    bot.sendMessage(uid, "🆘 پشتیبانی:\n@Azadtunnel1");
    return;
  }
});

// -----------------------------
// هندلر دکمه‌های اینلاین
// -----------------------------
bot.on("callback_query", async (c) => {
  const uid = c.from.id;
  const u = getUser(uid);

  // دکمه ارسال کانفیگ (فیش سرویس)
  if (c.data.startsWith("sendcfg_")) {
    if (uid !== ADMIN_ID) {
      bot.answerCallbackQuery(c.id, { text: "این دکمه فقط برای ادمین است." });
      return;
    }

    const targetUser = c.data.split("_")[1];
    waitingConfig[uid] = targetUser;

    bot.sendMessage(
      uid,
      "🔧 لطفاً کانفیگ یا عکس QR را ارسال کنید.\nپس از ارسال، برای کاربر ارسال می‌شود."
    );
    bot.answerCallbackQuery(c.id, { text: "در انتظار کانفیگ..." });
    return;
  }

  // دکمه تایید شارژ کیف پول
  if (c.data.startsWith("walletok_")) {
    if (uid !== ADMIN_ID) {
      bot.answerCallbackQuery(c.id, { text: "این دکمه فقط برای ادمین است." });
      return;
    }

    const targetUser = c.data.split("_")[1];
    const tu = getUser(targetUser);

    if (!tu.pendingWallet) {
      bot.answerCallbackQuery(c.id, { text: "هیچ درخواست شارژی ثبت نشده." });
      return;
    }

    tu.balance += tu.pendingWallet.amount;
    const amount = tu.pendingWallet.amount;
    tu.pendingWallet = null;

    bot.sendMessage(
      targetUser,
      `✅ شارژ کیف پول تایید شد.\nمبلغ ${amount} تومان به موجودی شما اضافه شد.\nموجودی فعلی: ${tu.balance} تومان`
    );
    bot.sendMessage(uid, `✔️ کیف پول کاربر ${targetUser} شارژ شد.`);

    bot.answerCallbackQuery(c.id, { text: "شارژ تایید شد." });
    return;
  }

  // تایید عضویت
  if (c.data === "check") {
    if (await isMember(uid)) {
      bot.editMessageText("✅ عضویت شما در کانال تایید شد.\nمنوی اصلی فعال شد.", {
        chat_id: uid,
        message_id: c.message.message_id
      });
      ensureKeyboard(uid);
    } else {
      bot.answerCallbackQuery(c.id, { text: "❌ هنوز عضو کانال نیستی." });
    }
    return;
  }

  // افزایش موجودی کیف پول
  if (c.data === "wallet_add") {
    const u = getUser(uid);
    u.pendingWallet = { amount: 0 }; // بعداً با فیش مشخص می‌کنیم

    bot.editMessageText(
      "💳 افزایش موجودی کیف پول\n\n" +
        "حداقل مبلغ: ۲۰,۰۰۰ تومان\n" +
        "حداکثر مبلغ: ۱۰۰,۰۰۰,000 تومان\n\n" +
        `💳 شماره کارت:\n${CARD_NUMBER}\nبه نام کریمی\n\n` +
        "📸 لطفاً بعد از پرداخت، عکس فیش را ارسال کنید و منتظر تایید بمانید.",
      {
        chat_id: uid,
        message_id: c.message.message_id
      }
    );
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
          [{ text: "500GB / 600K", callback_data: "h500" }]
        ]
      }
    });
    return;
  }

  // انتخاب سنگین‌ها
  if (["h200", "h300", "h500"].includes(c.data)) {
    const plans = {
      h200: ["200GB / 2 ماهه", 300000],
      h300: ["300GB / 2 ماهه", 400000],
      h500: ["500GB / 2 ماهه", 600000]
    };

    const [desc, price] = plans[c.data];
    u.pendingService = { desc, price };

    bot.editMessageText(
      `📄 *فیش شما آماده است*\n\n` +
        `🛒 *سرویس:* ${desc}\n` +
        `💰 *قیمت:* ${price} تومان\n\n` +
        `💳 *شماره کارت:* \`${CARD_NUMBER}\`\n` +
        `👤 *به نام:* کریمی\n\n` +
        `📸 لطفاً بعد از واریز، عکس فیش را ارسال کنید.`,
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
          [{ text: "۳ ماهه", callback_data: "l3" }]
        ]
      }
    });
    return;
  }

  // سبک → انتخاب حجم
  if (["l1", "l2", "l3"].includes(c.data)) {
    const prices = {
      l1: { 5: 20000, 10: 40000, 20: 60000, 30: 120000, 50: 200000 },
      l2: { 5: 30000, 10: 60000, 20: 120000, 30: 180000, 50: 300000 },
      l3: { 5: 40000, 10: 80000, 20: 160000, 30: 240000, 50: 400000 }
    };

    const rows = Object.entries(prices[c.data]).map(([g, p]) => {
      return [{ text: `${g}GB / ${p} تومان`, callback_data: `${c.data}_${g}` }];
    });

    bot.editMessageText("📦 لطفاً حجم سرویس را انتخاب کنید:", {
      chat_id: uid,
      message_id: c.message.message_id,
      reply_markup: {
        inline_keyboard: rows
      }
    });
    return;
  }

  // سبک → انتخاب نهایی
  if (c.data.includes("_")) {
    const [period, size] = c.data.split("_");

    const priceMap = {
      l1: { 5: 20000, 10: 40000, 20: 60000, 30: 120000, 50: 200000 },
      l2: { 5: 30000, 10: 60000, 20: 120000, 30: 180000, 50: 300000 },
      l3: { 5: 40000, 10: 80000, 20: 160000, 30: 240000, 50: 400000 }
    };

    const price = priceMap[period][size];
    const desc = `${size}GB / ${period}`;
    u.pendingService = { desc, price };

    bot.editMessageText(
      `📄 *فیش شما آماده است*\n\n` +
        `🛒 *سرویس:* ${desc}\n` +
        `💰 *قیمت:* ${price} تومان\n\n` +
        `💳 *شماره کارت:* \`${CARD_NUMBER}\`\n` +
        `👤 *به نام:* کریمی\n\n` +
        `📸 لطفاً بعد از واریز، عکس فیش را ارسال کنید.`,
      {
        chat_id: uid,
        message_id: c.message.message_id,
        parse_mode: "Markdown"
      }
    );
    return;
  }
});

// -----------------------------
// دریافت عکس فیش (سرویس و کیف پول) و عکس QR (ادمین)
// -----------------------------
bot.on("photo", (msg) => {
  const uid = msg.from.id;
  const u = getUser(uid);

  // اگر ادمین در حالت انتظار کانفیگ است → عکس QR
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

  // اگر کاربر در حالت شارژ کیف پول است
  if (u.pendingWallet) {
    bot.sendMessage(uid, "📸 فیش شارژ کیف پول دریافت شد. منتظر تایید باشید.");

    bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, {
      caption:
        `📥 فیش شارژ کیف پول:\n` +
        `👤 کاربر: ${uid}\n` +
        `💳 درخواست شارژ کیف پول\n` +
        `⚠️ مبلغ را از روی فیش بخوانید.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✔️ تایید شارژ حساب", callback_data: `walletok_${uid}` }]
        ]
      }
    });

    return;
  }

  // اگر کاربر در حالت فیش سرویس است
  if (u.pendingService) {
    bot.sendMessage(uid, "📸 فیش سرویس دریافت شد. منتظر تایید باشید.");

    bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, {
      caption:
        `📥 فیش جدید سرویس:\n` +
        `👤 کاربر: ${uid}\n` +
        `🛒 سرویس: ${u.pendingService.desc}\n` +
        `💰 قیمت: ${u.pendingService.price} تومان`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✔️ ارسال کانفیگ", callback_data: `sendcfg_${uid}` }]
        ]
      }
    });

    return;
  }

  // هیچ حالت فعالی نیست
  bot.sendMessage(
    uid,
    "❌ هیچ سفارشی یا درخواست شارژی ثبت نشده.\nابتدا از منوی «🛒 خرید سرویس» یا «💳 کیف پول» اقدام کنید."
  );
});

// -----------------------------
// دستور ادمین برای ارسال کانفیگ با متن (اختیاری)
// -----------------------------
bot.onText(/\/sendconfig (.+) (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const uid = match[1];
  const cfg = match[2];

  bot.sendMessage(uid, `✅ فیش تایید شد.\nاین هم کانفیگ شما:\n\n${cfg}`);
  bot.sendMessage(msg.chat.id, "✔️ کانفیگ برای کاربر ارسال شد.");
});
