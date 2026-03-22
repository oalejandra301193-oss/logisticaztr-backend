const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema({

  nombre: String,
  telefono: String,
  direccion: String,
  cuit: String,

  viajes: {
    type: Number,
    default: 1
  },

  creado: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Client", ClientSchema);