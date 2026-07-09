const express = require('express');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); // Đọc form data
app.use(express.json());

app.use('/', require('./routes/index.route.js'));

app.listen(3000, () => {
    console.log('Web Mua Hàng MVC đang chạy tại: http://localhost:3000');
});