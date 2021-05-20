let Imap = require('imap');
let POP3Client = require("mailpop3");

const simpleParser = require('mailparser').simpleParser;
const { authenticateToken, generateAccessToken } = require('./security.js');

// Object containing all emails of a session, with data only accessible only to the user
const allEmails = {};

/*
  Connect IMAP and store all emails under token
*/
module.exports.connectIMAP = function (req, res) {
  const {
    username: user,
    password,
    server: host,
    port,
    secure
  } = req.body

  let imap = new Imap({ user, password, host, port, tls: Boolean(secure) });

  imap.once('ready', function() {
    imap.openBox('INBOX', true, function(err, box) {
      if (err) throw err;

      // Generate an access token for future requests, and to store the emails
      const accessToken = generateAccessToken(user);

      const messageCount = box.messages.total;

      let emails = [];
      // Fetch all emails
      let f = imap.seq.fetch(`1:*`, { bodies: '' });
      f.on('message', function(msg, seqno) {
        msg.on('body', function(stream, info) {
          // Parse emails
          simpleParser(stream, (err, mail) => {
            // Buffer all emails
            emails.push(mail);

            // If all emails are loaded, send it back
            if (emails.length == messageCount) {
              // Store all the emails, which can only be accessed by an authenticated user
              allEmails[user] = emails;
              // Format the headers to be more readable
              const headers = emails.map(e =>
                e.headerLines.reduce((total, current) => ({...total, [current.key]: current.line}), {})
              );
              imap.end();
              res.send({accessToken, headers});
            }
          });
        });
      });
    });
  });

  imap.once('error', function(err) {
    console.log(err);
    res.status(400).send(err);
  });

  imap.connect();
}

/*
  Connect POP3 and store all emails under token
*/
module.exports.connectPOP3 = async function (req, res) {
  const {
    username: user,
    password,
    server: host,
    port,
    secure
  // } = req.body
} = req.body

  var client = await new POP3Client(port, host, { tlserrs: false, enabletls: Boolean(secure), debug: false });

  let emailCount = -1;
  let emails = [];
  let accessToken;

  function retrEmails() {
    // If all emails are loaded, send it back
    if (emails.length < emailCount) client.retr(emails.length + 1)
    else {
      client.quit()
      // Store all the emails, which can only be accessed by an authenticated user
      allEmails[user] = emails;
      // Format the headers to be more readable
      const headers = emails.map(e =>
        e.headerLines.reduce((total, current) => ({...total, [current.key]: current.line}), {})
      );
      res.send({accessToken, headers});
    }
  }

  client.on("error", function(err) {
    console.log(err);
  });

  client.on("connect", function() {
    console.log("CONNECT success");
    client.login(user, password);
  });

  client.on("login", function(status, rawdata) {
    if (status) {
      console.log("LOGIN/PASS success");
      // Generate an access token for future requests, and to store the emails
      accessToken = generateAccessToken(user);

      client.list();
    } else {
      console.log("LOGIN/PASS failed");
      client.quit();
    }
  });

  client.on("list", async function(status, msgcount, msgnumber, data, rawdata) {
    if (status === false) {
      console.log("LIST failed");
      client.quit();
    } else {
      console.log("LIST success with " + msgcount + " element(s)");
      emailCount = msgcount
      if (msgcount > 0) {
        client.retr(1);
      } else {
        client.quit();
      }
    }
  });

  client.on("retr", function(status, msgnumber, data, rawdata) {
    if (status === true) {
        simpleParser(rawdata, (err, mail) => {
          console.log("RETR success for msgnumber " + msgnumber);
          if (err) console.log(err)
          // Buffer all emails
          emails.push(mail)
          retrEmails();
        });
    } else {
        console.log("RETR failed for msgnumber " + msgnumber);
        client.quit();
    }
  });
}

/*
  Get email
*/
module.exports.getEmail = function (req, res) {
  const { user, query: { emailIndex } } = req;
  res.send(allEmails[user][emailIndex]);
}
