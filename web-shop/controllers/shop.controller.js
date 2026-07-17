const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FILE_PATH = path.join(__dirname, '../products.json');



// HÀM ĐỒNG BỘ: Kéo dữ liệu từ WSO2 về lưu thành file JSON
const syncProductsFromWSO2 = async () => {
    try {
        console.log("--> [Sync Task] Đang cào sản phẩm mới từ WSO2...");
        const response = await axios.get('http://localhost:8290/api/v1/products');

        if (response.data && Array.isArray(response.data)) {
            fs.writeFileSync(FILE_PATH, JSON.stringify(response.data, null, 2), 'utf-8');
            console.log("--> [Sync Task] Đồng bộ sản phẩm vào file thành công!");
        }
    } catch (error) {
        console.error("--> [Sync Task] Thất bại:", error.message);
    }
};

// Chạy kích hoạt đồng bộ ngay khi Node.js khởi động
syncProductsFromWSO2();

// Cứ mỗi 10 phút (600000ms) tự động chạy lại ngầm
setInterval(syncProductsFromWSO2, 600000);

// 1. Trang chủ: Hiện lưới sản phẩm kiểu Shopee
exports.getCatalog = (req, res) => {
    try {
        // Nếu file chưa tồn tại (chưa kịp sync lần nào), tạo mảng rỗng để đỡ crash
        if (!fs.existsSync(FILE_PATH)) {
            fs.writeFileSync(FILE_PATH, '[]', 'utf-8');
        }

        // Đọc dữ liệu từ file "Local DB"
        const fileData = fs.readFileSync(FILE_PATH, 'utf-8');
        const products = JSON.parse(fileData || '[]');

        res.render('catalog.view.ejs', { products });
    } catch (error) {
        console.error("Lỗi đọc file sản phẩm:", error.message);
        res.status(500).send("Lỗi hệ thống hiển thị sản phẩm!");
    }
};

// 2. Bấm "Mua ngay" -> Nhảy vào trang thanh toán đúng món đó
exports.getCheckout = (req, res) => {
    // Đọc lại file JSON để có dữ liệu sản phẩm
    const fileData = fs.readFileSync(FILE_PATH, 'utf-8');
    const products = JSON.parse(fileData || '[]');

    const prodId = parseInt(req.params.id);
    const product = products.find(p => p.id == prodId) || products[0]; // Dùng == để so sánh an toàn hơn

    product.qty = 1;
    res.render('index.view.ejs', { product });
};

// 3. Khách bấm thanh toán -> Xin Token Keycloak -> Gọi sang WSO2
exports.postCheckout = async (req, res) => {
    try {
        const fileData = fs.readFileSync(FILE_PATH, 'utf-8');
        const products = JSON.parse(fileData || '[]');

        // CÁCH CHUẨN NHẤT: Dùng URLSearchParams (không dùng thư viện ngoài)
        const params = new URLSearchParams();
        params.append('client_id', 'wso2-client');
        params.append('client_secret', 'QWE3InQrvUYb7MTCZXL2aRhHCR894zTL');
        params.append('grant_type', 'password');
        params.append('username', 'testuser2');
        params.append('password', 'test123');

        const tokenRes = await axios.post(
            'http://localhost:8080/realms/WSO2-Realm/protocol/openid-connect/token',
            params,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenRes.data.access_token;

        const prodId = parseInt(req.body.product_id);
        const product = products.find(p => p.id === prodId) || products[0];
        const totalAmount = product.price * parseInt(req.body.quantity || 1);

        const payload = {
            customer_name: req.body.customer_name,
            customer_email: req.body.customer_email,
            status: "pending",
            amount: totalAmount.toString(),
            products: [{ product_id: product.id, quantity: parseInt(req.body.quantity || 1) }]
        };

        const response = await axios.post(
            'http://localhost:8290/api/v1/orders',
            payload,
            { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );

        if (response.data && response.data.payment_url) {
            return res.redirect(response.data.payment_url);
        }
        res.status(500).send("WSO2 không trả về link thanh toán!");
    } catch (error) {
        console.error("LỖI CỰC ĐOAN:", error.response ? error.response.data : error.message);
        res.status(500).send("Lỗi xử lý đơn hàng!");
    }
};

exports.getCart = (req, res) => {
    res.render('cart.view.ejs'); // Chỉ cần gọi view, dữ liệu giỏ JS tự đọc
};

exports.getResult = (req, res) => {
    const { orderId, status } = req.query;
    res.render('result.view.ejs', { orderId, status });
};

exports.getTrackOrder = (req, res) => {
    res.render('track-order.view.ejs');
};

exports.postTrackOrder = async (req, res) => {
    try {
        // Lấy token từ Keycloak
        const params = new URLSearchParams();
        params.append('client_id', 'wso2-client');
        params.append('client_secret', 'QWE3InQrvUYb7MTCZXL2aRhHCR894zTL');
        params.append('grant_type', 'password');
        params.append('username', 'testuser2');
        params.append('password', 'test123');

        const tokenRes = await axios.post(
            'http://localhost:8080/realms/WSO2-Realm/protocol/openid-connect/token',
            params,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenRes.data.access_token;

        const response = await axios.post(
            'http://localhost:8290/api/v1/orders/track',
            req.body,
            { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );

        res.json(response.data);
    } catch (error) {
        console.error("Lỗi tra cứu đơn hàng:", error.response ? error.response.data : error.message);
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: 'Không thể tra cứu đơn hàng' });
    }
};