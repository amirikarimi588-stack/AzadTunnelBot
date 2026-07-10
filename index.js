const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

// تنظیمات اصلی
const BOT_TOKEN = process.env.BOT_TOKEN;
const MAIN_CHANNEL = "@Azadtunnel1";
const ADMIN_ID = 8571263967;
const CARD_NUMBER = "6219861435903868";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// دیتابیس JSON
const DB_PATH = path.join(__dirname, "db.json");

let db = {
  users: {}
};

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf8");
      db = JSON.parse(raw);
    }
  } catch {
    db = { users: {} };
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    console.error("DB save error:", e);
  }
}

loadDB();

// ساختار کاربر
function getUser(uid) {
  if (!db.users[uid]) {
    db.users[uid] = {
      id: uid,
      username: null,
      services: [],          // {id, name, size, price, subLink, qrFileId}
      pendingService: null,  // {name, size, price}
      balance: 0
    };
    saveDB();
  }
  return db.users[uid];
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

// کیبورد اصلی
const mainKeyboard = {
  keyboard: [
    ["🛒 خرید سرویس", "📂 سرویس‌های من"],
    ["👤 حساب کاربری", "💳 کیف پول"],
    ["🧭 راهنمایی", "🆘 پشتیبانی"]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

// وضعیت‌ها
let waitingConfig = {};      // برای لینک و QR
let pendingWalletPay = {};   // پرداخت از کیف پول
let walletTopupState = {};   // وارد کردن مبلغ شارژ
let pendingConfigs = [];     // صف سرویس‌های در انتظار کانفیگ/QR برای ادمین

// /start
bot.onText(/\/start/, async (msg) => {
  const uid = msg.from.id;
  const u = getUser(uid);
  u.username = msg.from.username || u.username;
  saveDB();

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
    bot.sendMessage(uid, "به آزاد تونل خوش آمدید 🏔️", {
      reply_markup: { ...mainKeyboard }
    });

    if (uid === ADMIN_ID) {
      bot.sendMessage(
        uid,
        "📊 برای مدیریت سرویس‌های در انتظار، از دستور /panel استفاده کن.",
        { reply_markup: { ...mainKeyboard } }
      );
    }
  }
});

// داشبورد ادمین
bot.onText(/\/panel/, (msg) => {
  const uid = msg.from.id;
  if (uid !== ADMIN_ID) return;

  if (!pendingConfigs.length) {
    bot.sendMessage(uid, "📊 هیچ سرویس در صف انتظار برای ارسال کانفیگ و QR نیست.", {
      reply_markup: { ...mainKeyboard }
    });
    return;
  }

  const rows = pendingConfigs.map((item, index) => {
    return [{
      text: `👤 ${item.userId} | ${item.serviceName} (${item.serviceSize})`,
      callback_data: `cfgsel_${index}`
    }];
  });

  bot.sendMessage(uid, "📊 سرویس‌های در صف انتظار:", {
    reply_markup: { inline_keyboard: rows }
  });
});

// پیام‌های معمولی
bot.on("message", (msg) => {
  const uid = msg.from.id;
  const text = msg.text;
  const u = getUser(uid);
  u.username = msg.from.username || u.username;
  saveDB();

  if (!text) return;

  // وارد کردن مبلغ شارژ کیف پول
  if (walletTopupState[uid] && walletTopupState[uid].step === "amount") {
    const amount = parseInt(text.replace(/\D/g, ""), 10);
    if (isNaN(amount) || amount < 20000 || amount > 100000000) {
      bot.sendMessage(
        uid,
        "❌ مبلغ نامعتبر است.\nحداقل ۲۰,۰۰۰ و حداکثر ۱۰۰,۰۰۰,۰۰۰ تومان.\nلطفاً دوباره مبلغ را به تومان وارد کنید.",
        { reply_markup: { ...mainKeyboard } }
      );
      return;
    }
    walletTopupState[uid].amount = amount;
    walletTopupState[uid].step = "photo";
    bot.sendMessage(
      uid,
      `✅ مبلغ ${amount} تومان ثبت شد.\nحالا لطفاً عکس فیش واریزی را ارسال کنید.`,
      { reply_markup: { ...mainKeyboard } }
    );
    return;
  }

  // خرید سرویس
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
      bot.sendMessage(uid, "📂 هیچ سرویسی ثبت نشده است.", {
        reply_markup: { ...mainKeyboard }
      });
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
      `👤 حساب کاربری:\n` +
      `آیدی عددی: ${uid}\n` +
      `نام کاربری: ${u.username ? "@" + u.username : "ثبت نشده"}\n` +
      `موجودی کیف پول: ${u.balance} تومان`,
      { reply_markup: { ...mainKeyboard } }
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
      "لینک اشتراک را کپی کنید و در اپ‌های زیر وارد کنید:\n\n" +
      "• V2Box\n• Streisand\n• Happ Tunnel\n• NPV Tunnel\n• V2RayNG\n\n" +
      "برای لینک‌های تکی، روی لینک اشتراک کلیک کنید.",
      { reply_markup: { ...mainKeyboard } }
    );
    return;
  }

  // پشتیبانی
  if (text === "🆘 پشتیبانی") {
    bot.sendMessage(uid, "🆘 پشتیبانی:\n@Azadtunnel1", {
      reply_markup: { ...mainKeyboard }
    });
    return;
  }
});

