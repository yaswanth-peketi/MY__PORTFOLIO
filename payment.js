/*
 * payment.js
 * MyProfile - Razorpay Checkout
 */

const PAYMENT_API = "https://my-portfolio-zani.onrender.com";

let paymentInProgress = false;

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("Unable to load Razorpay Checkout."));

    document.head.appendChild(script);
  });
}

async function postPaymentRequest(path, payload) {
  const token = sessionStorage.getItem("portfolio_token");

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${PAYMENT_API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Payment request failed.");
  }

  return data;
}

function resetAdvanceButton(button) {
  if (!button) return;

  button.disabled = false;
  button.innerHTML =
    '<i class="fa-solid fa-hand-holding-dollar"></i> Give Advance';
}

async function payNow() {
  if (paymentInProgress) return;

  const button = document.getElementById("payNowBtn");
  const token = sessionStorage.getItem("portfolio_token");

  if (!token) {
    alert("Please log in before making an advance payment.");
    return;
  }

  paymentInProgress = true;

  if (button) {
    button.disabled = true;
    button.textContent = "Opening payment...";
  }

  try {
    await loadRazorpayScript();

    // Keep these paths consistent with your existing server.js.
    const order = await postPaymentRequest("/api/payment/create-order", {});

    if (!order.keyId || !order.orderId || !order.amount) {
      throw new Error("Incomplete payment-order details received.");
    }

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "MyProfile",
      description: "Project advance payment",
      order_id: order.orderId,

      handler: async function (response) {
        try {
          if (button) {
            button.textContent = "Verifying payment...";
          }

          const result = await postPaymentRequest("/api/payment/verify", {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (result.verified !== true && result.success !== true) {
            throw new Error(result.error || "Payment verification failed.");
          }

          alert(
            "Advance payment successful!\nPayment ID: " +
              response.razorpay_payment_id,
          );

          document.dispatchEvent(
            new CustomEvent("payment-success", {
              detail: result,
            }),
          );
        } catch (error) {
          console.error("Payment verification error:", error);

          alert(
            error.message ||
              "Payment verification failed. Please contact support.",
          );
        } finally {
          paymentInProgress = false;
          resetAdvanceButton(button);
        }
      },

      modal: {
        ondismiss: function () {
          paymentInProgress = false;
          resetAdvanceButton(button);
        },
      },

      theme: {
        color: "#238636",
      },
    };

    const checkout = new window.Razorpay(options);

    checkout.on("payment.failed", function (response) {
      console.error("Razorpay payment failed:", response.error);

      alert(response.error?.description || "Payment failed. Please try again.");

      paymentInProgress = false;
      resetAdvanceButton(button);
    });

    checkout.open();
  } catch (error) {
    console.error("Unable to start payment:", error);

    alert(error.message || "Unable to start payment. Please try again.");

    paymentInProgress = false;
    resetAdvanceButton(button);
  }
}

// Make the function available to the HTML button.
window.payNow = payNow;
