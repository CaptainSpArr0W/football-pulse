/*
 * 用量告警邮件（可选，配置后自动生效，未配置不影响站点）
 * 配置：server/data/notify-config.json（已被 .gitignore 排除）或环境变量
 * {
 *   "smtp": { "host": "smtp.qq.com", "port": 465, "secure": true, "user": "你的邮箱", "pass": "SMTP 授权码" },
 *   "from": "足球脉动 <你的邮箱>",
 *   "to": ["接收告警的邮箱"]
 * }
 * 环境变量：NOTIFY_SMTP_HOST / NOTIFY_SMTP_PORT / NOTIFY_SMTP_SECURE / NOTIFY_SMTP_USER /
 *           NOTIFY_SMTP_PASS / NOTIFY_FROM / NOTIFY_TO（多个用逗号分隔）
 */
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'data', 'notify-config.json');
const CONFIG = loadConfig();
let warned = false;

function loadConfig() {
  try {
    // 优先环境变量
    const env = {
      smtp: {
        host: process.env.NOTIFY_SMTP_HOST || undefined,
        port: process.env.NOTIFY_SMTP_PORT ? Number(process.env.NOTIFY_SMTP_PORT) : undefined,
        secure: process.env.NOTIFY_SMTP_SECURE === 'true',
        user: process.env.NOTIFY_SMTP_USER || undefined,
        pass: process.env.NOTIFY_SMTP_PASS || undefined,
      },
      from: process.env.NOTIFY_FROM || undefined,
      to: process.env.NOTIFY_TO ? process.env.NOTIFY_TO.split(',').map((s) => s.trim()).filter(Boolean) : [],
    };
    if (env.smtp.host && env.smtp.user && env.smtp.pass && env.to.length) return env;
    let raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function isConfigured() {
  return !!(CONFIG && CONFIG.smtp && CONFIG.smtp.host && CONFIG.smtp.user && CONFIG.smtp.pass
    && CONFIG.to && CONFIG.to.length);
}

async function sendMail(subject, text) {
  if (!isConfigured()) {
    if (!warned) {
      console.log('[notify] 未配置邮件告警（server/data/notify-config.json），仅输出控制台日志');
      warned = true;
    }
    return false;
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: CONFIG.smtp.host,
      port: CONFIG.smtp.port || 465,
      secure: CONFIG.smtp.secure !== false,
      auth: { user: CONFIG.smtp.user, pass: CONFIG.smtp.pass },
    });
    await transporter.sendMail({
      from: CONFIG.from || CONFIG.smtp.user,
      to: CONFIG.to.join(', '),
      subject,
      text,
    });
    console.log(`[notify] 告警邮件已发送：${subject}`);
    return true;
  } catch (err) {
    console.error(`[notify] 邮件发送失败：${err.message}`);
    return false;
  }
}

/* 告警去重：同一天同一 key 只发送一次（附带冷却防抖），map 按天清理 */
const sent = new Map();
let sentDay = '';
function bjDateStr() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function alert(key, subject, text) {
  const today = bjDateStr();
  if (sentDay !== today) { sent.clear(); sentDay = today; }
  const k = `${today}:${key}`;
  if (sent.has(k)) return Promise.resolve(false);
  sent.set(k, Date.now());
  return sendMail(subject, text);
}

module.exports = { sendMail, alert, isConfigured };
