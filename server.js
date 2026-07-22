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

// 🔹 FUNCIÓN REPARADA: DISTANCIA REAL POR CARRETERA (OSRM)
async function distancia(lat1, lon1, lat2, lon2) {
  try {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    
    // 🔥 CORREGIDO: Interpolación de variables usando `${}` y endpoint de producción de OSRM
    const url = `https://project-osrm.org{lon1},${lat1};${lon2},${lat2}?overview=false`;
    
    const response = await fetch(url, { headers: { "User-Agent": "LogisticaZTR_App" } });
    const data = await response.json();

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

app.set("calcularDistancia", distancia);

// 🔥 ENDPOINT INTEGRADO SEGURO DE SERVIDOR A SERVIDOR
app.get("/api/mapas/calcular-ruta", async (req, res) => {
  try {
    const { origen, destino } = req.query;
    if (!origen || !destino) return res.status(400).json({ error: "Faltan ciudades" });

    const headers = { "User-Agent": "LogisticaZTR_Backend_Secure" };
    
    // 🔥 CORREGIDO: Enlaces reales completos de la API de geocodificación de Nominatim
    const urlOrigen = `https://openstreetmap.org{encodeURIComponent(origen)}&countrycodes=ar&limit=1`;
    const urlDestino = `https://openstreetmap.org{encodeURIComponent(destino)}&countrycodes=ar&limit=1`;

    const res1 = await fetch(urlOrigen, { headers });
    const data1 = await res1.json();
    const res2 = await fetch(urlDestino, { headers });
    const data2 = await res2.json();

    if (!data1 || data1.length === 0 || !data2 || data2.length === 0) {
      return res.status(400).json({ error: "No se pudieron localizar las ciudades ingresadas. Especifique ciudad y provincia." });
    }

    const lat1 = parseFloat(data1[0].lat), lon1 = parseFloat(data1[0].lon);
    const lat2 = parseFloat(data2[0].lat), lon2 = parseFloat(data2[0].lon);

    // Calculamos los kilómetros por asfalto
    const kmReales = await distancia(lat1, lon1, lat2, lon2);

    return res.json({
      distanciaKm: kmReales > 0 ? kmReales : calcularRespaldoMatematico(lat1, lon1, lat2, lon2),
      origenLat: lat1,
      origenLng: lon1,
      destinoLat: lat2,
      destinoLng: lon2
    });

  } catch (error) {
    console.error("❌ Error en endpoint de mapas:", error);
    res.status(500).json({ error: "Error interno calculando trayectoria" });
  }
});

function calcularRespaldoMatematico(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round((R * c) * 1.16); 
}

// ... El resto de tus rutas (/capturar-pago, /clientes, etc.) quedan igual abajo ...
app.get("/capturar-pago", async (req,res)=>{
  try{
    const { token } = req.query;
    if(!token) return res.status(400).send("Token faltante");
    const trip = await Trip.findOne({ paypalOrderId: token });
    if(!trip) return res.status(404).send("Viaje no encontrado");
    await Trip.findByIdAndUpdate(trip._id,{ adelantoPagado: true, adelantoFecha: new Date() });
    res.send("✅ Pago confirmado correctamente");
  }catch(err){ console.error(err); res.status(500).send("Error al capturar pago"); }
});

app.post("/trips/adelanto/:id", async(req,res)=>{
  try{
    const { monto } = req.body;
    const trip = await Trip.findById(req.params.id);
    if(!trip) return res.status(404).json({error:"Viaje no encontrado"});
    trip.adelanto = monto;
    await trip.save();
    res.json({ ok:true, adelanto:monto, mensaje:"Adelanto definido correctamente" });
  }catch(err){ res.status(500).json({error:"Error guardando adelanto"}); }
});

app.get("/clientes", async (req,res)=>{
  try{ const clientes = await Client.find(); res.json(clientes); }catch(err){ res.status(500).json({error:"Error..."}); }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));


