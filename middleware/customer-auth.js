"use strict";

const jwt = require("jsonwebtoken");

module.exports = function customerAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Token requerido" });
  const token = header.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== "customer") {
      return res.status(401).json({ error: "Token inválido" });
    }
    req.customer = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};
