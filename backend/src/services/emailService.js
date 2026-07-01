const nodemailer = require('nodemailer');

// Creates a transport if SMTP is configured, else falls back to mock transport logging to console
function getTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    } else {
        // Fallback logger
        return {
            sendMail: async (mailOptions) => {
                console.log('\n--- MOCK EMAIL SENT ---');
                console.log(`From: ${mailOptions.from}`);
                console.log(`To: ${mailOptions.to}`);
                console.log(`Subject: ${mailOptions.subject}`);
                console.log(`Text:\n${mailOptions.text}`);
                console.log('-----------------------\n');
                return { messageId: 'mock-id' };
            }
        };
    }
}

const sendEmail = async (to, subject, text) => {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || 'noreply@flatmatefinder.com';
    
    try {
        await transporter.sendMail({
            from,
            to,
            subject,
            text
        });
    } catch (err) {
        console.error('Error sending email:', err);
    }
};

module.exports = { sendEmail };
