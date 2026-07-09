const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shop.controller.js');

router.get('/', shopController.getCatalog); // Trang chủ là danh sách SP
router.get('/checkout/:id', shopController.getCheckout); // Trang form mua hàng
router.post('/checkout', shopController.postCheckout);
router.get('/order-result', shopController.getResult);
router.get('/cart', shopController.getCart);

module.exports = router;