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
// کیبورد ثابت پایین صفحه
// -----------------------------
const mainKeyboardLayout = [
  ["🛒 خرید سرویس", "📂 سرویس‌های من"],
  ["👤 حساب کاربری", "💳 کیف پول"],
  ["🧭 راهنمایی", "🆘 پشتیبانی"]
];

let keyboardActivated = {};

function ensureKeyboard(uid) {
  if (!keyboardActivated[uid]) {
    bot.sendMessage(uid, ".", {
      reply_markup: {
        keyboard: mainKeyboardLayout,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    });
    keyboardActivated[uid] = true;
  }
}

// -----------------------------
// دیتابیس ساده
// -----------------------------
let users = {};
let waitingConfig = {};      // برای کانفیگ و QR
let pendingWalletPay = {};   // پرداخت از کیف پول
let walletTopupState = {};   // وارد کردن مبلغ شارژ

function getUser(uid) {
  if (!users[uid]) {
    users[uid] = {
      services: [],          // {id, name, size, price, subLink, configText, qrFileId}
      pendingService: null,  // {name, size, price}
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
    bot.sendMessage(uid, "به آزاد تونل خوش آمدید 🏔️");
  }
});

// -----------------------------
// پیام‌های معمولی
// -----------------------------
bot.on("message", (msg) => {
  const uid = msg.from.id;
  const text = msg.text;
  const u = getUser(uid);

  if (msg.chat.type === "private") {
    ensureKeyboard(uid);
  }

  if (!text) return;

  // ادمین در حالت انتظار لینک/کانفیگ
  if (waitingConfig[uid] && waitingConfig[uid].mode === "config") {
    const { target, serviceId, stage } = waitingConfig[uid];
    const tu = getUser(target);
    const svc = tu.services.find(s => s.id === serviceId);
    if (!svc) {
      waitingConfig[uid] = null;
      return;
    }

    if (stage === "sub") {
      svc.subLink = text;
      waitingConfig[uid].stage = "cfg";
      bot.sendMessage(uid, "🔗 لینک اشتراک ثبت شد. حالا کانفیگ را ارسال کنید.");
      return;
    }

    if (stage === "cfg") {
      svc.configText = text;
      bot.sendMessage(
        target,
        `✅ لینک شما آماده‌ست\n\n` +
        `📛 نام سرویس: ${svc.name}\n` +
        `📏 حجم: ${svc.size}\n` +
        `💰 قیمت: ${svc.price} تومان\n\n` +
        (svc.subLink ? `🔗 لینک اشتراک:\n${svc.subLink}\n\n` : "") +
        `📄 کانفیگ:\n${svc.configText}`
      );
      bot.sendMessage(uid, "✔️ کانفیگ برای کاربر ارسال و ذخیره شد.");
      waitingConfig[uid] = null;
      return;
    }
  }

  // وارد کردن مبلغ شارژ کیف پول
  if (walletTopupState[uid] && walletTopupState[uid].step === "amount") {
    const amount = parseInt(text.replace(/\D/g, ""), 10);
    if (isNaN(amount) || amount < 20000 || amount > 100000000) {
      bot.sendMessage(
        uid,
        "❌ مبلغ نامعتبر است.\nحداقل ۲۰,۰۰۰ و حداکثر ۱۰۰,۰۰۰,۰۰۰ تومان.\nلطفاً دوباره مبلغ را به تومان وارد کنید."
      );
      return;
    }
    walletTopupState[uid].amount = amount;
    walletTopupState[uid].step = "photo";
    bot.sendMessage(
      uid,
      `✅ مبلغ ${amount} تومان ثبت شد.\nحالا لطفاً عکس فیش واریزی را ارسال کنید.`
    );
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
        return [{ text: `🔐 ${s.name} (${s.size})`, callback_data: `mysvc_${s.id}` }];
      });
      bot.sendMessage(uid, "📂 سرویس‌های شما:", {
        reply_markup: { inline_keyboard: buttons }
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
// کال‌بک‌ها
// -----------------------------
bot.on("callback_query", async (c) => {
  const uid = c.from.id;
  const u = getUser(uid);

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

  // افزایش موجودی کیف پول (از منو یا دکمه افزایش اعتبار)
  if (c.data === "wallet_add" || c.data === "wallet_add_from_insufficient") {
    walletTopupState[uid] = { step: "amount", amount: null };
    bot.editMessageText(
      "💳 افزایش موجودی کیف پول\n\n" +
      "حداقل مبلغ: ۲۰,۰۰۰ تومان\n" +
      "حداکثر مبلغ: ۱۰۰,۰۰۰,۰۰۰ تومان\n\n" +
      `💳 شماره کارت:\n${CARD_NUMBER}\nبه نام کریمی\n\n` +
      "🔢 مبلغ مورد نظر را به تومان وارد کنید:",
      { chat_id: uid, message_id: c.message.message_id }
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
          [{ text: "200GB / 300K", callback_data: "h_200_300000" }],
          [{ text: "300GB / 400K", callback_data: "h_300_400000" }],
          [{ text: "500GB / 600K", callback_data: "h_500_600000" }]
        ]
      }
    });
    return;
  }

  // انتخاب سنگین‌ها
  if (c.data.startsWith("h_")) {
    const [, size, price] = c.data.split("_");
    const descName = `سرویس سنگین`;
    const descSize = `${size}GB / ۲ ماهه`;
    u.pendingService = { name: descName, size: descSize, price: Number(price) };

    bot.editMessageText(
      `📦 سرویس انتخابی:\n\n` +
      `📛 نام سرویس: ${descName}\n` +
      `📏 حجم: ${descSize}\n` +
      `💰 قیمت: ${price} تومان\n\n` +
      "لطفاً روش پرداخت را انتخاب کنید:",
      {
        chat_id: uid,
        message_id: c.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 کارت به کارت", callback_data: "pay_card" }],
            [{ text: "💼 پرداخت از کیف پول", callback_data: "pay_wallet" }]
          ]
        }
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
      return [{ text: `${g}GB / ${p} تومان`, callback_data: `ls_${c.data}_${g}_${p}` }];
    });

    bot.editMessageText("📦 لطفاً حجم سرویس را انتخاب کنید:", {
      chat_id: uid,
      message_id: c.message.message_id,
      reply_markup: { inline_keyboard: rows }
    });
    return;
  }

  // سبک → انتخاب نهایی
  if (c.data.startsWith("ls_")) {
    const [, period, size, price] = c.data.split("_");
    const monthText = period === "l1" ? "۱ ماهه" : period === "l2" ? "۲ ماهه" : "۳ ماهه";
    const descName = `سرویس سبک`;
    const descSize = `${size}GB / ${monthText}`;
    u.pendingService = { name: descName, size: descSize, price: Number(price) };

    bot.editMessageText(
      `📦 سرویس انتخابی:\n\n` +
      `📛 نام سرویس: ${descName}\n` +
      `📏 حجم: ${descSize}\n` +
      `💰 قیمت: ${price} تومان\n\n` +
      "لطفاً روش پرداخت را انتخاب کنید:",
      {
        chat_id: uid,
        message_id: c.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 کارت به کارت", callback_data: "pay_card" }],
            [{ text: "💼 پرداخت از کیف پول", callback_data: "pay_wallet" }]
          ]
        }
      }
    );
    return;
  }

  // انتخاب روش پرداخت
  if (c.data === "pay_card") {
    const ps = u.pendingService;
    if (!ps) {
      bot.answerCallbackQuery(c.id, { text: "هیچ سرویس انتخاب نشده." });
      return;
    }
    bot.editMessageText(
      `📄 فیش پرداخت کارت به کارت\n\n` +
      `📛 نام سرویس: ${ps.name}\n` +
      `📏 حجم: ${ps.size}\n` +
      `💰 قیمت: ${ps.price} تومان\n\n` +
      `💳 شماره کارت: ${CARD_NUMBER}\n` +
      `👤 به نام: کریمی\n\n` +
      `📸 لطفاً بعد از واریز، عکس فیش را ارسال کنید.`,
      { chat_id: uid, message_id: c.message.message_id }
    );
    return;
  }

  if (c.data === "pay_wallet") {
    const ps = u.pendingService;
    if (!ps) {
      bot.answerCallbackQuery(c.id, { text: "هیچ سرویس انتخاب نشده." });
      return;
    }

    if (u.balance < ps.price) {
      bot.editMessageText(
        `❌ موجودی کیف پول شما کافی نیست.\n\n` +
        `💰 قیمت سرویس: ${ps.price} تومان\n` +
        `💼 موجودی فعلی کیف پول: ${u.balance} تومان\n\n` +
        `لطفاً ابتدا کیف پول خود را شارژ کنید.`,
        {
          chat_id: uid,
          message_id: c.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ افزایش اعتبار", callback_data: "wallet_add_from_insufficient" }]
            ]
          }
        }
      );
      return;
    }

    pendingWalletPay[uid] = { service: ps };
    bot.editMessageText(
      `💼 پرداخت از کیف پول\n\n` +
      `📛 نام سرویس: ${ps.name}\n` +
      `📏 حجم: ${ps.size}\n` +
      `💰 قیمت سرویس: ${ps.price} تومان\n` +
      `💼 موجودی فعلی کیف پول شما: ${u.balance} تومان\n\n` +
      `در صورت تایید، مبلغ سرویس از کیف پول شما کسر می‌شود.`,
      {
        chat_id: uid,
        message_id: c.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "✔ تایید پرداخت از کیف پول", callback_data: "wallet_confirm_user" }]
          ]
        }
      }
    );
    return;
  }

  // تایید پرداخت از کیف پول توسط کاربر → ارسال برای ادمین
  if (c.data === "wallet_confirm_user") {
    const pw = pendingWalletPay[uid];
    if (!pw) {
      bot.answerCallbackQuery(c.id, { text: "هیچ پرداختی در انتظار نیست." });
      return;
    }
    const ps = pw.service;
    bot.answerCallbackQuery(c.id, { text: "در انتظار تایید ادمین..." });

    bot.sendMessage(
      ADMIN_ID,
      `💼 درخواست پرداخت از کیف پول:\n\n` +
      `👤 کاربر: ${uid}\n` +
      `📛 سرویس: ${ps.name}\n` +
      `📏 حجم: ${ps.size}\n` +
      `💰 قیمت سرویس: ${ps.price} تومان\n` +
      `💼 موجودی فعلی کیف پول کاربر: ${getUser(uid).balance} تومان`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✔ تایید پرداخت از کیف پول", callback_data: `wallet_admin_ok_${uid}` }]
          ]
        }
      }
    );
    return;
  }

  // ادمین تایید پرداخت از کیف پول
  if (c.data.startsWith("wallet_admin_ok_")) {
    if (uid !== ADMIN_ID) {
      bot.answerCallbackQuery(c.id, { text: "این دکمه فقط برای ادمین است." });
      return;
    }
    const targetUser = c.data.split("_")[3];
    const tu = getUser(targetUser);
    const pw = pendingWalletPay[targetUser];
    if (!pw) {
      bot.answerCallbackQuery(c.id, { text: "هیچ پرداختی در انتظار نیست." });
      return;
    }
    const ps = pw.service;

    tu.balance -= ps.price;
    const newBalance = tu.balance;

    const serviceId = Date.now().toString();
    tu.services.push({
      id: serviceId,
      name: ps.name,
      size: ps.size,
      price: ps.price,
      subLink: "",
      configText: "",
      qrFileId: null
    });

    bot.sendMessage(
      targetUser,
      `✅ پرداخت با موفقیت انجام شد.\n\n` +
      `📛 سرویس: ${ps.name}\n` +
      `📏 حجم: ${ps.size}\n` +
      `💰 مبلغ ${ps.price} تومان بابت سرویس از کیف پول شما کسر شد.\n` +
      `💼 موجودی فعلی کیف پول: ${newBalance} تومان\n\n` +
      `لطفاً منتظر دریافت لینک و کانفیگ باشید.`
    );

    bot.sendMessage(
      ADMIN_ID,
      `✔ پرداخت از کیف پول کاربر ${targetUser} تایید شد.\n` +
      `لطفاً لینک اشتراک، کانفیگ و QR را برای این سرویس ارسال کنید.`
    );

    pendingWalletPay[targetUser] = null;
    bot.answerCallbackQuery(c.id, { text: "پرداخت تایید شد." });
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

    let text =
      `🔐 سرویس شما:\n\n` +
      `📛 نام سرویس: ${svc.name}\n` +
      `📏 حجم: ${svc.size}\n` +
      `💰 قیمت: ${svc.price} تومان\n\n`;

    if (svc.subLink) text += `🔗 لینک اشتراک:\n${svc.subLink}\n\n`;
    if (svc.configText) text += `📄 کانفیگ:\n${svc.configText}\n\n`;

    text += "لینک شما آماده‌ست ✅";

    const inlineKeyboard = [
      [{ text: "📎 ارسال لینک‌های تکی", callback_data: `single_${svc.id}` }]
    ];

    bot.sendMessage(uid, text, {
      reply_markup: { inline_keyboard: inlineKeyboard }
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
      "برای کپی کردن لینک های تکی روی لینک سابسکریپشن خود کلیک کنید و لینک های تکی را کپی کنید"
    );
    bot.answerCallbackQuery(c.id, { text: "متن راهنمای لینک‌های تکی ارسال شد." });
    return;
  }

  // دکمه ارسال کانفیگ (کارت به کارت)
  if (c.data.startsWith("sendcfg_")) {
    if (uid !== ADMIN_ID) {
      bot.answerCallbackQuery(c.id, { text: "این دکمه فقط برای ادمین است." });
      return;
    }

    const targetUser = c.data.split("_")[1];
    const tu = getUser(targetUser);
    const ps = tu.pendingService;
    if (!ps) {
      bot.answerCallbackQuery(c.id, { text: "هیچ سرویس در انتظار تایید نیست." });
      return;
    }

    const serviceId = Date.now().toString();
    tu.services.push({
      id: serviceId,
      name: ps.name,
      size: ps.size,
      price: ps.price,
      subLink: "",
      configText: "",
      qrFileId: null
    });

    waitingConfig[uid] = { target: targetUser, serviceId, mode: "config", stage: "sub" };

    bot.sendMessage(
      uid,
      "🔧 لطفاً ابتدا لینک اشتراک (سابسکریپشن) و سپس کانفیگ را برای این سرویس ارسال کنید.\nهرچه می‌فرستی برای کاربر ذخیره می‌شود."
    );
    bot.answerCallbackQuery(c.id, { text: "در انتظار لینک و کانفیگ..." });
    return;
  }

  // تایید شارژ کیف پول (ادمین)
  if (c.data.startsWith("walletok_")) {
    if (uid !== ADMIN_ID) {
      bot.answerCallbackQuery(c.id, { text: "این دکمه فقط برای ادمین است." });
      return;
    }
    const targetUser = c.data.split("_")[1];
    const tu = getUser(targetUser);
    const amount = parseInt(c.data.split("_")[2], 10) || 0;
    tu.balance += amount;

    bot.sendMessage(
      targetUser,
      `✅ فیش شما تایید شد.\nمبلغ ${amount} تومان به کیف پول شما واریز شد.\nموجودی فعلی: ${tu.balance} تومان`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 خرید سرویس", callback_data: "go_buy_service" }]
          ]
        }
      }
    );
    bot.sendMessage(uid, `✔️ کیف پول کاربر ${targetUser} به مبلغ ${amount} تومان شارژ شد.`);
    bot.answerCallbackQuery(c.id, { text: "شارژ تایید شد." });
    return;
  }

  // رفتن به خرید سرویس بعد از شارژ
  if (c.data === "go_buy_service") {
    bot.sendMessage(uid, "🌐 لطفاً نوع تعرفه را انتخاب کنید:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌤 تعرفه‌های سبک", callback_data: "light" }],
          [{ text: "🌋 تعرفه‌های سنگین", callback_data: "heavy" }]
        ]
      }
    });
    bot.answerCallbackQuery(c.id);
    return;
  }
});

