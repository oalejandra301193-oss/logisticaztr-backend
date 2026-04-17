const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const Trip = require('../models/Trip');
const multer = require("multer");
const path = require("path");

const Driver = require("../models/Driver");
const Client = require("../models/Client");

function calcularDistancia(lat1,lng1,lat2,lng2){
const R = 6371;

const dLat = (lat2-lat1) * Math.PI/180;
const dLng = (lng2-lng1) * Math.PI/180;

const a =
Math.sin(dLat/2)*Math.sin(dLat/2) +
Math.cos(lat1*Math.PI/180) *
Math.cos(lat2*Math.PI/180) *
Math.sin(dLng/2)*Math.sin(dLng/2);

const c = 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a));

return R * c;
}

// STORAGE MULTER
const storage = multer.diskStorage({
destination:(req,file,cb)=> cb(null,"uploads/"),
filename:(req,file,cb)=> cb(null,Date.now()+path.extname(file.originalname))
});

const upload = multer({storage});
// 🔹 CREAR CARGA (APP CLIENTE)
router.post("/", async (req,res)=>{
try{

const clienteId = req.body.clienteId;

const {
producto,
origen,
destino,
distanciaKm,
valor,

clienteNombre,
clienteCUIT,
clienteTelefono,
clienteComercio,

direccionDescarga,
direccionCarga

} = req.body;

// 🔴 VALIDACIÓN
if(!origen || !destino){
return res.status(400).json({error:"Faltan datos"});
}

// 🔹 NORMALIZAR CUIT (CLAVE)
const clienteCUITLimpio = (clienteCUIT || "")
  .trim()
  .replace(/\s/g, "");

// 🔴 OBLIGATORIO
if(!clienteCUITLimpio){
  return res.status(400).json({error:"CUIT obligatorio"});
}

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

origenLat: req.body.origenLat,
origenLng: req.body.origenLng,
destinoLat: req.body.destinoLat,
destinoLng: req.body.destinoLng,

distanciaKm: Number(distanciaKm),
valor: Number(valor),

// 🔥 CLAVE PARA MIS CARGAS
clienteId: clienteId ? new mongoose.Types.ObjectId(clienteId) : client._id,

clienteNombre,
clienteCUIT: clienteCUITLimpio,
clienteTelefono,
clienteComercio,

clienteDireccionCarga: direccionCarga,
clienteDireccionDescarga: direccionDescarga,

estado:"PENDIENTE",
postulaciones:[],
ubicaciones:[]
});

await newTrip.save();

res.json({ok:true, viaje:newTrip});

}catch(error){
console.error(error);
res.status(500).json({error:"Error guardando carga"});
}
});

// 🔹 MAPA CARGAS
router.get("/mapa-cargas", async (req,res)=>{
try{
const trips = await Trip.find({
estado:"PUBLICADO",
origenLat:{$exists:true}
});

const data = trips.map(t=>({
id:t._id,
producto:t.producto,
lat:t.origenLat,
lng:t.origenLng,
valor:t.valor
}));

res.json(data);

}catch(err){
res.status(500).send("Error mapa cargas");
}
});

// 🔹 OBTENER VIAJES
router.get("/", async (req,res)=>{
try{
const viajes = await Trip.find();
res.json(viajes);
}catch(err){
res.status(500).json({error:"Error"});
}
});

// 🔹 MIS CARGAS (CLIENTE)
router.get("/mis-cargas/:clienteId", async (req,res)=>{
try{

const clienteId = new mongoose.Types.ObjectId(req.params.clienteId);

const viajes = await Trip.find({ clienteId });

res.json(viajes);

}catch(err){
console.error(err);
res.status(500).json({error:"Error obteniendo mis cargas"});
}
});

// 🔹 CREAR VIAJE SIMPLE (ADMIN / TEST)
router.post("/new", async (req,res)=>{
try{

const {origen,destino,valor} = req.body;

if(!origen || !destino){
return res.status(400).json({error:"Faltan datos"});
}

const newTrip = new Trip({
origen,
destino,
valor,
estado:"PENDIENTE"
});

await newTrip.save();

res.json({ok:true, viaje:newTrip});

}catch(err){
res.status(500).json({error:"Error creando viaje"});
}
});

// 🔹 APROBAR
router.post("/:id/aprobar", async (req,res)=>{
try{
const trip = await Trip.findById(req.params.id);
if(!trip) return res.status(404).send("No encontrado");

trip.estado="PUBLICADO";
await trip.save();

res.json({ok:true});

}catch(err){
res.status(500).json({error:"Error"});
}
});

// 🔹 RECHAZAR
router.put("/rechazar/:id", async (req,res)=>{
try{
await Trip.findByIdAndUpdate(req.params.id,{estado:"RECHAZADO"});
res.json({ok:true});
}catch(err){
res.status(500).json({error:"Error"});
}
});

// 🔹 POSTULAR
router.post("/postular/:id", async (req,res)=>{
try{
const trip = await Trip.findById(req.params.id);

if(!trip) return res.status(404).send("No encontrado");

trip.postulaciones.push({
nombre:req.body.nombre,
telefono:req.body.telefono,
dni:req.body.dni,
patente1:req.body.patente1
});

await trip.save();

res.send("OK");

}catch(err){
res.status(500).send("Error");
}
});

// 🔹 FINALIZAR
router.post("/finalizar/:id", async (req,res)=>{
const trip = await Trip.findById(req.params.id);

trip.estado="FINALIZADO";
trip.fechaFin=new Date();

await trip.save();

res.json({ok:true});
});

// 🔹 CLIENTES
router.get("/clientes", async (req,res)=>{
try{
const clientes = await Client.find().sort({viajes:-1});
res.json(clientes);
}catch(err){
res.status(500).json({error:"Error"});
}
});

module.exports = router;