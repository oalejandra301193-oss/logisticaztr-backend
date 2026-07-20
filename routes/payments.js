const express = require("express");
const router = express.Router();
const Trip = require("../models/Trip");

// Configuración de credenciales desde tus variables de entorno (.env)
const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

// ⚠️ CORREGIDO: Ahora apunta correctamente al entorno de pruebas (Sandbox)
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"; 

// 🔒 FUNCIÓN AUXILIAR: Obtener Token de Acceso de PayPal
async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString("base64");
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const data = await response.json();
  return data.access_token;
}

// 🟢 1. CREAR ORDEN DE PAGO
router.post("/crear-pago", async (req, res) => {
  try {
    const { tripId, tipo } = req.body;
    
    // 🔓 VOLVEMOS A ACTIVAR LA BÚSQUEDA REAL:
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: "Viaje no encontrado" });

    let amount = 0;
    let descripcion = "";

    if (tipo === "comision") {
      amount = trip.valor * 0.05; // 5% comisión real
      descripcion = `Comisión Chofer - Viaje ${tripId}`;
    } else if (tipo === "adelanto") {
      amount = trip.adelanto || trip.valor * 0.3; // Adelanto real
      descripcion = `Adelanto Cliente - Viaje ${tripId}`;
    }

    if (amount <= 0) return res.status(400).json({ error: "Monto inválido" });

    // Obtener token dinámico
    const accessToken = await getPayPalAccessToken();
   // 

    // Llamada directa a la API de PayPal
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          description: descripcion,
          amount: {
            currency_code: "USD",
            value: amount.toFixed(2),
          },
        }],
      }),
    });

    const order = await response.json();
    
    // Retornamos el ID de la orden para que el frontend lo procese
    res.json({ id: order.id });

  } catch (err) {
    console.error("❌ ERROR CREANDO PAGO:", err);
    res.status(500).json({ error: "Error creando pago" });
  }
});

// 🟢 2. CAPTURAR Y CONFIRMAR PAGO
router.post("/capturar-pago", async (req, res) => {
  try {
    const { orderId, tripId, tipo } = req.body;

    const accessToken = await getPayPalAccessToken();

    // Llamada para capturar el dinero de la orden
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const capture = await response.json();

    // Validar si el pago fue aprobado exitosamente
    if (capture.status !== "COMPLETED") {
      return res.status(400).json({ error: "El pago no fue completado" });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: "Viaje no encontrado" });

    // Marcar en la base de datos según el tipo
    if (tipo === "comision") trip.comisionPagada = true;
    if (tipo === "adelanto") trip.adelantoPagado = true;

    await trip.save();

    res.json({ ok: true, data: capture });

  } catch (err) {
    console.error("❌ ERROR CAPTURANDO PAGO:", err);
    res.status(500).json({ error: "Error capturando pago" });
  }
});

module.exports = router;

