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

// 📁 MULTER
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
app.use("/api/payments", require("./routes/payments"));

// 🔁 HOME
app.get("/", (req,res)=>{
  res.redirect("/inicio-app.html");
});

// 🔹 NUEVA FUNCIÓN REPARADA: DISTANCIA REAL POR CARRETERA (OSRM)
async function distancia(lat1, lon1, lat2, lon2) {
  try {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    
    // 🔥 CORREGIDO: URL oficial y bien estructurada (Longitud primero, luego Latitud)
    const url = `https://openstreetmap.de{lon1},${lat1};${lon2},${lat2}?overview=false`;
    
    const response = await fetch(url);
    const data = await response.json();

    // 🔥 CORREGIDO: Validación segura de la respuesta antes de mapear la propiedad distance
    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      const distanciaEnKm = data.routes[0].distance / 1000;
      return parseFloat(distanciaEnKm.toFixed(1)); 
    }
    return 0;
  } catch (error) {
    console.error("❌ Error en OSRM calculando ruta terrestre:", error);
    return 0;
  }
}

// Compartir función con el enrutador de trips
app.set("calcularDistancia", distancia);

// 🔹 ANTIGUA RUTA DE CAPTURA DE PAGOS (Mantenida por compatibilidad)
app.get("/capturar-pago", async (req,res)=>{
  try{
    const { token } = req.query;
    if(!token) return res.status(400).send("Token faltante");

    const trip = await Trip.findOne({ paypalOrderId: token });
    if(!trip) return res.status(404).send("Viaje no encontrado");

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

// 🔹 ADELANTO
app.post("/trips/adelanto/:id", async(req,res)=>{
  try{
    const { monto } = req.body;
    const trip = await Trip.findById(req.params.id);
    if(!trip) return res.status(404).json({error:"Viaje no encontrado"});

    trip.adelanto = monto;
    await trip.save();

    res.json({ ok:true, adelanto:monto, mensaje:"Adelanto definido correctamente" });
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
    const clienteId = new mongoose.Types.ObjectId(req.params.clienteId);
    const trips = await Trip.find({ clienteId: clienteId });
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
    if(!cuit) return res.status(400).json({error:"CUIT obligatorio"});

    let cliente = await Client.findOne({ cuit });

    if(!cliente){
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
      cliente.nombre = req.body.nombre;
      cliente.comercio = req.body.comercio;
      cliente.telefono = req.body.telefono;
      cliente.direccionDescarga = req.body.direccionDescarga;
      cliente.direccionCarga = req.body.direccionCarga;
      if(req.file) cliente.logo = req.file.filename;
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
    if(!cliente) return res.status(404).json({error:"Cliente no encontrado"});

    if(req.body.nombre) cliente.nombre = req.body.nombre;
    if(req.body.comercio) cliente.comercio = req.body.comercio;
    if(req.body.telefono) cliente.telefono = req.body.telefono;
    if(req.body.direccionDescarga) cliente.direccionDescarga = req.body.direccionDescarga;
    if(req.body.direccionCarga) cliente.direccionCarga = req.body.direccionCarga;
    if(req.file) cliente.logo = req.file.filename;

    await cliente.save();
    res.json(cliente);
  }catch(err){
    console.error(err);
    res.status(500).json({error:"Error actualizando cliente"});
  }
});

app.get("/clientes/:id", async (req,res)=>{
  try{
    const cliente = await Client.findById(req.params.id);
    if(!cliente) return res.status(404).json({error:"Cliente no encontrado"});
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

  res.json({ total, comisiones, viajes:viajes.length });
});

// 🔹 DRIVERS
app.get("/drivers",async(req,res)=>{
  try {
    const drivers = await Driver.find();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo choferes" });
  }
});

// 🔹 OBTENER VIAJE
app.get("/trips/:id",async(req,res)=>{
  try {
    const trip = await Trip.findById(req.params.id);
    if(!trip) return res.status(404).json({error:"Viaje no encontrado"});
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

// 🔹 CHOFERES CERCANOS REPARADO (MAPA ASÍNCRONO)
app.get("/choferes-cercanos", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "Faltan coordenadas" });

    const choferes = await Driver.find({ disponible: true });
    const cercanos = [];

    // Evaluamos la distancia de cada chofer mediante bucle asíncronizado obligatorio
    for (const c of choferes) {
      if (c.ultimaUbicacion && c.ultimaUbicacion.lat && c.ultimaUbicacion.lng) {
        const d = await distancia(
          parseFloat(lat), 
          parseFloat(lng), 
          parseFloat(c.ultimaUbicacion.lat), 
          parseFloat(c.ultimaUbicacion.lng)
        );
        // Si el recorrido vial real es menor a 100 Kilómetros, califica
        if (d > 0 && d < 100) {
          cercanos.push(c);
        }
      }
    }
    res.json(cercanos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error procesando mapa de choferes cercanos" });
  }
});

// 🔹 RANKING
app.get("/ranking",async(req,res)=>{
  const top = await Trip.aggregate([
    { $group:{ _id:"$choferDni", promedio:{ $avg:"$ratingChofer" } } },
    { $sort:{ promedio:-1 } },
    { $limit:5 }
  ]);
  res.json(top);
});

// INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Mongo conectado`);
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
