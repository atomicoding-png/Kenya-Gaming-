const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

/* ==========================================================
   SAFARICOM DARAJA CONFIG (Environment Variables)
   ========================================================== */
const MPESA_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || "174379";
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const CALLBACK_URL = "https://example.com/api/callback";

// Get OAuth Token from Safaricom
async function getMpesaToken() {
    const auth = Buffer.from(`${MPESA_KEY}:${MPESA_SECRET}`).toString('base64');
    const response = await axios.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        { headers: { Authorization: `Basic ${auth}` } }
    );
    return response.data.access_token;
}

// Health Check Endpoint (For testing Render)
app.get('/', (req, res) => {
    res.send('M-Pesa Payment Server is Active');
});

// STK Push Route
app.post('/api/pay/mpesa', async (req, res) => {
    try {
        const { phone, amount, walletType } = req.body;

        if (!phone || !amount) {
            return res.status(400).json({ success: false, error: "Phone number and amount are required." });
        }

        const token = await getMpesaToken();

        // Format Timestamp: YYYYMMDDHHmmss
        const date = new Date();
        const timestamp = date.getFullYear() +
            ("0" + (date.getMonth() + 1)).slice(-2) +
            ("0" + date.getDate()).slice(-2) +
            ("0" + date.getHours()).slice(-2) +
            ("0" + date.getMinutes()).slice(-2) +
            ("0" + date.getSeconds()).slice(-2);

        // Password: Base64(Shortcode + Passkey + Timestamp)
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');

        // Format phone number to 254XXXXXXXXX
        let formattedPhone = phone.toString().trim();
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "254" + formattedPhone.slice(1);
        } else if (formattedPhone.startsWith("+")) {
            formattedPhone = formattedPhone.slice(1);
        }

        const payload = {
            BusinessShortCode: MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.round(amount),
            PartyA: formattedPhone,
            PartyB: MPESA_SHORTCODE,
            PhoneNumber: formattedPhone,
            CallBackURL: CALLBACK_URL,
            AccountReference: walletType === 'trading' ? 'TradingWallet' : 'GamingWallet',
            TransactionDesc: "Deposit"
        };

        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error("M-Pesa STK Error:", error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            error: error.response ? error.response.data : error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