// کال‌بک‌ها بخش خرید سرویس
bot.on("callback_query", async (c) => {
  const uid = c.from.id;
  const u = getUser(uid);

  // تایید عضویت
  if (c.data === "check") {
    if (await isMember(uid)) {
      bot.editMessageText("✅ عضویت شما تایید شد.", {
        chat_id: uid,
        message_id: c.message.message_id,
        reply_markup: { ...mainKeyboard }
      });
    } else {
      bot.answerCallbackQuery(c.id, { text: "❌ هنوز عضو کانال نیستی." });
    }
    return;
  }

  // افزایش موجودی کیف پول
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
    saveDB();

    bot.editMessageText(
      `📦 سرویس انتخابی:\n\n` +
      `📛 نام سرویس: ${descName}\n` +
      `📏 حجم: ${descSize}\n` +
      `💰 قیمت: ${price} تومان\n\n` +
      "روش پرداخت را انتخاب کنید:",
      {
        chat_id: uid,
        message_id: c.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 کارت به کارت", callback_data: "pay_card" }],
            [{ text: "💼 کیف پول", callback_data: "pay_wallet" }]
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
    saveDB();

    bot.editMessageText(
      `📦 سرویس انتخابی:\n\n` +
      `📛 نام سرویس: ${descName}\n` +
      `📏 حجم: ${descSize}\n` +
      `💰 قیمت: ${price} تومان\n\n` +
      "روش پرداخت را انتخاب کنید:",
      {
        chat_id: uid,
        message_id: c.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 کارت به کارت", callback_data: "pay_card" }],
            [{ text: "💼 کیف پول", callback_data: "pay_wallet" }]
          ]
        }
      }
    );
    return;
  }

  // پرداخت کارت به کارت
  if (c.data === "pay_card") {
    const ps = u.pendingService;
    bot.editMessageText(
      `📄 فیش پرداخت کارت به کارت\n\n` +
      `📛 سرویس: ${ps.name}\n` +
      `📏 حجم: ${ps.size}\n` +
      `💰 قیمت: ${ps.price} تومان\n\n` +
      `💳 شماره کارت: ${CARD_NUMBER}\nبه نام کریمی\n\n` +
      `📸 لطفاً عکس فیش را ارسال کنید.`,
      { chat_id: uid, message_id: c.message.message_id }
    );
    return;
  }

  // پرداخت از کیف پول
  if (c.data === "pay_wallet") {
    const ps = u.pendingService;

    if (u.balance < ps.price) {
      bot.editMessageText(
        `❌ موجودی کافی نیست.\n\n` +
        `💰 قیمت سرویس: ${ps.price} تومان\n` +
        `💼 موجودی کیف پول: ${u.balance} تومان\n\n` +
        `لطفاً ابتدا کیف پول را شارژ کنید.`,
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
      `📛 سرویس: ${ps.name}\n` +
      `📏 حجم: ${ps.size}\n` +
      `💰 قیمت: ${ps.price} تومان\n` +
      `💼 موجودی فعلی: ${u.balance} تومان\n\n` +
      `در صورت تایید، مبلغ از کیف پول شما کسر می‌شود.`,
      {
        chat_id: uid,
        message_id: c.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "✔ تایید پرداخت", callback_data: "wallet_confirm_user" }]
          ]
        }
      }
    );
    return;
  }

  // تایید پرداخت از کیف پول توسط کاربر
  if (c.data === "wallet_confirm_user") {
    const pw = pendingWalletPay[uid];
    const ps = pw.service;

    bot.answerCallbackQuery(c.id, { text: "در انتظار تایید ادمین..." });

    bot.sendMessage(
      ADMIN_ID,
      `💼 درخواست پرداخت از کیف پول:\n\n` +
      `👤 کاربر: ${uid}\n` +
      `📛 سرویس: ${ps.name}\n` +
      `📏 حجم: ${ps.size}\n` +
      `💰 قیمت: ${ps.price} تومان\n` +
      `💼 موجودی فعلی: ${u.balance} تومان`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✔ تایید پرداخت", callback_data: `wallet_admin_ok_${uid}` }]
          ]
        }
      }
    );
    return;
  }

  // ادمین تایید پرداخت از کیف پول
  if (c.data.startsWith("wallet_admin_ok_")) {
    if (uid !== ADMIN_ID) return;

    const targetUser = c.data.split("_")[3];
    const tu = getUser(targetUser);
    const pw = pendingWalletPay[targetUser];
    const ps = pw.service;

    tu.balance -= ps.price;
    if (tu.balance < 0) tu.balance = 0;

    const serviceId = Date.now().toString();
    tu.services.push({
      id: serviceId,
      name: ps.name,
      size: ps.size,
      price: ps.price,
      subLink: "",
      qrFileId: null
    });

    saveDB();

    pendingConfigs.push({
      userId: targetUser,
      serviceId,
      serviceName: ps.name,
      serviceSize: ps.size
    });

    bot.sendMessage(
      targetUser,
      `✅ پرداخت با موفقیت انجام شد.\n` +
      `📛 سرویس: ${ps.name}\n` +
      `📏 حجم: ${ps.size}\n` +
      `💰 مبلغ ${ps.price} تومان از کیف پول شما کسر شد.\n` +
      `💼 موجودی فعلی: ${tu.balance} تومان\n\n` +
      `لطفاً منتظر دریافت لینک و QR باشید.`,
      { reply_markup: { ...mainKeyboard } }
    );

    bot.sendMessage(
      ADMIN_ID,
      `✔ پرداخت کاربر ${targetUser} تایید شد.\nسرویس در صف داشبورد قرار گرفت.`
    );

    pendingWalletPay[targetUser] = null;
    bot.answerCallbackQuery(c.id, { text: "پرداخت تایید شد." });
    return;
  }
});

