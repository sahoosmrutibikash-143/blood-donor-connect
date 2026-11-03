import { supabase } from "./supabase.js";

const form = document.getElementById("adminLoginForm");
const message = document.getElementById("adminMessage");

function showMessage(text, type = "error") {
  if (!message) return;
  message.textContent = text;
  message.className = `form-message ${type}`;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("adminEmail")?.value.trim().toLowerCase();
  const password = document.getElementById("adminPassword")?.value;
  if (!email || !password) return showMessage("Enter your administrator email and password.");

  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  showMessage("Verifying administrator account...", "info");

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin" || profile.status !== "active") {
      await supabase.auth.signOut();
      throw new Error("This account is not an active administrator.");
    }

    showMessage("Access verified. Opening admin dashboard...", "success");
    location.href = "admin-dashboard.html";
  } catch (error) {
    showMessage(error.message || "Unable to sign in. Please try again.");
  } finally {
    if (button) button.disabled = false;
  }
});
