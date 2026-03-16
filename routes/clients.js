const express = require("express");
const router = express.Router();
const Client = require("../models/Client");

router.get("/all", async (req,res)=>{

  const clients = await Client.find();
  res.json(clients);

});

router.get("/", async (req,res)=>{

const clients = await Client.find()

res.json(clients)

})


module.exports = router;