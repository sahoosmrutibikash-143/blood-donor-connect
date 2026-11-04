
import { supabase } from "./supabase.js";

/* =========================================================
   ELEMENTS
   ========================================================= */

const resetRequestForm = document.getElementById("resetRequestForm");
const newPasswordForm = document.getElementById("newPasswordForm");

const resetEmail = document.getElementById("resetEmail");
const newPassword = document.getElementById("newPassword");
const confirmNewPassword = document.getElementById("confirmNewPassword");

const resetMessage = document.getElementById("resetMessage");


/* =========================================================
   MESSAGE HELPER
   ========================================================= */

function showMessage(text, type = "error") {
  if (!resetMessage) return;

  resetMessage.textContent = text;
  resetMessage.className = `form-message ${type}`;
}


/* =========================================================
   PASSWORD RESET REQUEST
   ========================================================= */

if (resetRequestForm) {
  resetRequestForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = resetEmail.value.trim().toLowerCase();

    if (!email.includes("@")) {
      showMessage("Please enter a valid email address.");
      return;
    }

    showMessage("Sending password reset link...", "info");

    try {
      const redirectUrl = new URL(
        "../reset-password.html",
        import.meta.url
      ).href;

      const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: redirectUrl
        }
      );

      if (error) {
        showMessage(error.message);
        return;
      }

      showMessage(
        "If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.",
        "success"
      );

    } catch (error) {
      console.error("Password reset request error:", error);
      showMessage("Something went wrong. Please try again.");
    }
  });
}


/* =========================================================
   SHOW NEW PASSWORD FORM AFTER RECOVERY LINK
   ========================================================= */

function showNewPasswordForm() {
  if (resetRequestForm) {
    resetRequestForm.hidden = true;
  }

  if (newPasswordForm) {
    newPasswordForm.hidden = false;
  }

  showMessage(
    "Enter your new password below.",
    "success"
  );
}


/* =========================================================
   DETECT PASSWORD RECOVERY SESSION
   ========================================================= */

const { data: authListener } = supabase.auth.onAuthStateChange(
  (event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      showNewPasswordForm();
    }
  }
);


/* =========================================================
   UPDATE PASSWORD
   ========================================================= */

if (newPasswordForm) {
  newPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = newPassword.value;
    const confirmPassword = confirmNewPassword.value;

    if (password.length < 8) {
      showMessage("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.");
      return;
    }

    showMessage("Updating your password...", "info");

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        showMessage(error.message);
        return;
      }

      const role = data.user?.user_metadata?.role;

      showMessage(
        "Your password has been updated successfully!",
        "success"
      );

      newPasswordForm.reset();

      await supabase.auth.signOut();

      setTimeout(() => {
        if (role === "patient") {
          window.location.href = "patient-login.html";
        } else if (role === "donor") {
          window.location.href = "donor-login.html";
        } else {
          window.location.href = "index.html";
        }
      }, 1800);

    } catch (error) {
      console.error("Password update error:", error);
      showMessage("Unable to update password. Please try again.");
    }
  });
}
