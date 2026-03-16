const mongoose = require("mongoose")

const CompanySchema = new mongoose.Schema({

name:String,
phone:String,
email:String,
address:String,
support:String

})

const express = require("express")
const router = express.Router()

const Company = require("../models/Company")

router.get("/", async(req,res)=>{

const company = await Company.findOne()

res.json(company)

})

router.post("/", async(req,res)=>{

let company = await Company.findOne()

if(!company){

company = new Company(req.body)

}else{

Object.assign(company,req.body)

}

await company.save()

res.json(company)

})

module.exports = router


module.exports = mongoose.model("Company",CompanySchema)
