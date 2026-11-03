
import { supabase } from "./supabase.js";

/* =========================================================
   ELEMENTS
   ========================================================= */

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const message = document.getElementById("message");


/* =========================================================
   MESSAGE HELPER
   ========================================================= */

const showMessage = (text, type = "error") => {
  if (!message) return;

  message.textContent = text;
  message.className = `form-message ${type}`;
};


/* =========================================================
   DONATION ELIGIBILITY HELPERS
   ========================================================= */

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseLocalDate(value) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

// Add 3 calendar months without overflowing the date.
function addMonthsClamped(date, months) {
  const result = new Date(date);
  const originalDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(originalDay, lastDay));

  return result;
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

// Format a date as YYYY-MM-DD using local calendar values.
function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/* =========================================================
   DETERMINE ROLE
   ========================================================= */

function roleFromPage() {
  const query = new URLSearchParams(
    location.search
  ).get("role");

  if (query === "donor" || query === "patient") {
    return query;
  }

  const activeTab = document.querySelector(
    ".role-tab.active"
  );

  if (activeTab?.dataset.role === "donor") {
    return "donor";
  }

  if (activeTab?.dataset.role === "patient") {
    return "patient";
  }

  if (location.pathname.includes("donor-login")) {
    return "donor";
  }

  return "donor";
}


/* =========================================================
   FRIENDLY AUTH ERRORS
   ========================================================= */

function friendlyAuthError(error) {
  const messageText = String(
    error?.message || "Authentication failed."
  );

  if (/email.*not confirmed/i.test(messageText)) {
    return "Please confirm your email address first, then sign in.";
  }

  if (/invalid login credentials/i.test(messageText)) {
    return "Incorrect email or password.";
  }

  if (/already registered|already exists/i.test(messageText)) {
    return "An account with this email already exists. Try signing in instead.";
  }

  return messageText;
}


/* =========================================================
   LOGIN
   ========================================================= */

if (loginForm) {
  const hiddenRole = document.getElementById("loginRole");
  const pageRole = roleFromPage();

  if (hiddenRole) {
    hiddenRole.value = pageRole;
  }

  // Role tabs
  document.querySelectorAll(".role-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.dataset.role;

      if (!role) return;

      document.querySelectorAll(".role-tab").forEach((tab) => {
        tab.classList.toggle("active", tab === button);
      });

      if (hiddenRole) {
        hiddenRole.value = role;
      }

      const signupLink = document.getElementById("signupLink");

      if (signupLink) {
        signupLink.href = `signup.html?role=${role}`;
        signupLink.textContent = `Create ${role} account`;
      }
    });
  });

  // Login submit
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    showMessage("Signing in...", "info");

    const email = document
      .getElementById("identifier")
      ?.value.trim().toLowerCase();

    const password = document
      .getElementById("password")
      ?.value;

    const expectedRole = hiddenRole?.value || pageRole;

    if (!email?.includes("@")) {
      showMessage("Please use your email address.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showMessage(friendlyAuthError(error));
      return;
    }

    // Load profile
    const {
      data: profile,
      error: profileError
    } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();

      showMessage(
        "Your account profile could not be loaded. Check the Supabase profile trigger."
      );

      return;
    }

    if (profile.status !== "active") {
      await supabase.auth.signOut();

      showMessage("This account is not active.");
      return;
    }

    if (profile.role !== expectedRole) {
      await supabase.auth.signOut();

      showMessage(
        `This account is registered as ${profile.role}. Please use the ${profile.role} login.`
      );

      return;
    }

    // Redirect according to role
    if (expectedRole === "donor") {
      location.href = "donor-dashboard.html";
    } else {
      location.href = "patient-dashboard.html";
    }
  });
}


/* =========================================================
   SIGNUP
   ========================================================= */

