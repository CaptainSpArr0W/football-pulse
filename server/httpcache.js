/*
 * 多级 HTTP 缓存：内存 + 磁盘持久化
 * - 内存命中：零延迟
 * - 磁盘缓存：服务重启后不重复拉取（TTL 内命中即用）
 * - 过期条目由定时器定期清理
 * 供 fetcher.js（football-data）与 apifootball.js 共用。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, 'data', 'cache');
const mem = new Map(); // key -> { data, ts, ttl }

function keyFile(key) {
  const h = crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
  return path.join(CACHE_DIR, `${h}.json`);
}

/* 启动时载入磁盘缓存 */
function load() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
        if (j && j.k && j.d && typeof j.ts === 'number') {
          mem.set(j.k, { data: j.d, ts: j.ts, ttl: j.ttl || 0 });
        }
      } catch (_) { /* 损坏条目忽略 */ }
    }
  } catch (_) { /* 目录不存在时忽略 */ }
}

function get(key) {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.ts < hit.ttl) return hit.data;
  return undefined;
}

const timers = new Map();
function set(key, data, ttlMs) {
  if (!ttlMs || ttlMs <= 0) return; // ttl<=0 表示不缓存
  mem.set(key, { data, ts: Date.now(), ttl: ttlMs });
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(keyFile(key), JSON.stringify({ k: key, d: data, ts: Date.now(), ttl: ttlMs }));
    } catch (_) { /* 忽略写入失败 */ }
  }, 1500));
}

function del(key) {
  mem.delete(key);
  try { fs.unlinkSync(keyFile(key)); } catch (_) { /* 忽略 */ }
}

/* 定期清理过期条目（30 分钟） */
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of mem) {
    if (now - v.ts >= v.ttl) {
      mem.delete(k);
      try { fs.unlinkSync(keyFile(k)); } catch (_) { /* 忽略 */ }
    }
  }
}, 30 * 60 * 1000);
if (sweep.unref) sweep.unref(); // 不阻塞进程退出

load();
module.exports = { get, set, del, mem };
