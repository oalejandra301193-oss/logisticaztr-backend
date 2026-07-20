const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const Trip = require('../models/Trip');
const multer = require("multer");
const path = require("path");

const Driver = require("../models/Driver");
const Client = require("../models/Client");

// 🌐 NUEVA FUNCIÓN: CONEXIÓN CON LA API DE RUTAS POR CARRETERA (OSRM)
async function calcularDistanciaReal(lat1, lng1, lat2, lng2) {
  try {
    // Si faltan coordenadas, evitamos romper el servidor y devolvemos 0
    if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
    
    // OSRM utiliza la estructura de coordenadas: longitud,latitud;longitud,latitud
    const url = `https://project-osrm.org{lng1},${lat1};${lng2},${lat2}?overview=false`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      // Convertimos los metros entregados por OSRM a Kilómetros totales
      const distanciaEnKm = data.routes.distance / 1000;
      return parseFloat(distanciaEnKm.toFixed(1)); // Retorna un decimal (ej: 420.5)
    }
    return 0;
  } catch (error) {
    console.error("❌ Error interno consultando OSRM terrestre:", error);
    return 0;
  }
}

// STORAGE MULTER
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

// 🔹 CREAR CARGA (APP CLIENTE)
router.post("/", async (req, res) => {
  try {
    const clienteId = req.body.clienteId;

    const {
      producto,
      origen,
      destino,
      valor,
      clienteNombre,
      clienteCUIT,
      clienteTelefono,
      clienteComercio,
      direccionDescarga,
      direccionCarga,
      origenLat,
      origenLng,
      destinoLat,
      destinoLng
    } = req.body;

    // 🔴 VALIDACIÓN
    if (!origen || !destino) {
      return res.status(400).json({ error: "Faltan datos de origen o destino" });
    }

    // 🔹 NORMALIZAR CUIT (CLAVE)
    const clienteCUITLimpio = (clienteCUIT || "").trim().replace(/\s/g, "");

    // 🔴 OBLIGATORIO
    if (!clienteCUITLimpio) {
      return res.status(400).json({ error: "CUIT obligatorio" });
    }

    // 🔹 CALCULAR DISTANCIA REAL POR CARRETERA (OSRM)
    // Forzamos al backend a ignorar lo que venga de Flutter y calcular los km reales
    const kmRealesCalculados = await calcularDistanciaReal(origenLat, origenLng, destinoLat, destinoLng);

    // 🔹 BUSCAR CLIENTE
    let client = await Client.findOne({ cuit: clienteCUITLimpio });

    // 🔴 SI NO EXISTE → CREAR
    if (!client) {
      client = new Client({
        nombre: clienteNombre,
        comercio: clienteComercio,
        cuit: clienteCUITLimpio,
        telefono: clienteTelefono,
        direccion: direccionCarga,
        viajes: 1
      });
    } else {
      // 🔹 SI EXISTE → ACTUALIZAR (IMPORTANTE)
      client.nombre = clienteNombre;
      client.comercio = clienteComercio;
      client.telefono = clienteTelefono;
      client.direccion = direccionCarga;
      client.viajes += 1;
    }

    await client.save();

    // 🔹 VIAJE
    const newTrip = new Trip({
      producto,
      origen,
      destino,
      origenLat: Number(origenLat),
      origenLng: Number(origenLng),
      destinoLat: Number(destinoLat),
      destinoLng: Number(destinoLng),
      
      // 🔥 REEMPLAZADO: Ahora guardamos los kilómetros calculados por la API vial terrestre
      distanciaKm: kmRealesCalculados, 
      valor: Number(valor),

      // 🔥 CLAVE PARA MIS CARGAS
      clienteId: clienteId ? new mongoose.Types.ObjectId(clienteId) : client._id,

      clienteNombre,
      clienteCUIT: clienteCUITLimpio,
      clienteTelefono,
      clienteComercio,

      clienteDireccionCarga: direccionCarga,
      clienteDireccionDescarga: direccionDescarga,

      estado: "PENDIENTE",
      postulaciones: [],
      ubicaciones: []
    });

    await newTrip.save();
    res.json({ ok: true, viaje: newTrip });

  } catch (error) {
    console.error("❌ ERROR GUARDANDO CARGA:", error);
    res.status(500).json({ error: "Error guardando carga" });
  }
});

// 🔹 MAPA CARGAS
router.get("/mapa-cargas", async (req, res) => {
  try {
    const trips = await Trip.find({
      estado: "PUBLICADO",
      origenLat: { $exists: true }
    });

    const data = trips.map(t => ({
      id: t._id,
      producto: t.producto,
      lat: t.origenLat,
      lng: t.origenLng,
      valor: t.valor
    }));

    res.json(data);
  } catch (err) {
    res.status(500).send("Error mapa cargas");
  }
});

// 🔹 OBTENER VIAJES
router.get("/", async (req, res) => {
  try {
    const viajes = await Trip.find();
    res.json(viajes);
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

// 🔹 MIS CARGAS (CLIENTE)
router.get("/mis-cargas/:clienteId", async (req, res) => {
  try {
    const clienteId = new mongoose.Types.ObjectId(req.params.clienteId);
    const viajes = await Trip.find({ clienteId });
    res.json(viajes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo mis cargas" });
  }
});

// 🔹 CREAR VIAJE SIMPLE (ADMIN / TEST)
router.post("/new", async (req, res) => {
  try {
    const { origen, destino, valor } = req.body;

    if (!origen || !destino) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const newTrip = new Trip({
      origen,
      destino,
      valor,
      estado: "PENDIENTE"
    });

    await newTrip.save();
    res.json({ ok: true, viaje: newTrip });
  } catch (err) {
    res.status(500).json({ error: "Error creando viaje" });
  }
});

// 🔹 APROBAR
router.post("/:id/aprobar", async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).send("No encontrado");

    trip.estado = "PUBLICADO";
    await trip.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

// 🔹 RECHAZAR
router.put("/rechazar/:id", async (req, res) => {
  try {
    await Trip.findByIdAndUpdate(req.params.id, { estado: "RECHAZADO" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

// 🔹 POSTULAR
router.post("/postular/:id", async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).send("No encontrado");

    trip.postulaciones.push({
      nombre: req.body.nombre,
      telefono: req.body.telefono,
      dni: req.body.dni,
      patente1: req.body.patente1
    });

    await trip.save();
    res.send("OK");
  } catch (err) {
    res.status(500).send("Error");
  }
});

// 🔹 FINALIZAR
router.post("/finalizar/:id", async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  trip.estado = "FINALIZADO";
  trip.fechaFin = new Date();
  await trip.save();
  res.json({ ok: true });
});

// 🔹 CLIENTES
router.get("/clientes", async (req, res) => {
  try {
    const clientes = await Client.find().sort({ viajes: -1 });
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

module.exports = router;
