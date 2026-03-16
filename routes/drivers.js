const express = require("express")
const router = express.Router()
const Trip = require("../models/Trip")

router.post("/ubicacion", async(req,res)=>{

const {dni,lat,lng} = req.body

try{

await Trip.updateMany(

{choferDni:dni},

{
$set:{
ultimaUbicacion:{
lat,
lng,
fecha:new Date()
}
}
}

)

res.json({ok:true})

}catch(err){

res.status(500).json({error:"error ubicacion"})

}

})

module.exports = router
