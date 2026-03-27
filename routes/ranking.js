const express = require("express");
const router = express.Router();
const Trip = require("../models/Trip");

// 🏆 RANKING DE CHOFERES
router.get("/", async(req,res)=>{

  try{

    const ranking = await Trip.aggregate([

      // 🔥 SOLO VIAJES TERMINADOS
      {
        $match:{ estado:"FINALIZADO" }
      },

      // 🔥 AGRUPAR POR CHOFER
      {
        $group:{
          _id:"$chofer.nombre",
          viajes:{ $sum:1 },
          km:{ $sum:"$distanciaTotal" },
          rating:{ $avg:"$ratingChofer" }
        }
      },

      // 🔥 ORDENAR POR CANTIDAD DE VIAJES
      {
        $sort:{ viajes:-1 }
      },

      // 🔥 TOP 10
      {
        $limit:10
      }

    ]);

    res.json(ranking);

  }catch(err){

    console.error("❌ ERROR RANKING:", err);
    res.status(500).json({error:"Error ranking"});

  }

});

module.exports = router;
