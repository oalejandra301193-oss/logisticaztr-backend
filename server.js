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

// middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 👈 ESTA LÍNEA VA ACÁ
app.use(express.static("public"));

// rutas
app.use("/api/auth", authRoutes);
app.use("/trips", require("./routes/trips"));
app.use("/uploads", express.static("uploads"));

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
