require('dotenv').config();

const fs = require("fs");

// 📁 CREAR CARPETAS SI NO EXISTEN
["uploads", "uploads/choferes", "uploads/clientes"].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const multer = require("multer");
const jwt = require("jsonwebtoken");


// 📁 MULTER (🔧 MOVIDO ARRIBA)
const storage = multer.diskStorage({
  destination:(req,file,cb)=>{
    if(req.originalUrl.includes("choferes")){
      cb(null,"uploads/choferes");
    } else if(req.originalUrl.includes("clientes")){
      cb(null,"uploads/clientes");
    } else {
      cb(null,"uploads");
    }
  },
  filename:(req,file,cb)=>{
    cb(null,Date.now()+"-"+file.originalname);
  }
});

const upload = multer({storage});

// 📦 MODELOS
const Trip = require("./models/Trip");
const Driver = require("./models/Driver");
const Client = require("./models/Client");
const Admin = require("./models/Admin");

// 📦 ROUTES
const authRoutes = require("./routes/auth");
const companyRoutes = require("./routes/company");
const rankingRoutes = require("./routes/ranking");
const driversRoutes = require("./routes/drivers");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("io", io);

// 🔧 MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended:true }));

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// 📦 ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/ranking", rankingRoutes);
app.use("/drivers", driversRoutes);
app.use("/trips", require("./routes/trips"));

// 🔁 HOME
app.get("/", (req,res)=>{
  res.redirect("/inicio-app.html");
});

// 🔹 DISTANCIA
function distancia(lat1,lon1,lat2,lon2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;

  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) *
    Math.cos(lat2*Math.PI/180) *
    Math.sin(dLon/2)**2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

