const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const router = express.Router();

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) return res.send("Admin no encontrado");

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return res.send("Password incorrecto");

  const token = jwt.sign(
  {email: email},
  process.env.JWT_SECRET
  );

  res.json({ token });

});

module.exports = router;