if (signupForm) {
  const role = roleFromPage();

  const roleLabel = document.getElementById("roleLabel");
  const donorFields = document.getElementById("donorFields");
  const bloodInfoFields = document.getElementById("bloodInfoFields");

  const lastDonationInput = document.getElementById(
    "lastDonationDate"
  );

  const eligibilityMessage = document.getElementById(
    "donationEligibilityMessage"
  );


  /* ---------------------------------------------------------
     UPDATE HEADING
     --------------------------------------------------------- */

  if (roleLabel) {
    roleLabel.textContent = `${role.toUpperCase()} ACCOUNT`;
  }


  /* ---------------------------------------------------------
     DONOR-ONLY FIELD
     --------------------------------------------------------- */

  if (donorFields) {
    donorFields.classList.toggle("hidden", role !== "donor");
  }


  /* ---------------------------------------------------------
     BLOOD GROUP + CITY
     --------------------------------------------------------- */

  if (bloodInfoFields) {
    bloodInfoFields.classList.remove("hidden");
  }


  /* =========================================================
     AUTOMATIC DONATION ELIGIBILITY CHECK
     ========================================================= */

  function checkDonationEligibility() {
    if (!lastDonationInput || !eligibilityMessage) {
      return null;
    }

    const selectedValue = lastDonationInput.value;

    if (!selectedValue) {
      eligibilityMessage.textContent = "";
      return null;
    }

    const lastDonation = parseLocalDate(selectedValue);
    const today = getToday();

    if (!lastDonation) {
      eligibilityMessage.style.color = "#ff5555";
      eligibilityMessage.textContent =
        "Please enter a valid donation date.";

      return { valid: false };
    }

    if (lastDonation > today) {
      eligibilityMessage.style.color = "#ff5555";
      eligibilityMessage.textContent =
        "⚠️ Last donation date cannot be in the future.";

      return { valid: false };
    }

    // Calculate 3 months after the last donation.
    const eligibleDate = addMonthsClamped(lastDonation, 3);

    if (today < eligibleDate) {
      eligibilityMessage.style.color = "#ff5555";

      eligibilityMessage.textContent =
        `⚠️ You are not eligible to donate blood yet. ` +
        `You can donate again from ${formatDate(eligibleDate)}.`;

      return {
        valid: true,
        eligible: false,
        eligibleDate
      };
    }

    eligibilityMessage.style.color = "#22c55e";

    eligibilityMessage.textContent =
      "✅ You are eligible to donate blood again!";

    return {
      valid: true,
      eligible: true,
      eligibleDate
    };
  }


  /* ---------------------------------------------------------
     DATE INPUT SETTINGS
     --------------------------------------------------------- */

  if (lastDonationInput) {
    lastDonationInput.max = toDateInputValue(getToday());

    lastDonationInput.addEventListener(
      "change",
      checkDonationEligibility
    );
  }


  /* =========================================================
     SIGNUP SUBMIT
     ========================================================= */

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    showMessage("Creating your account...", "info");


    /* -------------------------------------------------------
       BASIC INFORMATION
       ------------------------------------------------------- */

    const fullName = document
      .getElementById("fullName")
      .value.trim();

    const email = document
      .getElementById("email")
      .value.trim()
      .toLowerCase();

    const mobile = document
      .getElementById("mobile")
      .value.trim();

    const password = document
      .getElementById("password")
      .value;

    const confirmPassword = document
      .getElementById("confirmPassword")
      .value;


    /* -------------------------------------------------------
       BLOOD INFORMATION
       ------------------------------------------------------- */

    const bloodGroup = document
      .getElementById("bloodGroup")
      ?.value || "";

    const city = document
      .getElementById("city")
      ?.value.trim() || "";


    /* -------------------------------------------------------
       DONOR INFORMATION
       ------------------------------------------------------- */

    const lastDonationDate = role === "donor"
      ? lastDonationInput?.value || ""
      : "";


    /* =======================================================
       VALIDATION
       ======================================================= */

    if (fullName.length < 2) {
      showMessage("Please enter your full name.");
      return;
    }

    if (!email.includes("@")) {
      showMessage("Please enter a valid email address.");
      return;
    }

    if (!/^\+?[0-9\s-]{10,15}$/.test(mobile)) {
      showMessage("Please enter a valid mobile number.");
      return;
    }

    if (!bloodGroup) {
      showMessage("Please select your blood group.");
      return;
    }

    if (!city) {
      showMessage("Please enter your city.");
      return;
    }

    if (password.length < 8) {
      showMessage("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.");
      return;
    }


    /* -------------------------------------------------------
       DONATION DATE VALIDATION
       ------------------------------------------------------- */

    let eligibility = null;

    if (role === "donor" && lastDonationDate) {
      eligibility = checkDonationEligibility();

      if (!eligibility || !eligibility.valid) {
        showMessage(
          "Please correct your last donation date before continuing."
        );

        return;
      }
    }


    /* =======================================================
       USER METADATA
       ======================================================= */

    const metadata = {
      full_name: fullName,
      mobile: mobile,
      role: role,
      blood_group: bloodGroup,
      city: city
    };

    if (role === "donor") {
      metadata.last_donation_date = lastDonationDate || null;

      if (eligibility) {
        metadata.next_eligible_donation_date =
          toDateInputValue(eligibility.eligibleDate);

        metadata.donation_eligibility_status =
          eligibility.eligible
            ? "eligible"
            : "temporarily_ineligible";
      } else {
        metadata.next_eligible_donation_date = null;
        metadata.donation_eligibility_status = "eligible";
      }
    }


    /* =======================================================
       CREATE SUPABASE USER
       ======================================================= */

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });

    if (error) {
      showMessage(friendlyAuthError(error));
      return;
    }

    if (!data?.user) {
      showMessage(
        "Supabase did not return a user. Please try again."
      );

      return;
    }


    /* =======================================================
       SUCCESS
       ======================================================= */

    signupForm.reset();

    if (donorFields) {
      donorFields.classList.toggle("hidden", role !== "donor");
    }

    if (eligibilityMessage) {
      eligibilityMessage.textContent = "";
    }

    showMessage(
      "Account created successfully. Check your email, confirm it if required, then sign in.",
      "success"
    );
  });
}
