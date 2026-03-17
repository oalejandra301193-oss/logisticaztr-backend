const express = require('express');
const router = express.Router();
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
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });


// 🔹 OBTENER TODOS LOS VIAJES (API)
router.get("/", async (req, res) => {
  try {

    const trips = await Trip.find();

const viajes = trips.map(t=>{

let direccion = "Dirección bloqueada hasta pagar comisión";

if(t.comisionPagada){
direccion = t.clienteDireccion;
}

return {
...t._doc,
clienteDireccion: direccion
}

});

res.json(viajes);

  } catch (error) {

    res.status(500).json({ error: "Error al obtener viajes" });

  }
});

// 🔹 PANEL ADMIN
router.get('/all', async (req, res) => {

  try {

    const trips = await Trip.find().sort({ createdAt: -1 });

    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    const viajesHoy = trips.filter(v =>
      new Date(v.createdAt) >= hoy
    );

    const totalFacturadoHoy = viajesHoy.reduce(
      (acc,v) => acc + (v.valor || 0),
      0
    );

    const viajesActivos = trips.filter(
      v => v.estado === "EN_VIAJE"
    ).length;

    const viajesPendientes = trips.filter(
      v => v.estado === "DISPONIBLE"
    ).length;

    const comisiones = trips.reduce(
      (acc,v) => acc + (v.valor * 0.05),
      0
    );

    let filas = trips.map(trip => {

let postulacionesHTML = "";

if(trip.postulaciones && trip.postulaciones.length > 0){

postulacionesHTML = `

<b>📨 ${trip.postulaciones.length} postulaciones</b>

<br><br>

<button onclick="verPostulaciones('${trip._id}')">
Ver postulaciones
</button>

<div id="post-${trip._id}" style="display:none">

${trip.postulaciones.map(p => `

<div style="border:1px solid #ccc;padding:5px;margin:5px">

👤 ${p.nombre}  
📞 ${p.telefono}  
🚛 ${p.patente1}

<form action="/trips/aceptar-chofer/${trip._id}" method="POST">

<input type="hidden" name="nombre" value="${p.nombre}">
<input type="hidden" name="telefono" value="${p.telefono}">
<input type="hidden" name="dni" value="${p.dni}">
<input type="hidden" name="camion" value="${p.patente1}">

<button type="submit">✅ Aceptar</button>

</form>

</div>

`).join("")}

</div>

`;

}else{

postulacionesHTML = "Sin postulaciones";

}

return `

<tr>

<td>${trip.origen}</td>
<td>${trip.destino}</td>
<td>${trip.producto || "-"}</td>
<td>${trip.distanciaKm || 0} km</td>
<td>$${trip.valor}</td>
<td>${trip.estado}</td>
<td>${trip.chofer?.nombre || "Sin asignar"}</td>

<td>

📨 ${trip.postulaciones ? trip.postulaciones.length : 0} postulaciones

<br><br>

${postulacionesHTML}

</td>

</tr>

`;

}).join("");

res.send(`

<html>
<head>
<title>Panel de Viajes</title>
</head>

<body>

<h2>🚛 Panel de Viajes</h2>

<div style="display:flex;gap:20px">

<div>💰 Total hoy $${totalFacturadoHoy.toFixed(2)}</div>
<div>🚛 Viajes activos ${viajesActivos}</div>
<div>📦 Pendientes ${viajesPendientes}</div>
<div>💵 Comisiones $${comisiones.toFixed(2)}</div>

</div>

<table border="1" cellpadding="10">

<tr>
<th>Origen</th>
<th>Destino</th>
<th>Producto</th>
<th>Km</th>
<th>Valor</th>
<th>Estado</th>
<th>Chofer</th>
<th>Acciones</th>
</tr>

${filas}

</table>

<script src="/socket.io/socket.io.js"></script>

<script>

const socket = io();

socket.on("nuevo-viaje",(data)=>{

alert(
"🚛 Nueva carga disponible\n" +
data.origen + " → " + data.destino
);

});

function verPostulaciones(id){

const div = document.getElementById("post-"+id);

if(div.style.display === "none"){
div.style.display = "block";
}else{
div.style.display = "none";
}

}

</script>

</body>
</html>

`);

} catch (error) {

  res.status(500).send("Error al obtener viajes");

}

});

router.post("/:id/aprobar", async (req,res)=>{

const id = req.params.id

await Trip.findByIdAndUpdate(id,{
estado:"PUBLICADO"
})

res.send("Carga aprobada")

})

