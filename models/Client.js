const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema({
  nombre: String,
  telefono: String,
  cuit: String,
  
  // Soporte dinámico para evitar que Mongoose rechace el registro si viene unificado
  direccion: String, 

  // 🔥 CAMPOS LOGÍSTICOS CON VALOR POR DEFECTO INICIAL
  comercio: { type: String, default: "" },
  direccionCarga: { type: String, default: "" },
  direccionDescarga: { type: String, default: "" },
  logo: { type: String, default: "" },

  email: String,
  password: String,

  viajes: {
    type: Number,
    default: 0
  },

  creado: {
    type: Date,
    default: Date.now
  },

  archivos: {
    type: [String],
    default: []
  }
});

module.exports = mongoose.model("Client", ClientSchema);