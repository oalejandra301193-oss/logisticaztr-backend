const mongoose = require("mongoose");
const crypto = require("crypto");

const tripSchema = new mongoose.Schema({

  choferNombre:String,
  choferDni:String,

  ratingChofer:{
  type:Number,
  default:0
  },

  ratingCliente:{
  type:Number,
  default:0
  },

  cargaConfirmadaChofer:{
type:Boolean,
default:false
},

cargaConfirmadaCliente:{
type:Boolean,
default:false
},

descargaConfirmadaChofer:{
type:Boolean,
default:false
},

descargaConfirmadaCliente:{
type:Boolean,
default:false
},


  comentario:String,

  // 📍 Datos del viaje
origen: { type: String, required: true },
destino: { type: String, required: true },

// 🌍 Coordenadas para mapa
origenLat: Number,
origenLng: Number,
destinoLat: Number,
destinoLng: Number,

distanciaKm: { type: Number, required: true },
valor: { type: Number, required: true },
producto: { type: String, required: true },

// 💳 Adelanto que paga el cliente a la empresa
adelanto:{
type:Number,
default:0
},

// 💰 comisión de Logistica ZTR
comision:{
type:Number,
default:0
},

  // 📦 Estado del viaje
  estado: {
    type: String,
    default: "PENDIENTE"
  },

  // 🧾 Datos del cliente
  clienteNombre: String,
  clienteDireccion: String,
  clienteCUIT: String,
  clienteTelefono: String,

  // 💰 Comisión
  comisionPagada: {
    type: Boolean,
    default: false
  },

  // 🚛 Datos del chofer
  chofer: {
    nombre: {
      type: String,
      default: "Sin asignar"
    },
    dni: String,
    telefono: String,
    camion: String
  },

  // ✅ Verificaciones
  clienteVerificado: {
    type: Boolean,
    default: false
  },

  choferVerificado: {
    type: Boolean,
    default: false
  },

  // 📎 Archivos de verificación
  archivoCliente: String,
  archivoChofer: String,

  // 🚛 CARGA PUBLICA
  publicado: {
    type: Boolean,
    default: true
  },

  // 👨‍✈️ CHOFERES QUE SE POSTULAN
  postulaciones: [
    {
      nombre: String,
      telefono: String,
      dni: String,
      patente1: String,
      patente2: String,
      patente3: String,
      fecha: { type: Date, default: Date.now }
    }
  ],

  cotizaciones:[
{
dni:String,
precio:Number,
fecha:{
type:Date,
default:Date.now
}
}
],


  // 📏 Distancia recorrida real
  distanciaTotal: {
    type: Number,
    default: 0
  },

  // 🔐 Token único para link del chofer
  tokenChofer: {
    type: String,
    default: () => crypto.randomBytes(32).toString("hex")
  },

  // 📡 Seguimiento
  seguimientoActivo: {
    type: Boolean,
    default: false
  },

  seguimientoRechazado: {
    type: Boolean,
    default: false
  },

  fechaInicioSeguimiento: Date,
  fechaFinSeguimiento: Date,

  // 📍 Historial de ubicaciones
  ubicaciones: [
    {
      lat: Number,
      lng: Number,
      fechaCreacion: {
        type: Date,
        default: Date.now
      }
    }
  ],

  // 📍 Última ubicación rápida
  ultimaUbicacion: {
    lat: Number,
    lng: Number,
    fechaCreacion: {
      type: Date,
      default: Date.now
    }
  } 

}, { timestamps: true });


module.exports = mongoose.model("Trip", tripSchema);