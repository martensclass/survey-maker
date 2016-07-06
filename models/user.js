var  mongoose = require('mongoose');
var passportLocalMongoose = require('passport-local-mongoose');

var UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    surveys:[
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Survey"
        }
        ]
});

UserSchema.plugin(passportLocalMongoose);
var User = mongoose.model("User", UserSchema);
module.exports = User;