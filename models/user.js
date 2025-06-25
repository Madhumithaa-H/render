const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name:{
      type:String,
      Required:true,
    },
    UserName:{
        type:String,
        required:true,
        unique:true
    },
    Password:{
        type:String,
        required:true,
    },
    doctorID:{
       type:String,
       required:true,
       unique:true,
    },
});


const User = mongoose.model("User",userSchema);
module.exports = User;