// انتخاب سرویس از داشبورد برای ارسال لینک و QR
bot.on("callback_query", (c) => {
  const uid = c.from.id;

  if (c.data.startsWith("cfgsel_")) {
    if (uid !== ADMIN_ID) {
      bot.answerCallbackQuery(c.id, { text: "این دکمه فقط برای ادمین است." });
      return;
    }

    const index = parseInt(c.data.split("_")[1], 10);
    const item = pendingConfigs[index];

    if (!item) {
      bot.answerCallbackQuery(c.id, { text: "این مورد دیگر در صف نیست." });
      return;
    }

    const tu = getUser(item.userId);
    const svc = tu.services.find(s => s.id === item.serviceId);

    if (!svc) {
      pendingConfigs.splice(index, 1);
      bot.answerCallbackQuery(c.id, { text: "سرویس یافت نشد." });
      return;
    }

    waitingConfig[ADMIN_ID] = {
      target: item.userId,
      serviceId: item.serviceId,
      mode: "config",
      stage: "link"
    };

    pendingConfigs.splice(index, 1);

    bot.editMessageText(
      `🔧 ارسال لینک و QR برای کاربر ${item.userId}\n` +
      `📛 سرویس: ${svc.name}\n` +
      `📏 حجم: ${svc.size}\n\n` +
      `لطفاً ابتدا لینک اشتراک/کانفیگ را ارسال کن، سپس عکس QR را.`,
      { chat_id: uid, message_id: c.message.message_id }
    );

    bot.answerCallbackQuery(c.id, { text: "آماده دریافت لینک و QR." });
    return;
  }
});

