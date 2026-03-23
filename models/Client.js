const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema({

  nombre: String,
  telefono: String,
  direccionComercial: String,
  CUIT: String,

  // 🔥 LOGIN
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