// 🔹 CREAR VIAJE
router.post("/new", async (req, res) => {

try {
  
if(!req.body.origen || !req.body.destino){
return res.status(400).json({
error:"Faltan datos"
});
}
// 🔹 BUSCAR CHOFER DISPONIBLE
const driverDisponible = await Driver.findOne({
disponible:true
});

if(!driverDisponible){
return res.status(400).json({
error:"No hay choferes disponibles"
});
}  

const {
origen,
destino,
valor,
producto,
clienteNombre,
clienteDireccion,
clienteCUIT,
clienteTelefono
} = req.body;

// 🔹 CLIENTE
let client = await Client.findOne({ cuit: clienteCUIT });

if (!client) {

client = new Client({
nombre: clienteNombre,
cuit: clienteCUIT,
telefono: clienteTelefono,
direccion: clienteDireccion,
viajes: 1
});

} else {

client.viajes += 1;

}

await client.save();

// 🔹 CREAR VIAJE
const newTrip = new Trip({

origen,
destino,
valor,
producto,

cliente: {
nombre: clienteNombre,
direccion: clienteDireccion,
cuit: clienteCUIT,
telefono: clienteTelefono
},

// 🔹 ASIGNAR CHOFER 
chofer: driverDisponible._id,
choferDni: driverDisponible.dni,

estado: "DISPONIBLE",
publicado: true,
postulaciones: [],
ubicaciones: []

});

await newTrip.save();

// marcar chofer ocupado
driverDisponible.disponible = false;
await driverDisponible.save();

// 🔹 SOCKET NOTIFICACION
const io = req.app.get("io");

io.emit("nuevo-viaje",{
origen:newTrip.origen,
destino:newTrip.destino,
producto:newTrip.producto
});

res.json({
ok:true,
viaje:newTrip
});

// MATCH AUTOMATICO POR DISTANCIA

const drivers = await Driver.find({
disponible:true
});

let mejorDriver = null;
let menorDistancia = 9999;

drivers.forEach(d=>{

if(!d.ultimaUbicacion) return;

const dist = calcularDistancia(
req.body.origenLat,
req.body.origenLng,
d.ultimaUbicacion.lat,
d.ultimaUbicacion.lng
);

if(dist < menorDistancia){
menorDistancia = dist;
mejorDriver = d;
}

});

if(mejorDriver){

newTrip.chofer = {
nombre:mejorDriver.nombre,
dni:mejorDriver.dni,
telefono:mejorDriver.telefono
};

newTrip.estado = "ASIGNADO";

await newTrip.save();
}

// MATCH AUTOMATICO CHOFER

const choferDisponible = await Driver.findOne({
ciudad: origen,
disponible:true
});

if(choferDisponible){

newTrip.chofer = {
nombre:choferDisponible.nombre,
telefono:choferDisponible.telefono,
dni:choferDisponible.dni
};

newTrip.estado="ASIGNADO";

await newTrip.save();

}  

}catch (error) {

  console.error(error);
  res.status(500).send("Error al crear viaje");

}

});


// 🔹 VER POSTULACIONES
router.get("/postulaciones/:id", async (req, res) => {

try {

const trip = await Trip.findById(req.params.id);

if (!trip) {
  return res.status(404).send("Viaje no encontrado");
}

res.json(trip.postulaciones || []);

} catch (error) {

console.error(error);
  res.status(500).send("Error obteniendo postulaciones");

}

});


// 🔹 ELIMINAR VIAJE
router.post("/eliminar/:id", async (req, res) => {

try {

const trip = await Trip.findById(req.params.id);

if (!trip) {
return res.status(404).send("Viaje no encontrado");
}

await Trip.findByIdAndDelete(req.params.id);

res.redirect("/trips/all");

} catch (error) {

console.error(error);
  res.status(500).send("Error eliminando viaje");

}

});


// 🚛 ACEPTAR CHOFER
router.post("/aceptar-chofer/:id", async (req,res)=>{

try{

const trip = await Trip.findById(req.params.id);

if(!trip){
return res.status(404).send("Viaje no encontrado");
}

trip.chofer = {

nombre: req.body.nombre,
telefono: req.body.telefono,
dni: req.body.dni,
camion: req.body.camion

};

trip.estado = "ASIGNADO";

await trip.save();

res.redirect("/trips/all");

}catch(error){

console.log(error);
res.status(500).send("Error asignando chofer");

}

});

// 🔄 CAMBIAR ESTADO DEL VIAJE
router.put("/token/:token/estado", async (req,res)=>{

try{

const { token } = req.params;
const { estado } = req.body;

const trip = await Trip.findOne({ tokenChofer: token });

if(!trip){
return res.status(404).send("Viaje no encontrado");
}

trip.estado = estado;

await trip.save();

res.json({ok:true});

}catch(error){

console.log(error);
res.status(500).send("Error cambiando estado");

}

});

