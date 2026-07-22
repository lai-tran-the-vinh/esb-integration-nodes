const axios = require('axios');

const KEYCLOAK_TOKEN_URL = process.env.KEYCLOAK_TOKEN_URL || 'http://localhost:8080/realms/WSO2-Realm/protocol/openid-connect/token';
const CLIENT_ID = process.env.CLIENT_ID || 'wso2-client';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'QWE3InQrvUYb7MTCZXL2aRhHCR894zTL';
const WSO2_BASE_URL = process.env.WSO2_BASE_URL || 'http://localhost:8290';

let cachedToken = null;
let tokenExpiryTime = 0;

const getAccessToken = async () => {
    const now = Date.now();
    // Trừ hao 15 giây (15000 ms) để bù độ trễ mạng
    if (cachedToken && now < tokenExpiryTime - 15000) {
        return cachedToken;
    }

    try {
        const params = new URLSearchParams();
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        params.append('grant_type', 'client_credentials');

        const tokenRes = await axios.post(KEYCLOAK_TOKEN_URL, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        cachedToken = tokenRes.data.access_token;
        // expires_in là số giây -> chuyển sang ms
        tokenExpiryTime = now + (tokenRes.data.expires_in * 1000);

        return cachedToken;
    } catch (error) {
        console.error("Lỗi khi lấy Access Token từ Keycloak:", error.message);
        throw error;
    }
};

const callWSO2 = async (endpoint, method = 'POST', data = null) => {
    let token = await getAccessToken();
    const url = `${WSO2_BASE_URL}${endpoint}`;
    
    try {
        const response = await axios({
            method,
            url,
            data,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response;
    } catch (error) {
        // Tự động thử lại đúng 1 lần (Automatic 1-Time Retry) nếu 401
        if (error.response && error.response.status === 401) {
            console.log("Token hết hạn hoặc bị thu hồi (401). Đang xin token mới toanh từ Keycloak...");
            cachedToken = null; // Xóa token cache
            token = await getAccessToken();
            
            // Gửi lại request duy nhất 1 lần
            const retryResponse = await axios({
                method,
                url,
                data,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return retryResponse;
        }
        throw error;
    }
};

module.exports = {
    getAccessToken,
    callWSO2
};
