const express = require("express");
const mysql = require("mysql");

// var db = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "123456",
//   database: "nodemysql"
// });

const app = express();

// db.connect(err => {
//   if (err) {
//     throw err;
//   }

//   console.log("MySQL DB connected!");
// });

app.listen("5000", () => {
  console.log("Server started on port 5000");
});
