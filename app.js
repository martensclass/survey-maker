//initial code always needed
var bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    mongoose = require('mongoose'),
    express = require('express'),
    passport = require('passport'),
    User = require('./models/user'),
    flash = require('connect-flash'),
    LocalStrategy = require('passport-local'),
    app = express();
    

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.use(flash());

//configure passport:
app.use(require('express-session')({
    secret: "This is going to kill me",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function (req,res,next){
   res.locals.currentUser = req.user; 
   res.locals.error = req.flash("error");
   res.locals.success = req.flash("success");
   next();
});

var url=process.env.DATABASEURL || "mongodb://localhost/survey";
mongoose.connect(url);
//mongoose.connect("mongodb://jjmuugs:jakeman123@ds015915.mlab.com:15915/surveysalad");

var Survey = require("./models/survey");

/*
//lets make a sample object:
Survey.create({
    user: "martej",
    question: "What is your favourite Ice Cream flavour?",
    options: ["Chocolate", "Strawberry", "Vanilla"],
    values: [10,5,7]
});
*/

//USER ROUTES:  Login LogOut, Register New Account
app.get('/register', function(req,res){
    res.render('register');
});

app.post('/register', function(req,res){
    var u = new User({username: req.body.username});
    var p = req.body.password;
    User.register(u, p,function(err,user){
        if(err) return res.render('register');
        passport.authenticate("local")(req,res,function(){
           res.redirect('/surveys');
        });
    });
});

app.get('/login', function(req,res){
    res.render('login');
});

app.post('/login', passport.authenticate("local",{
        successRedirect: "/",
        failureRedirect: '/login'
    }), function(req,res){
    //do nothing for callback
});

app.get("/logout", function(req,res){
    req.logout();
    req.flash("success", "You have logged out");
    res.redirect('/surveys');
});

//test route to send data to page
app.get("/test",function(req,res){
    res.render('test',{data: "no"});
});

//RESTFUL ROUTES
app.get('/', function(req, res){
    res.redirect('/surveys');
});

app.get('/surveys', function(req, res){
    Survey.find({},function(err,surveys){
        if(err)console.log(err);
        else{
            res.render('index.ejs', {surveys:surveys});
        }
    });
});

//new create
app.get('/surveys/new', function(req, res){
    if(req.isAuthenticated()==false){
         req.flash("error", "You must login to create a survey");
        res.redirect('/login');
    }
    else{
    res.render('new');
    }
});

app.post('/surveys', function(req, res){
    var stringArray = req.body.survey['options'].split('\n');
    var tots=[];
    for(var i=0; i<stringArray.length; i++){
        tots.push(0);
        stringArray[i]=stringArray[i].replace(/\r/g, ""); 
        if(stringArray[i].length > 25) stringArray[i]=stringArray[i].slice(0,25);
    }
    if(stringArray.length > 8){
        for(var i=8; i<stringArray.length; i++){
            stringArray.pop();
        }
    }
    
   //Create Survey
     Survey.create({
       user: req.user.username,
       question: req.body.survey['question'],
       options: stringArray,
       values: tots,
       votes: []
   }, function(err,newSurvey){
      if(err){
          req.flash("error", err.message);
          res.render('new');
      } 
      else{
       User.findById(req.user._id, function(err,user){
           if(err){
               req.flash("error", err.message);
                res.redirect('/login');
           }
           else{
               user.surveys.push(newSurvey);
               user.save(function(err,data){
                   if(err)console.log(err);
               });
           }
       });
        req.flash("success", "Survey was created!");
        res.redirect('/surveys');
      }
   });
});

//show route
app.get('/surveys/:id', function(req,res){
     Survey.findById(req.params.id,function(err,survey){
         var votes = survey.votes;
         var found=false;
         var ip=req.headers["x-forwarded-for"]; 
         var user;
         if(req.isAuthenticated()) user=req.user.username;
            else user=null;
        if(err)res.redirect('/surveys');
        else{
            for(var i=0; i<votes.length; i++){
                if(votes[i]==ip || votes[i]==user)
                    found=true;
            }
            res.render('show', {survey:survey, found:found});
        }
    });
});

//edit and update
app.get('/surveys/:id/edit', function(req,res){
     Survey.findById(req.params.id,function(err,survey){
        if(err){
             req.flash("error", "Survey not found.");
            res.redirect('/surveys');
        }
        else if(req.isAuthenticated()==false){
            req.flash("error", "You must be logged in first.");
            res.redirect('/login');
        }
        else if(req.user.username != survey.user){
             req.flash("error", "You can only edit your surveys");
             res.redirect("/");
        }
        else{
            res.render('edit', {survey:survey});
        }
    });
});

//cast a vote
app.put('/surveys/update/:id', function(req, res){
    var ip=req.headers["x-forwarded-for"]; 
    var t = "" + req.body.val + "" ;
    var tots = t.split(",");
     Survey.update(
        { _id: req.params.id },
        {
        $set: {
            values: tots
        }
        }
        ,function(err,newSurvey){
        if(err){
           res.end("" + err);
        } 
      else{
          //find survey and record that a vote was cast
          Survey.findById(req.params.id,function(err,survey){
          if(err){
                req.flash("error", err.message);
                res.redirect('/surveys');
            }
            else{
                survey.votes.push(ip);
                if(req.isAuthenticated())
                    survey.votes.push(req.user.username);
                survey.save(function(err,survey){
                    if(err){
                        req.flash("error", err.message);
                        res.redirect('/surveys'); 
                    }
                });
            }
        });
          
            req.flash("success", "Your vote was cast");
            res.redirect('/surveys/' + req.params.id);
      }
      });
});

//add a survey option
app.put('/surveys/:id',function(req,res){
    var str = "" + req.body.surveyOptions + "";
    var stringArray = str.split(',');
    var t = "" + req.body.surveyValues + "" ;
    var tots = t.split(",");
    if(req.body.newOption.length>0){
        stringArray.push(req.body.newOption);
        tots.push(0);
    }
  Survey.update(
        { _id: req.params.id },
        {
        $set: {
            options: stringArray,
            values: tots
        }
        }
        ,function(err,newSurvey){
        if(err){
            req.flash("error", err.message);
            res.redirect('/surveys/' + req.params.id)
        } 
      else{
            req.flash("success", "Survey was updated");
            res.redirect('/surveys/' + req.params.id);
      }
      });
});


app.delete("/surveys/:id", function(req, res){
    if(req.isAuthenticated()==false){
        req.flash("error", "You must be logged in first.");
        res.redirect('/login');    
    }
    else{
        Survey.findByIdAndRemove(req.params.id, function(err){
            if(err)console.log(err);
            else{
                req.flash("success", "Survey Deleted");
                res.redirect('/surveys');
            }
        
    });
    }
});
//route for user's surveys
app.get('/surveys/user/:id', function(req,res){
   User.findById(req.user._id).populate("surveys").exec(function(err,user){
       if(err)console.log(err);
       else{
           res.render("userSurveys",{user: user});
       }
   });
});

//start the server
app.listen(process.env.PORT, process.env.IP, function(){
   console.log("Server started"); 
});