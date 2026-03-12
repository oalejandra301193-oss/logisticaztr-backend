const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema({

  nombre: String,
  telefono: String,
  direccion: String,
  cuit: String,

  creado: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Client", ClientSchema);