// -----------------------------
// عکس‌ها (فیش و QR)
// -----------------------------
bot.on("photo", (msg) => {
  const uid = msg.from.id;
  const u = getUser(uid);

  // QR برای سرویس (ادمین)
  if (waitingConfig[uid] && waitingConfig[uid].mode === "qr") {
    const { target, serviceId } = waitingConfig[uid];
    const tu = getUser(target);
    const svc = tu.services.find(s => s.id === serviceId);
    if (svc) {
      svc.qrFileId = msg.photo[msg.photo.length - 1].file_id;
      bot.sendPhoto(
        target,
        svc.qrFileId,
        { caption: "🔳 QR سرویس شما" }
      );
      bot.sendMessage(uid, "✔️ QR برای کاربر ارسال و ذخیره شد.");
    }
    waitingConfig[uid] = null;
    return;
  }

  // شارژ کیف پول (با مبلغ وارد شده)
  if (walletTopupState[uid] && walletTopupState[uid].step === "photo") {
    const amount = walletTopupState[uid].amount || 0;
    bot.sendMessage(uid, "📸 فیش شارژ کیف پول دریافت شد. منتظر تایید باشید.");

    bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, {
      caption:
        `📥 فیش شارژ کیف پول:\n` +
        `👤 کاربر: ${uid}\n` +
        `💰 مبلغ: ${amount} تومان\n`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✔️ تایید شارژ حساب", callback_data: `walletok_${uid}_${amount}` }]
        ]
      }
    });

    walletTopupState[uid] = null;
    return;
  }

  // فیش سرویس کارت به کارت
  if (u.pendingService) {
    bot.sendMessage(uid, "📸 فیش سرویس دریافت شد. منتظر تایید باشید.");

    bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, {
      caption:
        `📥 فیش جدید سرویس:\n` +
        `👤 کاربر: ${uid}\n` +
        `📛 سرویس: ${u.pendingService.name}\n` +
        `📏 حجم: ${u.pendingService.size}\n` +
        `💰 قیمت: ${u.pendingService.price} تومان`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✔️ ارسال کانفیگ", callback_data: `sendcfg_${uid}` }]
        ]
      }
    });

    return;
  }

  bot.sendMessage(
    uid,
    "❌ هیچ سفارشی یا درخواست شارژی ثبت نشده.\nابتدا از منوی «🛒 خرید سرویس» یا «💳 کیف پول» اقدام کنید."
  );
});

// -----------------------------
// ثبت لینک اشتراک و QR با دستورات اختیاری
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
