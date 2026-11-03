/**
 * ==============================================================================
 * Peketi Yaswanth - Portfolio Controller & Authentication Client
 * ==============================================================================
 */

// Primary production backend hosted on Render
const RENDER_BACKEND_URL = "https://my-portfolio-zani.onrender.com";

function resolveApiBaseUrl() {
  if (window.__PORTFOLIO_API_URL__) {
    return window.__PORTFOLIO_API_URL__.replace(/\/$/, "");
  }

  const hostname = window.location.hostname;
  const port = window.location.port;

  // 1. If served directly by the Node backend (port 3000) or Docker Nginx reverse proxy (port 80)
  if (
    (hostname === "localhost" || hostname === "127.0.0.1") &&
    (port === "3000" || port === "80" || port === "")
  ) {
    return "";
  }

  // 2. If loaded directly from the Render deployment URL
  if (hostname.endsWith(".onrender.com")) {
    return "";
  }

  // 3. For GitHub Pages (e.g. yaswanth-peketi.github.io), custom domains, file:// protocol,
  // or local live servers (e.g. :5500), connect directly to the Render backend.
  return RENDER_BACKEND_URL;
}

const API_BASE_URL = resolveApiBaseUrl();
window.API_BASE_URL = API_BASE_URL;

const $ = (id) => document.getElementById(id);

let pendingEmail = "";

/**
 * Universal JSON API fetch wrapper
 */
async function apiRequest(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
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

function showMessage(id, message, isError = false) {
  const element = $(id);
  if (element) {
    element.textContent = message;
    element.style.color = isError ? "var(--accent-rose)" : "var(--accent-secondary)";
  }
}

function setFormBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = busy;
  }
}

/**
 * Tab switching between Sign In and Create Account
 */
function switchAuthTab(tab) {
  const loginCard = $("loginCard");
  const registerCard = $("registerCard");
  const mfaCard = $("mfaCard");
  const tabLogin = $("tabLogin");
  const tabRegister = $("tabRegister");

  // Reset any visible messages
  showMessage("loginMessage", "");
  showMessage("registerMessage", "");
  showMessage("mfaMessage", "");

  if (mfaCard) mfaCard.hidden = true;

  if (tab === "register") {
    if (loginCard) loginCard.hidden = true;
    if (registerCard) registerCard.hidden = false;
    tabLogin.classList.remove("active");
    tabRegister.classList.add("active");
    const nameInput = $("registerName");
    if (nameInput) nameInput.focus();
  } else {
    if (registerCard) registerCard.hidden = true;
    if (loginCard) loginCard.hidden = false;
    tabRegister.classList.remove("active");
    tabLogin.classList.add("active");
    const emailInput = $("loginEmail");
    if (emailInput) emailInput.focus();
  }
}
window.switchAuthTab = switchAuthTab;

function cancelMfa() {
  $("mfaCard").hidden = true;
  $("loginCard").hidden = false;
  showMessage("mfaMessage", "");
}
window.cancelMfa = cancelMfa;

/**
 * View portfolio as Guest (Recruiters / Visitors)
 */
function continueAsGuest() {
  $("auth").hidden = true;
  $("portfolioContent").hidden = false;
  $("logoutButton").hidden = true;
  $("userPill").hidden = true;
  $("guestLoginBtn").hidden = false;
  window.scrollTo({ top: 0, behavior: "instant" });
}
window.continueAsGuest = continueAsGuest;

/**
 * Re-open Auth Screen for guests
 */
