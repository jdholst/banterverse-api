var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

require('dotenv').config();

var conversationCoordinatorRouter = require('./routes/conversation-coordinator');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Custom logging middleware
app.use((req, res, next) => {
  console.log('Request:', req.method, req.originalUrl, 'Body:', req.body);

  // Intercepts the response to log the data
  const originalSend = res.send;
  res.send = function (data) {
    console.log('Response:', data);
    originalSend.call(this, data);
  };

  next();
});

// CORS middleware (adjust the options as needed for your deployment)
app.use(cors());

app.use('/conversation-coordinator/v1', conversationCoordinatorRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handling middleware
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: err,
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;