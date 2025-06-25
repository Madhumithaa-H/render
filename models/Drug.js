const mongoose = require("mongoose");
const Drug = new mongoose.Schema({
    drugname:{
      type:String,
      required:true,
    },
    category:{
      type:String,
      required:true,
    },
    agegroup:{
        type:String,
        required:true,
    },
    dosage: {
    min: {
      value: {
        type: Number,
        required: true,
      },
      unit: {
        type: String,
        required: true,
      },
    },
    max: {
      value: {
        type: Number,
        required: true,
      },
      unit: {
        type: String,
        required: true,
      },
    },
  },
    fataldosage:{
      value: {
        type: Number,
        required: true,
      },
      unit: {
        type: String,
        required: true,
      },
    },   
})
const Drugs = mongoose.model("drug",Drug);
module.exports = Drugs;