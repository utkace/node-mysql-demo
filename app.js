const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const fetch = require("node-fetch");
var bodyParser = require("body-parser");
const redis = require("redis");

//Initializing database
let db = new sqlite3.Database("./db/githubUsers.db", err => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Connected to the SQlite database.");
});
//--------------------

// create and connect redis client to local instance.
const client = redis.createClient(
  "redis://h:p72fc864113c1bec4e6ffeed160f944e171392e161e056414b88cdf3b80a1c499@ec2-54-162-141-93.compute-1.amazonaws.com:29479"
);
//--------------------------------------------------

//connecting to redis
client.on("connect", () => {
  console.log("cache connected!");
});
//-------------------
client.on("error", err => {
  console.log(err);
});

//initializing express
const app = express();
//--------------------

//added to parse body of  request
app.use(bodyParser.json());
//-------------------------------

//route to create a table
app.get("/createTable", (req, res) => {
  let sql =
    "CREATE TABLE github_user (id INTEGER,login TEXT PRIMARY KEY, avatar_url TEXT, name TEXT NOT NULL, bio TEXT, public_repos INTEGER, public_gists INTEGER, followers INTEGER, following INTEGER)";
  db.run(sql, err => {
    if (err) {
      return console.error(err.message);
    }
    res.send("Table created!");
  });
});
//------------------------

/**************** HELPER FUNCTIONS ***************/
function getFromDB(user) {
  let sql = `SELECT *
  FROM github_user
  WHERE login = ?`;

  return new Promise((resolve, reject) => {
    db.get(sql, [user], (err, result) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

function addToDB(data) {
  // to add the values of users to our db
  db.run(
    `INSERT INTO github_user VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.id,
      data.login,
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
      console.log(`A row has been inserted with id ${data.id}`);
    }
  );
}

function getFromCache(key) {
  return new Promise((resolve, reject) => {
    client.get(key, (err, data) => {
      // If that key exists in Redis store
      if (data) {
        data = JSON.parse(data);
        data.source = "cache";
        resolve(data);
      } else {
        getSingleUserDatafromDB(key)
          .then(data => {
            sendToCache(data, key);
            resolve(data);
          })
          .catch(error => {
            // log error message
            console.log(error);
            // send error to the client
            reject(error.toString());
          });
      }
    });
  });
}

function sendToCache(data, key) {
  client.setex(key, 30, JSON.stringify(data));
  return data;
}
/*xxxxxxxxxxxxxxxx HELPER FUNCTIONS xxxxxxxxxxxxxx*/

//A function to get user from github api
function getSingleUserDatafromAPI(user) {
  return new Promise(async (resolve, reject) => {
    const res = await fetch(`https://api.github.com/users/${user}`, {
      method: "GET"
    });

    const data = await res.json();
    const newdata = {
      id: data.id,
      login: data.login,
      avatar_url: data.avatar_url,
      name: data.name,
      bio: data.bio,
      public_repos: data.public_repos,
      public_gists: data.public_gists,
      followers: data.followers,
      following: data.following,
      source: "api"
    };
    resolve(newdata);
  });
}
//----------------------------------------

//A function to get user from the database
function getSingleUserDatafromDB(user) {
  result = [];
  return new Promise(async (resolve, reject) => {
    const res = await getFromDB(user).then(async res => {
      if (res) {
        //found in database , return
        const data = await res;
        data.source = "database";
        resolve(data);
      } else {
        //call the function to call the API
        await getSingleUserDatafromAPI(user).then(data => {
          addToDB(data);
          resolve(data);
        });
      }
    });
  });
}
//-----------------------------------------

async function getUserData(usernames) {
  result = [];
  const getData = () => {
    return Promise.all(
      usernames.map(async user => {
        await getFromCache(user).then(async res => {
          if (res) {
            //if found in cache push to final result
            result.push(res);
          } else {
            //call the function to look up in DB
            await getSingleUserDatafromDB(user).then(data => {
              result.push(data);
            });
          }
        });
      })
    );
  };
  await getData();
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

//A function to get users as array on input from database
/*async function getUserDatafromDB(usernames) {
  result = [];
  const getData = () => {
    return Promise.all(
      usernames.map(async user => {
        await getFromDB(user).then(async res => {
          if (res) {
            result.push(res);
          } else {
            await getSingleUserDatafromAPI(user).then(data => {
              result.push(data);
              addToDB(data);
            });
          }
        });
      })
    );
  };
  await getData();
  return result;
}
*/

//A function to get users as array on input from github api and add to database
/*async function getUserDatafromAPI(usernames) {
  result = [];
  const getData = async () => {
    return await Promise.all(
      usernames.map(async user => {
        const res = await fetch(`https://api.github.com/users/${user}`, {
          method: "GET"
        });
        const data = await res.json();
        addToDB(data);
        return data;
      })
    );
  };
  result = getData();
  return result;
}*/
