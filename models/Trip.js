const mongoose = require("mongoose");
const crypto = require("crypto");

const tripSchema = new mongoose.Schema({

  // 🚛 DATOS CHOFER (rápido acceso)
  choferNombre: String,
  choferDni: String,

  // ⭐ CALIFICACIONES
  ratingChofer:{
    type:Number,
    default:0
  },
  ratingCliente:{
    type:Number,
    default:0
  },

  comentario:String,

  // 📍 ORIGEN / DESTINO
  origen: { type: String, required: true },
  destino: { type: String, required: true },

  // 🌍 COORDENADAS
  origenLat: Number,
  origenLng: Number,
  destinoLat: Number,
  destinoLng: Number,

  distanciaKm: { type: Number, required: true },
  valor: { type: Number, required: true },
  producto: { type: String, required: true },

  // 💳 DINERO
  adelanto:{
    type:Number,
    default:0
  },
  comision:{
    type:Number,
    default:0
  },
  comisionPagada:{
    type:Boolean,
    default:false
  },
  adelantoPagado:{
  type:Boolean,
  default:false
},

  // 📦 ESTADO
  estado:{
    type:String,
    enum:["PENDIENTE","PUBLICADO","ASIGNADO","EN_VIAJE","FINALIZADO","RECHAZADO"],
    default:"PENDIENTE"
  },

  // 👤 CLIENTE
  clienteNombre: String,
  clienteCUIT: String,
  clienteTelefono: String,
  clienteDireccionComercial: String,
  clienteDireccionCarga: String,
  clienteDireccionDescarga: String,

  // 🚛 CHOFER COMPLETO
  chofer:{
    nombre:{
      type:String,
      default:"Sin asignar"
    },
    dni:String,
    telefono:String,
    camion:String
  },

  // ✅ CONFIRMACIONES
  cargaConfirmadaChofer:{ type:Boolean, default:false },
  cargaConfirmadaCliente:{ type:Boolean, default:false },
  descargaConfirmadaChofer:{ type:Boolean, default:false },
  descargaConfirmadaCliente:{ type:Boolean, default:false },

  // 🚛 PUBLICACIÓN
  publicado:{
    type:Boolean,
    default:true
  },

  // 📨 POSTULACIONES
  postulaciones:[
    {
      nombre:String,
      telefono:String,
      dni:String,
      patente1:String,
      patente2:String,
      patente3:String,
      fecha:{ type:Date, default:Date.now }
    }
  ],

  // 💰 COTIZACIONES
  cotizaciones:[
    {
      dni:String,
      precio:Number,
      fecha:{ type:Date, default:Date.now }
    }
  ],

  // 📏 DISTANCIA REAL
  distanciaTotal:{
    type:Number,
    default:0
  },

  // 🔐 TOKEN CHOFER
  tokenChofer:{
    type:String,
    default: () => crypto.randomBytes(32).toString("hex")
  },

  // 📡 TRACKING
  seguimientoActivo:{ type:Boolean, default:false },
  seguimientoRechazado:{ type:Boolean, default:false },

  fechaInicioSeguimiento: Date,
  fechaFinSeguimiento: Date,

  // 📍 HISTORIAL GPS
  ubicaciones:[
    {
      lat:Number,
      lng:Number,
      fecha:{ type:Date, default:Date.now }
    }
  ],

  // 📍 ÚLTIMA UBICACIÓN
  ultimaUbicacion:{
    lat:Number,
    lng:Number,
    fecha:{ type:Date, default:Date.now }
  }

}, { timestamps:true });

module.exports = mongoose.model("Trip", tripSchema);