const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

/* ==========================================================
   PASTE YOUR CREDENTIALS HERE
   ========================================================== */
const DARAJA_CONSUMER_KEY = "YOUR_CONSUMER_KEY_HERE";
const DARAJA_CONSUMER_SECRET = "YOUR_CONSUMER_SECRET_HERE";
const DARAJA_SHORTCODE = "YOUR_SHORTCODE_HERE"; // e.g. 174379

// Default Safaricom Sandbox Passkey
const DARAJA_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

// Placeholder Callback URL for Sandbox testing
const CALLBACK_URL = "https://example.com/api/callback";

// 1. Fetch OAuth Access Token
async function getAccessToken() {
    const auth = Buffer.from(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        { headers: { Authorization: `Basic ${auth}` } }
    );
    return response.data.access_token;
}

// 2. STK Push Route
app.post('/api/stkpush', async (req, res) => {
    try {
        const { phone, amount, walletType } = req.body;
        const accessToken = await getAccessToken();

        // Generate Timestamp (YYYYMMDDHHmmss)
        const date = new Date();
        const timestamp = date.getFullYear() +
            ("0" + (date.getMonth() + 1)).slice(-2) +
            ("0" + date.getDate()).slice(-2) +
            ("0" + date.getHours()).slice(-2) +
            ("0" + date.getMinutes()).slice(-2) +
            ("0" + date.getSeconds()).slice(-2);

        // Generate Base64 Password
        const password = Buffer.from(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`).toString('base64');

        // Format Phone Number to International Standard (2547XXXXXXXX)
        let formattedPhone = phone.toString().trim();
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "254" + formattedPhone.slice(1);
        } else if (formattedPhone.startsWith("+")) {
            formattedPhone = formattedPhone.slice(1);
        }

        const payload = {
            BusinessShortCode: DARAJA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.round(amount),
            PartyA: formattedPhone,
            PartyB: DARAJA_SHORTCODE,
            PhoneNumber: formattedPhone,
            CallBackURL: CALLBACK_URL,
            AccountReference: walletType === 'trading' ? 'TradingWallet' : 'GamingWallet',
            TransactionDesc: "Deposit"
        };

        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            payload,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error("STK Push Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ 
            success: false, 
            message: "Failed to process payment request.", 
            error: error.response ? error.response.data : error.message 
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
