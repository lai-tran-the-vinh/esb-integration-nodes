const wso2Service = require('../services/wso2.service');
const fs = require('fs');
const path = require('path');
const FILE_PATH = path.join(__dirname, '../products.json');

let productsCache = [];

// Đọc dữ liệu từ file một lần khi khởi động (bất đồng bộ)
(async () => {
    try {
        if (fs.existsSync(FILE_PATH)) {
            const data = await fs.promises.readFile(FILE_PATH, 'utf-8');
            productsCache = JSON.parse(data || '[]');
        }
    } catch (err) {
        console.error("Lỗi nạp cache ban đầu:", err.message);
    }
})();
// HÀM ĐỒNG BỘ: Kéo dữ liệu từ WSO2 về lưu thành file JSON (Đã tối ưu bất đồng bộ)
const syncProductsFromWSO2 = async () => {
    try {
        console.log("--> [Sync Task] Đang cào sản phẩm mới từ WSO2...");
        const response = await wso2Service.callWSO2('/api/v1/products', 'GET');

        if (response.data && Array.isArray(response.data)) {
            // Cập nhật RAM ngay lập tức
            productsCache = response.data;
            
            // Lưu backup bất đồng bộ, không làm nghẽn Event Loop
            await fs.promises.writeFile(FILE_PATH, JSON.stringify(response.data, null, 2), 'utf-8');
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
        // Lấy từ biến RAM, không đọc ổ cứng đồng bộ
        const products = productsCache;
        res.render('catalog.view.ejs', { products });
    } catch (error) {
        console.error("Lỗi hiển thị sản phẩm:", error.message);
        res.status(500).send("Lỗi hệ thống hiển thị sản phẩm!");
    }
};

// 2. Bấm "Mua ngay" -> Nhảy vào trang thanh toán đúng món đó
exports.getCheckout = (req, res) => {
    try {
        const prodId = parseInt(req.params.id);
        const product = productsCache.find(p => p.id === prodId); // So sánh nghiêm ngặt ===

        // Null/Undefined Safety: Tránh ghi đè lên undefined làm sập server
        if (!product) {
            return res.status(404).send("Sản phẩm không tồn tại!");
        }

        // Clone đối tượng để không gán trực tiếp thuộc tính qty vào bộ nhớ đệm
        const productForCheckout = { ...product, qty: 1 };
        res.render('index.view.ejs', { product: productForCheckout });
    } catch (error) {
        console.error("Lỗi trang thanh toán:", error.message);
        res.status(500).send("Lỗi hệ thống tại trang thanh toán!");
    }
};

// 3. Khách bấm thanh toán -> Xin Token Keycloak -> Gọi sang WSO2
exports.postCheckout = async (req, res) => {
    try {
        const prodId = parseInt(req.body.product_id);
        const product = productsCache.find(p => p.id === prodId);
        
        if (!product) {
            return res.status(404).send("Sản phẩm không tồn tại để thanh toán!");
        }

        const quantity = parseInt(req.body.quantity || 1);
        const totalAmount = product.price * quantity;

        const payload = {
            customer_name: req.body.customer_name,
            customer_email: req.body.customer_email,
            status: "pending",
            amount: totalAmount.toString(),
            products: [{ product_id: product.id, quantity }]
        };

        const response = await wso2Service.callWSO2('/api/v1/orders', 'POST', payload);

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
        const response = await wso2Service.callWSO2('/api/v1/orders/track', 'POST', req.body);

        res.json(response.data);
    } catch (error) {
        console.error("Lỗi tra cứu đơn hàng:", error.response ? error.response.data : error.message);
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { error: 'Không thể tra cứu đơn hàng' });
    }
};