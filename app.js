const { connectIMAP, connectPOP3, getEmail } = require('./utilities/email.js');
const { authenticateToken, generateAccessToken } = require('./utilities/security.js');

const express = require("express");
const app = express();
const cors = require('cors');
const dotenv = require('dotenv');

app.use(
  express.urlencoded({
    extended: true
  })
)
app.use(express.json())

// Get config vars
dotenv.config()

// Enable CORS for all requests
app.use(cors())

// This is required to bypass certificate authorization on local server
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

app.get('/', (req, res) => res.send('hi'));

// Connect to the server
app.post('/connect', async (req, res) => {
  console.log("Connecting to email server");
  const { serverType } = req.body;
  if (serverType == 'imap') connectIMAP(req, res);
  else connectPOP3(req, res)
});

// Get an email body
app.get('/email', authenticateToken, (req, res) => {
  getEmail(req, res);
})

const PORT = process.env.PORT || 8080;

// app.listen(PORT, console.log(`Server started on port ${PORT}`));
app.listen(PORT, console.log(`Server started on port ${PORT}`));
