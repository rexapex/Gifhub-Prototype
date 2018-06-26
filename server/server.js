const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const fs = require("fs");
const app = express();
const port = 80;

app.use(bodyParser.json({ limit: "150mb" }));
app.use(bodyParser.urlencoded({extended: true}));
app.use("/static", express.static(absPath("../static")));
app.use("/jsgif", express.static(absPath("../jsgif")));
app.use("/gif", express.static(absPath("../db")));

// ensure the db directory exists
if(!fs.existsSync(absPath("../db"))) {
    fs.mkdirSync(absPath("../db"));
}

// prepend necessary crap to front to form an absolute path
function absPath(path) {
    return typeof(path) === "string" ? __dirname + "/" + path : null;
}

// http://www.hacksparrow.com/base64-encoding-decoding-in-node-js.html
// https://stackoverflow.com/questions/28834835/readfile-in-base64-nodejs
// function to encode file data to base64 encoded string
function base64Encode(file, callback) {
    // read binary data
    fs.readFile(file, function(err, data) {
        // convert binary data to base64 encoded string
        if(callback) {
            callback(new Buffer(data).toString("base64"));
        }
    });
}

// redirects
app.get("/", function(req, resp) {
    resp.redirect("/static/home-page/home.html");
});

app.get("/create", function(req, resp) {
    resp.redirect("/static/create-page/create.html");
});

app.post("/upload", function(req, resp) {
    console.log("upload received");
    //console.log(req.body);
    var img = req.body.img;
    var id = crypto.randomBytes(20).toString("hex");
    fs.writeFile(absPath("../db/") + id + ".gif", img, "base64", function(err) {
        if(err) {
            console.log(err);
            resp.status(400).send({ "error": err });
        } else {
            console.log("uploaded gif " + id);
            resp.status(200).send({ "id": id });
        }
    });
});

app.get("/gifs", function(req, resp) {
    fs.readdir(absPath("../db/"), function(err, files) {
        if(err) {
            resp.status(400).send({ "error": err });
        } else {
            resp.status(200).send({ "files": files });
        }
    });
});
/*
app.get("/gif/:id", function(req, resp) {
    var id = req.params.id;
    if(id) {
        fs.readdir("../db", function(err, files) {
            files.forEach(file => {
                console.log(file);
                if(file == id + ".gif") {
                    base64Encode(file, function(base64) {
                        return resp.status(200).send({ "img": base64 });
                    })
                }
            });
        })
    } else {
        return resp.status(400).send({ "error": "id required" });
    }

    return resp.status(404).send({ "error": "id not found" });
});*/

app.listen(port, function() {
    console.log("listening on port " + port);
});
