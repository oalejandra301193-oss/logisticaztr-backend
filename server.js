require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const http = require("http");

const { Server } = require("socket.io");

const Trip = require("./models/Trip");
const Driver = require("./models/Driver");
const Client = require("./models/Client");
const Admin = require("./models/Admin");

const authRoutes = require("./routes/auth");
const companyRoutes = require("./routes/company");

const bcrypt = require("bcrypt");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rankingRoutes = require("./routes/ranking")
const driversRoutes = require("./routes/drivers")

app.use("/api/company", companyRoutes)
app.use("/ranking", rankingRoutes)
app.use("/drivers", driversRoutes)


app.set("io", io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended:true }));

app.use(express.static("public"));
app.use("/uploads",express.static("uploads"));

app.get("/", (req,res)=>{
res.redirect("/inicio-app.html")
})

app.use("/api/auth",authRoutes);
app.use("/api/company",companyRoutes);
app.use("/trips",require("./routes/trips"));

function distancia(lat1,lon1,lat2,lon2){

const R = 6371;

const dLat = (lat2-lat1) * Math.PI/180;
const dLon = (lon2-lon1) * Math.PI/180;

const a =
Math.sin(dLat/2)*Math.sin(dLat/2) +
Math.cos(lat1*Math.PI/180) *
Math.cos(lat2*Math.PI/180) *
Math.sin(dLon/2)*Math.sin(dLon/2);

const c = 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a));

return R*c;

}

app.post("/trips/adelanto/:id",async(req,res)=>{

const {monto} = req.body;

const trip = await Trip.findById(req.params.id);

if(!trip){
return res.status(404).json({error:"Viaje no encontrado"});
}

trip.adelanto = monto;

await trip.save();

res.json({ok:true,adelanto:monto});

});

app.get("/clientes", async (req,res)=>{
  try{
    const clientes = await Client.find();
    res.json(clientes);
  }catch(err){
    console.error(err);
    res.status(500).json({error:"Error obteniendo clientes"});
  }
});

app.get("/finanzas",async(req,res)=>{

const viajes = await Trip.find({estado:"FINALIZADO"});

let total = 0;
let comisiones = 0;

viajes.forEach(v=>{
total += v.valor;
comisiones += v.comision || 0;
});

res.json({
total,
comisiones,
viajes:viajes.length
});

});

app.get("/drivers",async(req,res)=>{

const drivers = await Driver.find();

res.json(drivers);

});

app.get("/trips/:id",async(req,res)=>{

const trip = await Trip.findById(req.params.id);

if(!trip){
return res.status(404).json({error:"Viaje no encontrado"});
}

res.json(trip);

});

app.get("/choferes-cercanos",async(req,res)=>{

const {lat,lng} = req.query;

const choferes = await Driver.find({disponible:true});

const cercanos = choferes.filter(c=>{

if(!c.ubicacion) return false;

const d = distancia(lat,lng,c.ubicacion.lat,c.ubicacion.lng);

return d < 100;

});

res.json(cercanos);

});

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

app.get("/crear-admin",async(req,res)=>{

const hashedPassword = await bcrypt.hash("123456",10);

const admin = new Admin({
email:"admin@logisticaztr.com",
password:hashedPassword
});

await admin.save();

res.send("Admin creado correctamente");

});

const storage = multer.diskStorage({

destination:(req,file,cb)=>{

if(req.body.tipo==="chofer"){
cb(null,"uploads/choferes");
}
else if(req.body.tipo==="cliente"){
cb(null,"uploads/clientes");
}
else if(req.body.tipo==="contrato"){
cb(null,"uploads/contratos");
}
else{
cb(null,"uploads");
}

},

filename:(req,file,cb)=>{
cb(null,Date.now()+"-"+file.originalname);
}

});

const upload = multer({storage});

app.post("/subir-documento",upload.single("archivo"),(req,res)=>{

res.json({
archivo:req.file.filename
});

});

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI)
.then(()=>{

console.log("✅ Conectado a MongoDB Atlas");

server.listen(PORT,()=>{
console.log("Servidor corriendo en puerto "+PORT);
});

})
.catch(error=>{
console.error("❌ Error conectando a MongoDB:",error);
});

app.post("/clientes/:id/archivo", verificarAdmin, upload.single("archivo"), async (req,res)=>{

try{

const cliente = await Client.findById(req.params.id);

if(!cliente){
return res.status(404).send("Cliente no encontrado");
}

if(!cliente.archivos){
cliente.archivos = [];
}

cliente.archivos.push(req.file.filename);

await cliente.save();

res.json({ok:true});

}catch(err){
console.error(err);
res.status(500).send("Error subiendo archivo");
}

});

app.post("/choferes/:id/archivo", verificarAdmin, upload.single("archivo"), async (req,res)=>{

try{

const chofer = await Driver.findById(req.params.id);

if(!chofer){
return res.status(404).send("Chofer no encontrado");
}

if(!chofer.archivos){
chofer.archivos = [];
}

chofer.archivos.push(req.file.filename);

await chofer.save();

res.json({ok:true});

}catch(err){
console.error(err);
res.status(500).send("Error subiendo archivo");
}

});

app.post("/choferes/:id/foto", upload.single("archivo"), async (req,res)=>{

try{

const chofer = await Driver.findById(req.params.id);

if(!chofer){
return res.status(404).send("Chofer no encontrado");
}

if(!req.file){
return res.status(400).send("No se subió archivo");
}

chofer.foto = req.file.filename;

await chofer.save();

res.json({ok:true});

}catch(err){
console.error(err);
res.status(500).send("Error subiendo foto");
}

});

app.post("/choferes/:id/perfil", async (req,res)=>{

try{

const chofer = await Driver.findById(req.params.id);

if(!chofer){
return res.status(404).send("Chofer no encontrado");
}

const {
nombre,
apellido,
dni,
telefono,
patente1,
patente2,
patente3
} = req.body;

chofer.nombre = nombre;
chofer.apellido = apellido;
chofer.dni = dni;
chofer.telefono = telefono;
chofer.patente1 = patente1;
chofer.patente2 = patente2;
chofer.patente3 = patente3;

await chofer.save();

res.json({ok:true});

}catch(err){
console.error(err);
res.status(500).send("Error guardando perfil");
}

});

const jwt = require("jsonwebtoken");

function verificarAdmin(req,res,next){

const auth = req.headers.authorization;

if(!auth){
return res.status(401).send("No autorizado");
}

const token = auth.split(" ")[1];

try{

const data = jwt.verify(token, process.env.JWT_SECRET);

if(data.tipo !== "admin"){
return res.status(403).send("No sos admin");
}

next();

}catch(err){
return res.status(401).send("Token inválido");
}

}





