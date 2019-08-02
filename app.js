const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const fetch = require("node-fetch");
var bodyParser = require("body-parser");

//Initializing database
let db = new sqlite3.Database("./db/githubUsers.db", err => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Connected to the SQlite database.");
});

//initializing express
const app = express();

//added to parse body of  request
app.use(bodyParser.json());

//route to create a table
app.get("/createTable", (req, res) => {
  let sql =
    "CREATE TABLE github_user (id INTEGER PRIMARY KEY, avatar_url TEXT, name TEXT NOT NULL, bio TEXT, public_repos INTEGER, public_gists INTEGER, followers INTEGER, following INTEGER)";
  db.run(sql, err => {
    if (err) {
      return console.error(err.message);
    }
    res.send("Table created!");
  });
});

//A function to get users from github api and add to database
async function getUserData(usernames) {
  result = [];
  const getData = async () => {
    return await Promise.all(
      usernames.map(async user => {
        const res = await fetch(`https://api.github.com/users/${user}`, {
          method: "GET"
        });
        const data = await res.json();

        // to add the values of users to our db
        db.run(
          `INSERT INTO github_user VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.id,
            data.avatar_url,
            data.name,
            data.bio,
            data.public_repos,
            data.public_gists,
            data.followers,
            data.following
          ],
          err => {
            if (err) {
              return console.log(err.message);
            }
            // get the last insert id
            console.log(`A row has been inserted with rowid ${this.lastID}`);
          }
        );

        return data;
      })
    );
  };
  result = getData();
  return result;
}

app.post("/api/getUsers", (req, res) => {
  try {
    const usernames = req.body.query.usernames;
    getUserData(usernames).then(data => {
      res.status(200).send(data);
    });
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json({ message: "Sorry, something went wrong please try again later." });
  }
});

app.listen("5000", () => {
  console.log("Server started on port 5000");
});
