const express = require("express");
const router = express.Router();

const Trip = require("../models/Trip");

// 📍 ACTUALIZAR UBICACIÓN DEL CHOFER
router.post("/ubicacion", async (req, res) => {

  try {

    const { dni, lat, lng } = req.body;

    // 🔴 VALIDACIÓN BÁSICA
    if (!dni || lat === undefined || lng === undefined) {
      return res.status(400).json({
        error: "Faltan datos (dni, lat, lng)"
      });
    }

    // 🔹 ACTUALIZAR TODOS LOS VIAJES DE ESE CHOFER
    await Trip.updateMany(
      { choferDni: dni },
      {
        $set: {
          ultimaUbicacion: {
            lat: Number(lat),
            lng: Number(lng),
            fechaCreacion: new Date()
          }
        }
      }
    );

    res.json({ ok: true });

  } catch (error) {

    console.error("❌ Error ubicacion chofer:", error);

    res.status(500).json({
      error: "Error actualizando ubicación"
    });

  }

});

module.exports = router;