// 📍 GUARDAR UBICACION GPS DEL CHOFER
router.post("/token/:token/ubicacion", async (req, res) => {

try{

const { token } = req.params;
const { lat, lng } = req.body;

const trip = await Trip.findOne({ tokenChofer: token });

if(!trip){
return res.status(404).send("Viaje no encontrado");
}

if(!trip.ubicaciones){
trip.ubicaciones = [];
}

trip.ubicaciones.push({
lat,
lng,
fecha: new Date()
});

if(trip.ubicaciones.length > 1){

const anterior = trip.ubicaciones[trip.ubicaciones.length - 2];

const distancia = calcularDistancia(
anterior.lat,
anterior.lng,
lat,
lng
);

trip.distanciaTotal = (trip.distanciaTotal || 0) + distancia;

}

const desvio = calcularDistancia(
lat,
lng,
trip.destinoLat,
trip.destinoLng
);

if(desvio > 3){

trip.alertaDesvio = true;

}

// guardar ultima ubicacion
trip.ultimaUbicacion = {
lat,
lng
};

await trip.save();

res.json({ok:true});

}catch(error){

console.log(error);
res.status(500).send("Error guardando ubicación");

}

});

// 🚛 POSTULARSE A UN VIAJE

router.post("/postular/:id", async (req, res) => {

try {

const trip = await Trip.findById(req.params.id);

if (!trip) {
  return res.status(404).send("Viaje no encontrado");
}

if (!trip.postulaciones) {
trip.postulaciones = [];
}

trip.postulaciones.push({
  nombre: req.body.nombre,
  telefono: req.body.telefono,
  dni: req.body.dni,
  patente1: req.body.patente1
});

await trip.save();

res.send("Postulación enviada");

} catch (error) {

console.error(error);
  res.status(500).send("Error postulando");

}

});

router.get("/distancia", async (req,res)=>{

const {origen,destino} = req.query

if(!origen || !destino){
return res.json({km:0})
}

// cálculo simple temporal
const tabla = {
"buenos aires-cordoba":700,
"buenos aires-rosario":300,
"rosario-cordoba":400
}

const key = (origen+"-"+destino).toLowerCase()

const km = tabla[key] || 500

res.json({km})

})

// 🔹 FINALIZAR VIAJE
router.post("/finalizar/:id", async (req,res)=>{

const trip = await Trip.findById(req.params.id);

trip.estado = "FINALIZADO";

trip.fechaFin = new Date();

await trip.save();

res.json({ok:true});

});

// 🗺️ API MAPA ADMIN
router.get("/mapa", async (req,res)=>{

try{

const trips = await Trip.find({
ultimaUbicacion:{$exists:true}
});

const data = trips.map(trip=>({

id:trip._id,
producto:trip.producto,
origen:trip.origen,
destino:trip.destino,
lat:trip.ultimaUbicacion?.lat,
lng:trip.ultimaUbicacion?.lng

}));

res.json(data);

}catch(error){

console.log(error);
res.status(500).send("Error mapa");

}

});

// RANKING CHOFER

router.get("/ranking-choferes", async(req,res)=>{

const ranking = await Trip.aggregate([

{
$group:{
_id:"$choferNombre",
viajes:{$sum:1},
km:{$sum:"$distanciaTotal"},
rating:{$avg:"$ratingChofer"}
}
},

{
$sort:{viajes:-1}
}

]);

res.json(ranking);

});

router.post("/pagar-comision/:id", async (req,res)=>{

try{

const trip = await Trip.findById(req.params.id);

trip.comisionPagada = true;

await trip.save();

res.json({
ok:true,
mensaje:"Comisión registrada"
});

}catch(error){

res.status(500).send("Error al registrar comisión");

}

});

// ⭐ CALIFICAR VIAJE
router.post("/calificar/:id", async(req,res)=>{

try{

const trip = await Trip.findById(req.params.id);

const {
ratingChofer,
ratingCliente,
comentario
} = req.body;

if(ratingChofer){
trip.ratingChofer = ratingChofer;
}

if(ratingCliente){
trip.ratingCliente = ratingCliente;
}

trip.comentario = comentario;

await trip.save();

res.json({
ok:true
});

}catch(error){

console.log(error);
res.status(500).send("Error calificando");

}

});

// CAMBIAR DISPONIBILIDAD CHOFER

router.post("/chofer/disponibilidad", async(req,res)=>{

const {dni, disponible} = req.body;

const driver = await Driver.findOne({dni});

if(!driver){
return res.status(404).send("Chofer no encontrado");
}

driver.disponible = disponible;

await driver.save();

res.json({ok:true});

});

router.get("/finanzas", async(req,res)=>{

const trips = await Trip.find({estado:"FINALIZADO"});

const total = trips.reduce((a,b)=>a+(b.valor||0),0);

const comisiones = trips.reduce((a,b)=>a+(b.valor*0.05),0);

const km = trips.reduce((a,b)=>a+(b.distanciaTotal||0),0);

res.json({
ingresos:total,
comisiones:comisiones,
kmTotales:km,
viajes:trips.length
});

});

router.post("/location", async (req,res)=>{

try{

const {lat,lng,driverId} = req.body;

const driver = await Driver.findById(driverId);

if(!driver){
return res.status(404).json({error:"Driver no encontrado"});
}

driver.ultimaUbicacion = {
lat,
lng
};

await driver.save();

res.json({ok:true});

}catch(err){

console.error(err);
res.status(500).json({error:"Error guardando ubicación"});

}

});

module.exports = router;