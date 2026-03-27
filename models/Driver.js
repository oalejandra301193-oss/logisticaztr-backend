const mongoose = require("mongoose");

const DriverSchema = new mongoose.Schema({

  nombre: String,
  apellido: String,
  dni: String,
  telefono: String,
  patente1: String,
  patente2: String,
  patente3: String,

  email: String,
  password: String,

  disponible: {
    type: Boolean,
    default: false
  },

  verificado: {
    type: Boolean,
    default: false
  },

  viajes: {
    type: Number,
    default: 0
  },

  foto: String,

  archivos: {
    type: [String],
    default: []
  },

  // 🔥 CLAVE PARA TODO EL SISTEMA
  ultimaUbicacion: {
    lat: Number,
    lng: Number,
    fecha: {
      type: Date,
      default: Date.now
    }
  }

}, { timestamps: true });

module.exports = mongoose.model("Driver", DriverSchema);