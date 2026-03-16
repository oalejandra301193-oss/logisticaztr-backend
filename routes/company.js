const express = require("express");
const router = express.Router();

router.get("/", (req,res)=>{

res.json({
name:"Logistica ZTR",
phone:"+54 11 5555-5555",
email:"info@ztr.com",
support:"soporte@ztr.com"
})

})

module.exports = router;