// دریافت عکس QR
bot.on("photo", (msg) => {
  const uid = msg.from.id;

  if (waitingConfig[uid] && waitingConfig[uid].mode === "config" && waitingConfig[uid].stage === "qr") {
    const { target, serviceId } = waitingConfig[uid];
    const tu = getUser(target);
    const svc = tu.services.find(s => s.id === serviceId);

    if (svc) {
      svc.qrFileId = msg.photo[msg.photo.length - 1].file_id;
      saveDB();

      let text =
        `✅ لینک شما آماده‌ست\n\n` +
        `📛 نام سرویس: ${svc.name}\n` +
        `📏 حجم: ${svc.size}\n` +
        `💰 قیمت: ${svc.price} تومان\n` +
        `👤 نام کاربری: ${tu.username ? "@" + tu.username : "ثبت نشده"}\n\n`;

      if (svc.subLink) text += `🔗 لینک اشتراک/کانفیگ:\n${svc.subLink}\n\n`;

      text += "لطفاً لینک را در اپ‌های معرفی‌شده در بخش راهنمایی وارد کنید.";

      bot.sendMessage(target, text, { reply_markup: { ...mainKeyboard } });
      bot.sendPhoto(target, svc.qrFileId, { caption: "🔳 QR سرویس شما" });

      bot.sendMessage(uid, "✅ لینک و QR برای مخاطب ارسال شد.");
    }

    waitingConfig[uid] = null;
    return;
  }

  // شارژ کیف پول
  if (walletTopupState[uid] && walletTopupState[uid].step === "photo") {
    const amount = walletTopupState[uid].amount || 0;

    bot.sendMessage(uid, "📸 فیش شارژ کیف پول دریافت شد. منتظر تایید باشید.", {
      reply_markup: { ...mainKeyboard }
    });

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

  // فیش کارت به کارت
  const u = getUser(uid);
  if (u.pendingService) {
    bot.sendMessage(uid, "📸 فیش سرویس دریافت شد. منتظر تایید باشید.", {
      reply_markup: { ...mainKeyboard }
    });

    bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, {
      caption:
        `📥 فیش جدید سرویس:\n` +
        `👤 کاربر: ${uid}\n` +
        `📛 سرویس: ${u.pendingService.name}\n` +
        `📏 حجم: ${u.pendingService.size}\n` +
        `💰 قیمت: ${u.pendingService.price} تومان`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✔️ تایید و افزودن به صف کانفیگ", callback_data: `sendcfg_${uid}` }]
        ]
      }
    });

    return;
  }

  bot.sendMessage(
    uid,
    "❌ هیچ سفارشی یا درخواست شارژی ثبت نشده.\nابتدا از منوی «🛒 خرید سرویس» یا «💳 کیف پول» اقدام کنید.",
    { reply_markup: { ...mainKeyboard } }
  );
});

// تایید سرویس کارت به کارت → افزودن به صف داشبورد
bot.on("callback_query", (c) => {
  const uid = c.from.id;

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
      qrFileId: null
    });

    tu.pendingService = null;
    saveDB();

    pendingConfigs.push({
      userId: targetUser,
      serviceId,
      serviceName: ps.name,
      serviceSize: ps.size
    });

    bot.sendMessage(
      targetUser,
      "✅ فیش شما تایید شد.\nسرویس شما ثبت شد.\nلطفاً منتظر دریافت لینک و QR باشید.",
      { reply_markup: { ...mainKeyboard } }
    );

    bot.sendMessage(
      ADMIN_ID,
      `✔ سرویس کارت به کارت کاربر ${targetUser} تایید شد.\nسرویس در صف داشبورد قرار گرفت.`
    );

    bot.answerCallbackQuery(c.id, { text: "سرویس به صف کانفیگ اضافه شد." });
  }
});

// سرویس‌های من → نمایش سرویس
bot.on("callback_query", (c) => {
  const uid = c.from.id;

  if (c.data.startsWith("mysvc_")) {
    const u = getUser(uid);
    const svcId = c.data.split("_")[1];
    const svc = u.services.find(s => s.id === svcId);

    if (!svc) {
      bot.answerCallbackQuery(c.id, { text: "سرویس یافت نشد." });
      return;
    }

    let text =
      `🔐 سرویس شما:\n\n` +
      `📛 نام سرویس: ${svc.name}\n` +
      `📏 حجم: ${svc.size}\n` +
      `💰 قیمت: ${svc.price} تومان\n` +
      `👤 نام کاربری: ${u.username ? "@" + u.username : "ثبت نشده"}\n\n`;

    if (svc.subLink) text += `🔗 لینک اشتراک/کانفیگ:\n${svc.subLink}\n\n`;

    text += "لینک شما آماده‌ست ✅";

    bot.sendMessage(uid, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📎 لینک‌های تکی", callback_data: `single_${svc.id}` }]
        ]
      }
    });

    if (svc.qrFileId) {
      bot.sendPhoto(uid, svc.qrFileId, { caption: "🔳 QR سرویس شما" });
    }

    bot.answerCallbackQuery(c.id);
  }

  if (c.data.startsWith("single_")) {
    bot.sendMessage(
      uid,
      "برای کپی کردن لینک‌های تکی، روی لینک اشتراک کلیک کنید.",
      { reply_markup: { ...mainKeyboard } }
    );
    bot.answerCallbackQuery(c.id, { text: "راهنمای لینک‌های تکی ارسال شد." });
  }
});
