const mongoose = require("mongoose");

const DriverSchema = new mongoose.Schema({

  nombre: String,
  dni: String,

  patente1: String,
  patente2: String,
  patente3: String,

  viajes: {
    type: Number,
    default: 0
  },

  verificado: {
    type: Boolean,
    default: false
  },

  disponible:{
  type:Boolean,
  default:true
  },

  ultimaUbicacion:{
  lat:Number,
  lng:Number
  }

});

module.exports = mongoose.model("Driver", DriverSchema);