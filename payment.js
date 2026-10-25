/*
 * payment.js
 * MyProfile - Razorpay Checkout
 */

const PAYMENT_API = "https://myprofile-auth-api.onrender.com";

let paymentInProgress = false;

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Unable to load Razorpay Checkout."));

    document.head.appendChild(script);
  });
}

async function postPaymentRequest(path, payload) {
  const response = await fetch(`${PAYMENT_API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Payment request failed.");
  }

  return data;
}

async function payNow() {
  if (paymentInProgress) return;

  paymentInProgress = true;

  const button = document.getElementById("payNowBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Opening payment...";
  }

  try {
    // Load Razorpay Checkout.
    await loadRazorpayScript();

    // The server determines the amount and creates the order.
    const order = await postPaymentRequest("/api/payment/create-order", {});

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "MyProfile",
      description: "MyProfile payment",
      order_id: order.orderId,

      handler: async function (response) {
        try {
          if (button) button.textContent = "Verifying payment...";

          // Always verify the signature on the backend.
          const result = await postPaymentRequest("/api/payment/verify", {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (!result.verified) {
            throw new Error("Payment verification failed.");
          }

          alert(
            "Payment successful!\nPayment ID: " + response.razorpay_payment_id,
          );

          // Optional: update your UI after verified payment.
          document.dispatchEvent(
            new CustomEvent("payment-success", {
              detail: result,
            }),
          );
        } catch (error) {
          console.error("Payment verification error:", error);
          alert(
            error.message ||
              "Payment was received, but verification failed. Please contact support.",
          );
        } finally {
          paymentInProgress = false;

          if (button) {
            button.disabled = false;
            button.textContent = "Pay Now";
          }
        }
      },

      modal: {
        ondismiss: function () {
          paymentInProgress = false;

          if (button) {
            button.disabled = false;
            button.textContent = "Pay Now";
          }
        },
      },

      theme: {
        color: "#4169e1",
      },
    };

    const checkout = new window.Razorpay(options);

    checkout.on("payment.failed", function (response) {
      console.error("Razorpay payment failed:", response.error);

      alert(response.error.description || "Payment failed. Please try again.");

      paymentInProgress = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Pay Now";
      }
    });

    checkout.open();
  } catch (error) {
    console.error("Unable to start payment:", error);
    alert(error.message || "Unable to start payment. Please try again.");

    paymentInProgress = false;

    if (button) {
      button.disabled = false;
      button.textContent = "Pay Now";
    }
  }
}

// Make the function available to your HTML button.
window.payNow = payNow;
