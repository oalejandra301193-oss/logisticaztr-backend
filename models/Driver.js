const mongoose = require("mongoose");

const DriverSchema = new mongoose.Schema({

  nombre: String,
  apellido: String,
  dni: String,
  telefono: String,

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
  }

});

module.exports = mongoose.model("Driver", DriverSchema);