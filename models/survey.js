var  mongoose = require('mongoose');

var surverySchema = new mongoose.Schema({
    user: String,
    question: String,
    options: [String],
    values: [Number],
    votes: [String]
});

var Survey = mongoose.model("Survey", surverySchema);
module.exports = Survey;