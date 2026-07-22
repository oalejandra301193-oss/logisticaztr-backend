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

res.json({
  token,
  id: chofer._id
});

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

res.json({
  token,
  _id: cliente._id,
  cuit: cliente.cuit
});

});

// ==========================================
// REGISTRO CLIENTE (REPARADO Y SINCRO CON MODELO)
// ==========================================
router.post("/cliente/register", async (req, res) => {
  try {
    // 🔥 CORREGIDO: Se extraen las propiedades reales del formulario: direccionCarga y direccionDescarga
    const { nombre, cuit, email, password, telefono, direccionCarga, direccionDescarga } = req.body;

    // Control adicional de seguridad para que el CUIT tampoco se duplique en MongoDB Atlas
    const existeEmail = await Cliente.findOne({ email });
    if (existeEmail) {
      return res.status(400).send("El correo electrónico ya se encuentra registrado");
    }

    const existeCuit = await Cliente.findOne({ cuit });
    if (existeCuit) {
      return res.status(400).send("El número de CUIT comercial ya se encuentra registrado");
    }

    const hash = await bcrypt.hash(password, 10);

    // 🔥 CORREGIDO: Mapeo exacto alineado al ClientSchema (Primer Archivo)
    const nuevo = new Cliente({
      nombre,
      cuit,
      email,
      password: hash,
      telefono,
      direccionCarga: direccionCarga || direccionDescarga, // Soporte en caso de que un campo llegue vacío
      direccionDescarga: direccionDescarga || direccionCarga,
      comercio: nombre, // Valor por defecto inicial para evitar campos obligatorios nulos
      viajes: 0,
      archivos: []
    });

    await nuevo.save();
    res.json({ ok: true });

  } catch (err) {
    console.error("❌ Error interno en registro de base de datos:", err);
    res.status(500).send("Error interno del servidor al procesar el alta comercial");
  }
});

router.post("/chofer/register", async (req,res)=>{

try{

const {nombre,apellido,dni,email,password,telefono,patente1,patente2,patente3} = req.body;

const existe = await Chofer.findOne({email});

if(existe){
return res.status(400).send("Chofer ya existe");
}

const hash = await bcrypt.hash(password,10);

const nuevo = new Chofer({
nombre,
apellido,
dni,
email,
password:hash,
telefono,
patente1,
patente2,
patente3,
disponible:false
});

await nuevo.save();

res.json({ok:true});

}catch(err){
console.error(err);
res.status(500).send("Error registrando chofer");
}

});


module.exports = router;