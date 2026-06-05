"use strict";

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendResetCode(to, name, code) {
  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM || 'A&M Importaciones'}" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Código de verificación — A&M Importaciones",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e,#2d2d5e);padding:28px 32px;text-align:center;">
            <img src="https://raw.githubusercontent.com/amexportsp-byte/data_imagen/main/logo1.png" alt="A&M" style="height:50px;object-fit:contain;"/>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a2e;font-weight:800;">Recuperación de contraseña</h2>
            <p style="margin:0 0 24px;color:#666;font-size:14px;line-height:1.6;">
              Hola <strong style="color:#1a1a2e;">${name}</strong>, recibimos una solicitud para restablecer tu contraseña.<br>
              Usa el siguiente código de verificación:
            </p>
            <div style="background:#f8f4ee;border:2px dashed #E89E48;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <span style="font-size:46px;font-weight:900;letter-spacing:14px;color:#E89E48;font-family:'Courier New',monospace;">${code}</span>
            </div>
            <p style="margin:0 0 8px;color:#888;font-size:12px;text-align:center;">
              ⏱ Este código expira en <strong>15 minutos</strong>.
            </p>
            <p style="margin:0;color:#aaa;font-size:11px;text-align:center;">
              Si no solicitaste este cambio, ignora este correo. Tu cuenta permanece segura.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;padding:16px 32px;border-top:1px solid #eee;">
            <p style="margin:0;color:#bbb;font-size:11px;text-align:center;">
              A&M Importaciones · Lima, Perú
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

module.exports = { sendResetCode };
