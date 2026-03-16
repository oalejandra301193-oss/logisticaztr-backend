const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Admin = require("../models/Admin");
const Chofer = require("../models/Driver");
const Cliente = require("../models/Client");

const router = express.Router();


// LOGIN ADMIN
router.post("/login", async (req, res) => {

const { email, password } = req.body;

const admin = await Admin.findOne({ email });

if (!admin) {
return res.status(401).send("Admin no encontrado");
}

const valid = await bcrypt.compare(password, admin.password);

if (!valid) {
return res.status(401).send("Password incorrecto");
}

const token = jwt.sign(
{ email: email, tipo:"admin" },
process.env.JWT_SECRET
);

res.json({ token });

});


// LOGIN CHOFER
router.post("/chofer/login", async (req,res)=>{

const {email,password} = req.body;

const chofer = await Chofer.findOne({email});

if(!chofer){
return res.status(401).send("Chofer no encontrado");
}

const valid = await bcrypt.compare(password,chofer.password);

if(!valid){
return res.status(401).send("Password incorrecto");
}

const token = jwt.sign(
{email:email,tipo:"chofer"},
process.env.JWT_SECRET
);

res.json({token});

});


// LOGIN CLIENTE
router.post("/cliente/login", async (req,res)=>{

const {email,password} = req.body;

const cliente = await Cliente.findOne({email});

if(!cliente){
return res.status(401).send("Cliente no encontrado");
}

const valid = await bcrypt.compare(password,cliente.password);

if(!valid){
return res.status(401).send("Password incorrecto");
}

const token = jwt.sign(
{email:email,tipo:"cliente"},
process.env.JWT_SECRET
);

res.json({token});

});


module.exports = router;