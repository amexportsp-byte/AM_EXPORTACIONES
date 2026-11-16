"use strict";
/**
 * TOTP (RFC 6238) para la verificación en 2 pasos con app autenticadora
 * (Google Authenticator, Microsoft Authenticator, Authy…). Sin dependencias.
 * El secreto se guarda cifrado (AES-256-GCM) en la BD.
 */
const crypto = require("crypto");

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;   // segundos por código
const DIGITS = 6;

function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20)); // 160 bits
}

function codeAt(secretB32, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secretB32)).update(counter).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[off] & 0x7f) << 24) | (hmac[off + 1] << 16) | (hmac[off + 2] << 8) | hmac[off + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Verifica un código aceptando ±1 intervalo (desfase de reloj del celular).
 * Devuelve el número de intervalo usado (para impedir reutilizarlo) o null.
 */
function verify(secretB32, code, window = 1) {
  const c = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = Math.floor(Date.now() / 1000 / STEP);
  for (let w = -window; w <= window; w++) {
    const expected = codeAt(secretB32, now + w);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return now + w;
  }
  return null;
}

function otpauthUrl(secretB32, account, issuer = "A&M Importaciones") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}

/* ── Cifrado del secreto en reposo ── */
function key() {
  const base = process.env.TOTP_ENC_KEY || process.env.JWT_SECRET;
  if (!base) throw new Error("Falta JWT_SECRET/TOTP_ENC_KEY para cifrar 2FA");
  return crypto.createHash("sha256").update(base + ":totp-v1").digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

function decrypt(stored) {
  const [v, iv, tag, data] = String(stored || "").split(":");
  if (v !== "v1") throw new Error("Formato de secreto 2FA desconocido");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

module.exports = { generateSecret, verify, codeAt, otpauthUrl, encrypt, decrypt, STEP };
