const API_BASE_URL = "https://my-portfolio-zani.onrender.com";

const $ = (id) => document.getElementById(id);

let pendingEmail = "";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed. Please try again.");
  }

  return data;
}

function showMessage(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function setFormBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = busy;
}

function setAuthenticatedView(user) {
  $("registerForm").closest(".auth-card").hidden = true;
  $("loginForm").closest(".auth-card").hidden = true;
  $("mfaCard").hidden = true;
  $("accountCard").hidden = false;

  showMessage("accountMessage", `Signed in as ${user.name} (${user.email}).`);
}

// 1. Register a new account.
$("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  setFormBusy(form, true);
  showMessage("registerMessage", "");

  const name = $("registerName").value.trim();
  const email = $("registerEmail").value.trim();
  const password = $("registerPassword").value;

  try {
    const data = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    showMessage(
      "registerMessage",
      data.message || "Account created. Please sign in.",
    );

    $("loginEmail").value = email;
    $("loginPassword").value = "";
  } catch (error) {
    showMessage("registerMessage", error.message);
  } finally {
    setFormBusy(form, false);
  }
});

// 2. Sign in and request an email MFA code.
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  setFormBusy(form, true);
  showMessage("loginMessage", "");

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  try {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    pendingEmail = data.email || email;

    $("mfaCard").hidden = false;
    $("mfaCode").value = "";

    showMessage(
      "loginMessage",
      data.message || "Check your email for the verification code.",
    );

    $("mfaCard").scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    $("mfaCode").focus();
  } catch (error) {
    showMessage("loginMessage", error.message);
  } finally {
    setFormBusy(form, false);
  }
});

// 3. Verify the six-digit code and store the JWT for this tab session.
$("mfaForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  setFormBusy(form, true);
  showMessage("mfaMessage", "");

  const code = $("mfaCode").value.trim();

  if (!pendingEmail) {
    showMessage("mfaMessage", "Please sign in again to request a new code.");
    setFormBusy(form, false);
    return;
  }

  try {
    const data = await apiRequest("/api/auth/verify-mfa", {
      method: "POST",
      body: JSON.stringify({
        email: pendingEmail,
        code,
      }),
    });

    if (!data.token || !data.user) {
      throw new Error("The server did not return a valid login session.");
    }

    sessionStorage.setItem("portfolio_token", data.token);
    pendingEmail = "";

    setAuthenticatedView(data.user);
    showMessage("mfaMessage", "");
  } catch (error) {
    showMessage("mfaMessage", error.message);
  } finally {
    setFormBusy(form, false);
  }
});

// 4. Check whether this tab already has a valid session.
async function restoreSession() {
  const token = sessionStorage.getItem("portfolio_token");
  if (!token) return;

  try {
    const data = await apiRequest("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setAuthenticatedView(data.user);
  } catch {
    sessionStorage.removeItem("portfolio_token");
  }
}

// 5. Log out and discard the client-side token.
$("logoutButton").addEventListener("click", async () => {
  const token = sessionStorage.getItem("portfolio_token");

  // Discard the token even if the network request fails.
  sessionStorage.removeItem("portfolio_token");
  pendingEmail = "";

  $("accountCard").hidden = true;
  $("registerForm").closest(".auth-card").hidden = false;
  $("loginForm").closest(".auth-card").hidden = false;
  $("mfaCard").hidden = true;

  showMessage("logoutMessage", "You have been logged out.");

  if (token) {
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // The local session is already cleared.
    }
  }
});

restoreSession();
