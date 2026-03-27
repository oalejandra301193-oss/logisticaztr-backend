const express = require("express");
const router = express.Router();

const Trip = require("../models/Trip");
const paypal = require("@paypal/checkout-server-sdk");

// 🔥 CONFIG PAYPAL (una sola vez)
const environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT,
  process.env.PAYPAL_SECRET
);

const client = new paypal.core.PayPalHttpClient(environment);

// 🟢 CREAR PAGO (COMISION O ADELANTO)
router.post("/crear-pago", async(req,res)=>{

  try{

    const { tripId, tipo } = req.body;

    const trip = await Trip.findById(tripId);

    if(!trip){
      return res.status(404).json({error:"Viaje no encontrado"});
    }

    let amount = 0;
    let descripcion = "";

    // 🔥 DIFERENCIAR PAGOS
    if(tipo === "comision"){
      amount = trip.valor * 0.05;
      descripcion = "Pago de comisión del chofer";
    }

    if(tipo === "adelanto"){
      amount = trip.adelanto || trip.valor * 0.3; // fallback
      descripcion = "Adelanto del cliente";
    }

    if(amount <= 0){
      return res.status(400).json({error:"Monto inválido"});
    }

    // 🔥 CREAR ORDEN PAYPAL
    const request = new paypal.orders.OrdersCreateRequest();

    request.requestBody({
      intent:"CAPTURE",
      purchase_units:[{
        description: descripcion,
        amount:{
          currency_code:"USD",
          value: amount.toFixed(2)
        }
      }]
    });

    const order = await client.execute(request);

    res.json({
      id: order.result.id
    });

  }catch(err){

    console.error("❌ ERROR PAYMENTS:", err);

    res.status(500).json({
      error:"Error creando pago"
    });

  }

});

// 🟢 CONFIRMAR PAGO (cuando PayPal responde)
router.post("/capturar-pago", async(req,res)=>{

  try{

    const { orderId, tripId, tipo } = req.body;

    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const capture = await client.execute(request);

    const trip = await Trip.findById(tripId);

    if(!trip){
      return res.status(404).json({error:"Viaje no encontrado"});
    }

    // 🔥 MARCAR PAGOS
    if(tipo === "comision"){
      trip.comisionPagada = true;
    }

    if(tipo === "adelanto"){
      trip.adelantoPagado = true;
    }

    await trip.save();

    res.json({
      ok:true,
      data:capture.result
    });

  }catch(err){

    console.error("❌ ERROR CAPTURANDO:", err);

    res.status(500).json({
      error:"Error capturando pago"
    });

  }

});

module.exports = router;