app.get("/capturar-pago", async (req,res)=>{

try{

const { token } = req.query;

if(!token){
  return res.status(400).send("Token faltante");
}

const accessToken = await getAccessToken();

// 🔥 CAPTURA REAL EN PAYPAL
await axios({
  url: `https://api-m.sandbox.paypal.com/v2/checkout/orders/${token}/capture`,
  method: "post",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`
  }
});

// 🔥 BUSCAR VIAJE POR PAYPAL
const trip = await Trip.findOne({ paypalOrderId: token });

if(!trip){
  return res.status(404).send("Viaje no encontrado");
}

// 🔥 CONFIRMAR PAGO + FECHA
await Trip.findByIdAndUpdate(trip._id,{
  adelantoPagado: true,
  adelantoFecha: new Date()
});

res.send("✅ Pago confirmado correctamente");

}catch(err){
console.error(err);
res.status(500).send("Error al capturar pago");
}

});

// 🔹 ADELANTO (solo define el monto, NO paga)
app.post("/trips/adelanto/:id", async(req,res)=>{
  try{

    const { monto } = req.body;

    const trip = await Trip.findById(req.params.id);

    if(!trip){
      return res.status(404).json({error:"Viaje no encontrado"});
    }

    trip.adelanto = monto;

    await trip.save();

    res.json({
      ok:true,
      adelanto:monto,
      mensaje:"Adelanto definido correctamente"
    });

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Error guardando adelanto"});
  }
});

// 🔹 CLIENTES
app.get("/clientes", async (req,res)=>{
  try{
    const clientes = await Client.find();
    res.json(clientes);
  }catch(err){
    res.status(500).json({error:"Error obteniendo clientes"});
  }
});

app.get("/trips/cliente/:clienteId", async (req, res) => {
  try {

    const trips = await Trip.find({
      clienteId: req.params.clienteId
    });

    res.json(trips);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo viajes" });
  }
});

// 🔹 CREAR PERFIL CLIENTE
app.post("/clientes/perfil", upload.single("logo"), async (req,res)=>{
  try{

    const cuit = (req.body.cuit || "").trim().replace(/\s/g, "");

    if(!cuit){
      return res.status(400).json({error:"CUIT obligatorio"});
    }

    let cliente = await Client.findOne({ cuit });

    if(!cliente){
      // 🔹 CREA SOLO SI NO EXISTE
      cliente = new Client({
        nombre: req.body.nombre,
        comercio: req.body.comercio,
        cuit,
        telefono: req.body.telefono,
        direccionDescarga: req.body.direccionDescarga,
        direccionCarga: req.body.direccionCarga,
        logo: req.file ? req.file.filename : null,
        viajes: 0
      });
    } else {
      // 🔹 ACTUALIZA (CLAVE PARA NO DUPLICAR)
      cliente.nombre = req.body.nombre;
      cliente.comercio = req.body.comercio;
      cliente.telefono = req.body.telefono;
      cliente.direccionDescarga = req.body.direccionDescarga;
      cliente.direccionCarga = req.body.direccionCarga;

      if(req.file){
        cliente.logo = req.file.filename;
      }
    }

    await cliente.save();

    res.json(cliente);

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Error guardando cliente"});
  }
});

app.put("/clientes/:id", upload.single("logo"), async (req,res)=>{
  try{

    const cliente = await Client.findById(req.params.id);

    if(!cliente){
      return res.status(404).json({error:"Cliente no encontrado"});
    }

    // 🔥 DEBUG (dejalo para probar)
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    // 🔥 ACTUALIZAR CAMPOS
    if(req.body.nombre) cliente.nombre = req.body.nombre;
    if(req.body.comercio) cliente.comercio = req.body.comercio;
    if(req.body.telefono) cliente.telefono = req.body.telefono;
    if(req.body.direccionDescarga) cliente.direccionDescarga = req.body.direccionDescarga;
    if(req.body.direccionCarga) cliente.direccionCarga = req.body.direccionCarga;

    // 🔥 LOGO
    if(req.file){
      cliente.logo = req.file.filename;
    }

    await cliente.save();

    res.json(cliente);

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Error actualizando cliente"});
  }
});

// 🔹 OBTENER CLIENTE POR ID
app.get("/clientes/:id", async (req,res)=>{
  try{

    const cliente = await Client.findById(req.params.id);

    if(!cliente){
      return res.status(404).json({error:"Cliente no encontrado"});
    }

    res.json(cliente);

  }catch(err){
    res.status(500).json({error:"Error obteniendo cliente"});
  }
});

// 🔹 FINANZAS
app.get("/finanzas",async(req,res)=>{
  const viajes = await Trip.find({estado:"FINALIZADO"});

  let total = 0;
  let comisiones = 0;

  viajes.forEach(v=>{
    total += v.valor || 0;
    comisiones += v.valor * 0.05;
  });

  res.json({
    total,
    comisiones,
    viajes:viajes.length
  });
});

// 🔹 DRIVERS
app.get("/drivers",async(req,res)=>{
  const drivers = await Driver.find();
  res.json(drivers);
});

// 🔹 OBTENER VIAJE
app.get("/trips/:id",async(req,res)=>{
  const trip = await Trip.findById(req.params.id);

  if(!trip){
    return res.status(404).json({error:"Viaje no encontrado"});
  }

  res.json(trip);
});

// 🔹 CHOFERES CERCANOS
app.get("/choferes-cercanos",async(req,res)=>{
  const {lat,lng} = req.query;

  const choferes = await Driver.find({disponible:true});

  const cercanos = choferes.filter(c=>{
    if(!c.ultimaUbicacion) return false;

    const d = distancia(lat,lng,c.ultimaUbicacion.lat,c.ultimaUbicacion.lng);
    return d < 100;
  });

  res.json(cercanos);
});

// 🔹 RANKING
app.get("/ranking",async(req,res)=>{
  const top = await Trip.aggregate([
    {
      $group:{
        _id:"$choferDni",
        promedio:{$avg:"$ratingChofer"}
      }
    },
    {$sort:{promedio:-1}},
    {$limit:5}
  ]);

  res.json(top);
});

// 🔹 CREAR ADMIN
app.get("/crear-admin",async(req,res)=>{
  const hashedPassword = await bcrypt.hash("123456",10);

  const admin = new Admin({
    email:"admin@logisticaztr.com",
    password:hashedPassword
  });

  await admin.save();
  res.send("Admin creado");
});

// 🔹 SUBIR ARCHIVO
app.post("/subir-documento",upload.single("archivo"),(req,res)=>{
  res.json({archivo:req.file.filename});
});

// 🔹 FOTO CHOFER
app.post("/choferes/:id/foto", upload.single("archivo"), async (req,res)=>{
  try{
    const chofer = await Driver.findById(req.params.id);

    if(!chofer){
      return res.status(404).send("Chofer no encontrado");
    }

    chofer.foto = req.file.filename;
    await chofer.save();

    res.json({ok:true});
  }catch(err){
    res.status(500).send("Error subiendo foto");
  }
});

// 🔹 PERFIL CHOFER
app.post("/choferes/:id/perfil", async (req,res)=>{
  try{
    const chofer = await Driver.findById(req.params.id);

    if(!chofer){
      return res.status(404).send("Chofer no encontrado");
    }

    Object.assign(chofer, req.body);
    await chofer.save();

    res.json({ok:true});

  }catch(err){
    res.status(500).send("Error guardando perfil");
  }
});

// 🔐 MIDDLEWARE ADMIN
function verificarAdmin(req,res,next){
  const auth = req.headers.authorization;

  if(!auth){
    return res.status(401).send("No autorizado");
  }

  try{
    const token = auth.split(" ")[1];
    const data = jwt.verify(token, process.env.JWT_SECRET);

    if(data.tipo !== "admin"){
      return res.status(403).send("No sos admin");
    }

    next();

  }catch(err){
    return res.status(401).send("Token inválido");
  }
}

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI)
.then(()=>{
  console.log("✅ Mongo conectado");

  server.listen(PORT,()=>{
    console.log("🚀 Servidor en puerto " + PORT);
  });

})
.catch(error=>{
  console.error("❌ Error Mongo:",error);
});

const axios = require("axios");

const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

async function getAccessToken(){

const res = await axios({
  url: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
  method: "post",
  headers: {
    "Accept": "application/json",
    "Accept-Language": "en_US"
  },
  auth: {
    username: PAYPAL_CLIENT,
    password: PAYPAL_SECRET
  },
  data: "grant_type=client_credentials"
});

return res.data.access_token;
}

app.post("/crear-pago", async (req,res)=>{

try{

const { monto, tripId } = req.body;

const accessToken = await getAccessToken();

const order = await axios({
  url: "https://api-m.sandbox.paypal.com/v2/checkout/orders",
  method: "post",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`
  },
  data: {
    intent: "CAPTURE",
    purchase_units: [{
      amount: {
        currency_code: "USD",
        value: monto
      }
    }],
    application_context: {
      return_url: `http://localhost:3000/pago-exitoso.html`,
      cancel_url: `http://localhost:3000/pago-cancelado.html`
    }
  }
});

// 🔥 GUARDAR RELACIÓN CON PAYPAL
await Trip.findByIdAndUpdate(tripId, {
  paypalOrderId: order.data.id,
  adelanto: monto
});

const link = order.data.links.find(l=> l.rel==="approve").href;

res.json({ url: link });

}catch(err){
console.error(err);
res.status(500).send("Error creando pago");
}

});





