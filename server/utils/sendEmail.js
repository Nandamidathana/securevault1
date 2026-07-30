import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOTP = async (email, otp) => {
  await transporter.sendMail({
    from: `"SecureVault" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "OTP Verification",
    html: `<h2>Your OTP is: ${otp}</h2>`,
  });
};