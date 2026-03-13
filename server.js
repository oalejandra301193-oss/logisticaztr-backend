require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const authRoutes = require("./routes/auth");

function calcularComision(valor){

return valor * 0.05;

}

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

// middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 👈 ESTA LÍNEA VA ACÁ
app.use(express.static("public"));

// rutas
app.use("/api/auth", authRoutes);
app.use("/trips", require("./routes/trips"));
app.use("/uploads", express.static("uploads"));

app.post("/trips/adelanto/:id", async (req,res)=>{

const { monto } = req.body;

const trip = await Trip.findById(req.params.id);

if(!trip){

return res.status(404).json({error:"Viaje no encontrado"});

}

trip.adelanto = monto;

await trip.save();

res.json({

ok:true,
adelanto:monto

});

});

app.get("/choferes-cercanos", async (req,res)=>{

const { lat,lng } = req.query;

const choferes = await Chofer.find({disponible:true});

const cercanos = choferes.filter(c=>{

const d = distancia(lat,lng,c.lat,c.lng);

return d < 100;

});

res.json(cercanos);

});

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) =>{
res.send('Servidor funcionando correctamente 🚀');
});

const bcrypt = require("bcrypt");
const Admin = require("./models/Admin");

app.set("io", io);

app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente 🚀');
});

mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log('✅ Conectado a MongoDB Atlas');

server.listen(3000, ()=>{
console.log("Servidor corriendo");
});    

app.get("/crear-admin", async (req, res) => {

    const hashedPassword = await bcrypt.hash("123456", 10);

    const admin = new Admin({
        email: "admin@logisticaztr.com",
        password: hashedPassword
    });

    await admin.save();

    res.send("Admin creado correctamente");
});

})

.catch((error) => {
    console.error('❌ Error conectando a MongoDB:', error);
});

app.post("/trips/postular", async(req,res)=>{

const {tripId,dni} = req.body;

const trip = await Trip.findById(tripId);

trip.postulaciones.push({

dni

});

await trip.save();

res.json({ok:true});

});


app.post("/trips/aceptar-chofer", async (req,res)=>{

const {tripId,dni} = req.body;

const trip = await Trip.findById(tripId);

const postulacion = trip.postulaciones.find(p=>p.dni===dni);

trip.choferDni = postulacion.dni;
trip.choferNombre = postulacion.nombre;

trip.estado="ASIGNADO";

// 💰 calcular comisión empresa
trip.comision = trip.valor * 0.05;

await trip.save();

res.json({ok:true});

});


app.post("/trips/rechazar-chofer", async (req,res)=>{

const {tripId,dni} = req.body;

const trip = await Trip.findById(tripId);

trip.postulaciones = trip.postulaciones.filter(p=>p.dni!==dni);

await trip.save();

res.json({ok:true});

});

const multer = require("multer");

const storage = multer.diskStorage({

destination:(req,file,cb)=>{

if(req.body.tipo === "chofer"){

cb(null,"uploads/choferes");

}

else if(req.body.tipo === "cliente"){

cb(null,"uploads/clientes");

}

else if(req.body.tipo === "contrato"){

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

app.post("/subir-documento", upload.single("archivo"), (req,res)=>{

res.json({

archivo:req.file.filename

});

});

app.post("/trips/cotizar", async(req,res)=>{

const {tripId,dni,precio} = req.body;

const trip = await Trip.findById(tripId);

trip.cotizaciones.push({

dni,
precio

});

await trip.save();

res.json({ok:true});

});

app.post("/rating", async(req,res)=>{

const {tripId,rating,comentario} = req.body;

const trip = await Trip.findById(tripId);

trip.ratingChofer = rating;
trip.comentario = comentario;

await trip.save();

res.json({ok:true});

});

app.get("/ranking-choferes", async(req,res)=>{

const ranking = await Trip.aggregate([

{
$group:{
_id:"$choferDni",
viajes:{$sum:1},
promedio:{$avg:"$ratingChofer"}
}
}

]);

res.json(ranking);

});



