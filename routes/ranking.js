const express = require("express")
const router = express.Router()
const Trip = require("../models/Trip")

router.get("/", async(req,res)=>{

try{

const ranking = await Trip.aggregate([

{
$match:{estado:"ENTREGADO"}
},

{
$group:{
_id:"$choferNombre",
viajes:{$sum:1}
}
},

{
$sort:{viajes:-1}
},

{
$limit:10
}

])

res.json(ranking)

}catch(err){

res.status(500).json({error:"Error ranking"})

}

})

module.exports = router
