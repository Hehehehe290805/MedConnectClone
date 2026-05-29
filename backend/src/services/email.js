import { BrevoClient, BrevoEnvironment } from "@getbrevo/brevo";

function getFromAddress() {
    if (!process.env.EMAIL_FROM) throw new Error("EMAIL_FROM environment variable is not set");
    return process.env.EMAIL_FROM;
}

export async function sendVerificationCode(email, code) {
    try {
        if (!process.env.BREVO_API_KEY) throw new Error("BREVO_API_KEY environment variable is not set");
        
        const client = new BrevoClient({
            apiKey: process.env.BREVO_API_KEY,
            environment: BrevoEnvironment.Production,
        });
    
        const result = await client.transactionalEmails.sendTransacEmail({
            sender: { email: getFromAddress() },
            to: [{ email }],
            subject: "MedConnect Verification Code",
            htmlContent: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                    <h2>MedConnect Verification</h2>
                    <p>Your verification code is:</p>
                    <h1 style="letter-spacing: 8px; font-size: 36px;">${code}</h1>
                    <p>This code expires in <strong>10 minutes</strong>.</p>
                    <p>If you did not request this, please ignore this email.</p>
                </div>
            `,
                    });
        console.log("[Brevo] Send result:", JSON.stringify(result));
    } catch (err) {
        console.error("[Brevo] Send error:", err);
        throw err;
    }
}``