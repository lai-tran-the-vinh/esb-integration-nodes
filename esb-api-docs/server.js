const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();

// Tải dữ liệu từ tệp YAML
const swaggerDocument = YAML.load('./swagger.yaml');

// Cấu hình cổng giao tiếp tài liệu
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Trục ESB API Documentation đang chạy tại: http://localhost:${PORT}/api-docs`);
});