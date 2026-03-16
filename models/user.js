const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({

nombre:String,
email:String,
password:String,

tipo:{
type:String,
enum:["admin","chofer","cliente"]
},

telefono:String,
dni:String,

fecha:{
type:Date,
default:Date.now
}

})

module.exports = mongoose.model("User",UserSchema)