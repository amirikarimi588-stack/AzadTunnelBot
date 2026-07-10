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
      ["🧭 راهنمایی", "🆘 پشتیبانی"]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

// منوی اصلی را بدون اسپم فعال می‌کند
function ensureKeyboard(uid, text) {
  if (!text || text.length < 2) {
    bot.sendMessage(uid, "منوی اصلی آزاد تونل 🏔️", mainKeyboard);
  }
}

// -----------------------------
// دیتابیس ساده کاربران
// -----------------------------
let users = {};
let waitingConfig = {}; // ادمین → کاربر هدف برای کانفیگ

function getUser(uid) {
  if (!users[uid]) {
    users[uid] = {
      services: [],          // [{id, desc, subLink, configText, qrFileId}]
      pendingService: null,  // {desc, price}
      pendingWallet: null,   // {amount}
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
    bot.sendMessage(uid, "منوی اصلی آزاد تونل 🏔️", mainKeyboard);
  }
});

// -----------------------------
// منوی اصلی (برای همه کاربران)
// -----------------------------
bot.on("message", (msg) => {
  const uid = msg.from.id;
  const text = msg.text;
  const u = getUser(uid);

  if (msg.chat.type === "private") {
    ensureKeyboard(uid, text);
  }

  if (!text) return;

  // اگر ادمین در حالت انتظار کانفیگ متنی است
  if (waitingConfig[uid] && typeof waitingConfig[uid] === "object" && waitingConfig[uid].mode === "text") {
    const target = waitingConfig[uid].target;
    const serviceId = waitingConfig[uid].serviceId;
    const tu = getUser(target);

    const service = tu.services.find(s => s.id === serviceId);
    if (service) {
      service.configText = text;
    }

    bot.sendMessage(
      target,
      `✅ لینک شما آماده‌ست\n\n🔗 لینک اشتراک:\n${service.subLink}\n\n📄 کانفیگ:\n${text}`
    );
    bot.sendMessage(uid, "✔️ کانفیگ متنی برای کاربر ارسال و ذخیره شد.");

    waitingConfig[uid] = null;
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
      const buttons = u.services.map(s => {
        return [{ text: `🔐 ${s.desc}`, callback_data: `mysvc_${s.id}` }];
      });
      bot.sendMessage(uid, "📂 سرویس‌های شما:", {
        reply_markup: {
          inline_keyboard: buttons
        }
      });
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

  // راهنمایی
  if (text === "🧭 راهنمایی") {
    bot.sendMessage(
      uid,
      "🧭 راهنمای اتصال:\n\n" +
      "برای اتصال:\n" +
      "لینک سابسکریبشن را کپی کنید\n" +
      "و لینک اشتراک را در اپ‌های زیر کپی کنید:\n\n" +
      "• V2Box\n" +
      "• Streisand\n" +
      "• Happ Tunnel\n" +
      "and…\n\n" +
      "و همچنین می‌توانید لینک‌های تکی را از طریق لینک اشتراک کپی کنید و در اپلیکیشن‌های زیر کپی کنید:\n\n" +
      "• NPV Tunnel\n" +
      "• V2RayNG\n" +
      "and…"
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
    const tu = getUser(targetUser);

    if (!tu.pendingService) {
      bot.answerCallbackQuery(c.id, { text: "هیچ سرویس در انتظار تایید نیست." });
      return;
    }

    const serviceId = Date.now().toString();
    tu.services.push({
      id: serviceId,
      desc: tu.pendingService.desc,
      subLink: "",      // بعداً با متن ادمین پر می‌شود
      configText: "",
      qrFileId: null
    });

    waitingConfig[uid] = { target: targetUser, serviceId, mode: "text" };

    bot.sendMessage(
      uid,
      "🔧 لطفاً ابتدا لینک اشتراک (سابسکریپشن) و سپس کانفیگ را برای این سرویس ارسال کنید.\n" +
      "هرچه می‌فرستی برای کاربر ذخیره می‌شود."
    );
    bot.answerCallbackQuery(c.id, { text: "در انتظار لینک و کانفیگ..." });
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

    const amount = tu.pendingWallet.amount || 0;
    tu.balance += amount;
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
      ensureKeyboard(uid, ".");
    } else {
      bot.answerCallbackQuery(c.id, { text: "❌ هنوز عضو کانال نیستی." });
    }
    return;
  }

  // افزایش موجودی کیف پول
  if (c.data === "wallet_add") {
    const u = getUser(uid);
    u.pendingWallet = { amount: 0 }; // مبلغ از روی فیش مشخص می‌شود

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
      `📄 فیش شما آماده است\n\n` +
        `🛒 سرویس: ${desc}\n` +
        `💰 قیمت: ${price} تومان\n\n` +
        `💳 شماره کارت: ${CARD_NUMBER}\n` +
        `👤 به نام: کریمی\n\n` +
        `📸 لطفاً بعد از واریز، عکس فیش را ارسال کنید.`,
      {
        chat_id: uid,
        message_id: c.message.message_id
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
  if (c.data.includes("_") && c.data.startsWith("l")) {
    const [period, size] = c.data.split("_");

    const priceMap = {
      l1: { 5: 20000, 10: 40000, 20: 60000, 30: 120000, 50: 200000 },
      l2: { 5: 30000, 10: 60000, 20: 120000, 30: 180000, 50: 300000 },
      l3: { 5: 40000, 10: 80000, 20: 160000, 30: 240000, 50: 400000 }
    };

    const price = priceMap[period][size];
    const desc = `${size}GB / ${period === "l1" ? "۱ ماهه" : period === "l2" ? "۲ ماهه" : "۳ ماهه"}`;
    u.pendingService = { desc, price };

    bot.editMessageText(
      `📄 فیش شما آماده است\n\n` +
        `🛒 سرویس: ${desc}\n` +
        `💰 قیمت: ${price} تومان\n\n` +
        `💳 شماره کارت: ${CARD_NUMBER}\n` +
        `👤 به نام: کریمی\n\n` +
        `📸 لطفاً بعد از واریز، عکس فیش را ارسال کنید.`,
      {
        chat_id: uid,
        message_id: c.message.message_id
      }
    );
    return;
  }

  // سرویس‌های من → انتخاب سرویس
  if (c.data.startsWith("mysvc_")) {
    const svcId = c.data.split("_")[1];
    const svc = u.services.find(s => s.id === svcId);

    if (!svc) {
      bot.answerCallbackQuery(c.id, { text: "این سرویس یافت نشد." });
      return;
    }

    let text = `🔐 سرویس شما:\n\n` +
      `📦 ${svc.desc}\n\n`;

    if (svc.subLink) {
      text += `🔗 لینک اشتراک:\n${svc.subLink}\n\n`;
    }
    if (svc.configText) {
      text += `📄 کانفیگ:\n${svc.configText}\n\n`;
    }

    text += "لینک شما آماده‌ست ✅";

    const inlineKeyboard = [
      [{ text: "📎 ارسال لینک‌های تکی", callback_data: `single_${svc.id}` }]
    ];

    bot.sendMessage(uid, text, {
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });

    if (svc.qrFileId) {
      bot.sendPhoto(uid, svc.qrFileId, { caption: "🔳 QR سرویس شما" });
    }

    bot.answerCallbackQuery(c.id);
    return;
  }

  // دکمه ارسال لینک‌های تکی
  if (c.data.startsWith("single_")) {
    bot.sendMessage(
      uid,
      "برای کپی کردن لینک‌های تکی، روی لینک سابسکریپشن خود کلیک کنید و لینک‌های تکی را کپی کنید."
    );
    bot.answerCallbackQuery(c.id, { text: "متن راهنمای لینک‌های تکی ارسال شد." });
    return;
  }
});

// -----------------------------
// دریافت عکس فیش (سرویس و کیف پول) و عکس QR (ادمین)
// -----------------------------
bot.on("photo", (msg) => {
  const uid = msg.from.id;
  const u = getUser(uid);

  // اگر ادمین در حالت انتظار QR سرویس است
  if (waitingConfig[uid] && typeof waitingConfig[uid] === "object" && waitingConfig[uid].mode === "qr") {
    const target = waitingConfig[uid].target;
    const serviceId = waitingConfig[uid].serviceId;
    const tu = getUser(target);

    const service = tu.services.find(s => s.id === serviceId);
    if (service) {
      service.qrFileId = msg.photo[msg.photo.length - 1].file_id;
    }

    bot.sendPhoto(
      target,
      msg.photo[msg.photo.length - 1].file_id,
      { caption: "🔳 QR سرویس شما" }
    );

    bot.sendMessage(uid, "✔️ QR برای کاربر ارسال و ذخیره شد.");
    waitingConfig[uid] = null;
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
// دستور ادمین برای ثبت لینک اشتراک و QR (اختیاری ساده‌تر)
// -----------------------------
bot.onText(/\/setsub (\d+) (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const targetUser = match[1];
  const subLink = match[2];
  const tu = getUser(targetUser);

  if (!tu.services.length) {
    bot.sendMessage(msg.chat.id, "این کاربر هیچ سرویسی ندارد.");
    return;
  }

  const lastService = tu.services[tu.services.length - 1];
  lastService.subLink = subLink;

  bot.sendMessage(msg.chat.id, "🔗 لینک اشتراک برای آخرین سرویس این کاربر ثبت شد.");
});

// ادمین می‌تواند بعدش QR را با عکس بفرستد و با /setqr کار کند
bot.onText(/\/setqr (\d+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const targetUser = match[1];
  const tu = getUser(targetUser);

  if (!tu.services.length) {
    bot.sendMessage(msg.chat.id, "این کاربر هیچ سرویسی ندارد.");
    return;
  }

  const lastService = tu.services[tu.services.length - 1];
  waitingConfig[msg.from.id] = { target: targetUser, serviceId: lastService.id, mode: "qr" };

  bot.sendMessage(msg.chat.id, "🔳 لطفاً عکس QR این سرویس را ارسال کنید.");
});