function openAuthModal() {
  $("auth").hidden = false;
  $("portfolioContent").hidden = true;
  switchAuthTab("login");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.openAuthModal = openAuthModal;

/**
 * Display Authenticated view
 */
function setAuthenticatedView(user) {
  $("auth").hidden = true;
  $("portfolioContent").hidden = false;
  $("logoutButton").hidden = false;
  if ($("guestLoginBtn")) $("guestLoginBtn").hidden = true;

  const userPill = $("userPill");
  const userInitial = $("userInitial");
  const userNameLabel = $("userNameLabel");

  if (userPill) userPill.hidden = false;
  if (user && user.name) {
    if (userNameLabel) userNameLabel.textContent = user.name;
    if (userInitial) userInitial.textContent = user.name.charAt(0).toUpperCase();
  } else if (user && user.email) {
    if (userNameLabel) userNameLabel.textContent = user.email.split("@")[0];
    if (userInitial) userInitial.textContent = user.email.charAt(0).toUpperCase();
  }

  window.scrollTo({ top: 0, behavior: "instant" });
}

// 1. REGISTER
$("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setFormBusy(form, true);
  showMessage("registerMessage", "Creating your account...");

  const name = $("registerName").value.trim();
  const email = $("registerEmail").value.trim();
  const password = $("registerPassword").value;

  try {
    const data = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    showMessage("registerMessage", data.message || "Account created! Redirecting to sign in...");
    $("loginEmail").value = email;
    $("loginPassword").value = "";

    setTimeout(() => {
      switchAuthTab("login");
      showMessage("loginMessage", "Account created. Enter your password to sign in.");
    }, 1200);
  } catch (error) {
    showMessage("registerMessage", error.message, true);
  } finally {
    setFormBusy(form, false);
  }
});

// 2. SIGN IN (Requests Email OTP)
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setFormBusy(form, true);
  showMessage("loginMessage", "Validating credentials and dispatching code...");

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  try {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    pendingEmail = data.email || email;

    // Transition smoothly to MFA card
    $("loginCard").hidden = true;
    $("mfaCard").hidden = false;
    $("mfaCode").value = "";

    showMessage(
      "mfaMessage",
      data.message || "Verification code sent! Please check your email.",
    );

    $("mfaCard").scrollIntoView({ behavior: "smooth", block: "center" });
    $("mfaCode").focus();
  } catch (error) {
    showMessage("loginMessage", error.message, true);
  } finally {
    setFormBusy(form, false);
  }
});

// 3. VERIFY MFA CODE
$("mfaForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setFormBusy(form, true);
  showMessage("mfaMessage", "Verifying passcode...");

  const code = $("mfaCode").value.trim();

  if (!pendingEmail) {
    showMessage("mfaMessage", "Session expired. Please sign in again.", true);
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
      throw new Error("Invalid session token returned by the server.");
    }

    sessionStorage.setItem("portfolio_token", data.token);
    pendingEmail = "";

    setAuthenticatedView(data.user);
    showMessage("mfaMessage", "");
  } catch (error) {
    showMessage("mfaMessage", error.message, true);
  } finally {
    setFormBusy(form, false);
  }
});

// 4. RESTORE ACTIVE SESSION ON LOAD
async function restoreSession() {
  const token = sessionStorage.getItem("portfolio_token");
  if (!token) {
    // First opening: Must ask to Sign In or Register!
    $("auth").hidden = false;
    $("portfolioContent").hidden = true;
    switchAuthTab("login");
    return;
  }

  try {
    const data = await apiRequest("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setAuthenticatedView(data.user);
  } catch {
    sessionStorage.removeItem("portfolio_token");
    $("auth").hidden = false;
    $("portfolioContent").hidden = true;
    switchAuthTab("login");
  }
}

// 5. LOGOUT
$("logoutButton").addEventListener("click", async () => {
  const token = sessionStorage.getItem("portfolio_token");

  sessionStorage.removeItem("portfolio_token");
  pendingEmail = "";

  // Return directly to the Sign In / Register view
  $("auth").hidden = false;
  $("portfolioContent").hidden = true;
  switchAuthTab("login");
  window.scrollTo({ top: 0, behavior: "smooth" });

  $("loginForm").reset();
  $("registerForm").reset();
  $("mfaForm").reset();

  if (token) {
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.warn("Logout request failed:", error.message);
    }
  }
});

// Initialize session
restoreSession();
