import { supabase } from "./supabase.js";


// ========================================
// ELEMENTS
// ========================================

const donorName =
  document.getElementById("donorName");

const fullName =
  document.getElementById("fullName");

const bloodGroup =
  document.getElementById("bloodGroup");

const mobile =
  document.getElementById("mobile");

const city =
  document.getElementById("city");

const lastDonation =
  document.getElementById("lastDonation");

const accountStatus =
  document.getElementById("accountStatus");


const availabilityText =
  document.getElementById("availabilityText");

const availabilityToggle =
  document.getElementById("availabilityToggle");

// NEW: availability indicator
const availabilityIcon =
  document.getElementById("availabilityIcon");


const emergencyText =
  document.getElementById("emergencyText");

const emergencyToggle =
  document.getElementById("emergencyToggle");


const logoutButton =
  document.getElementById("logout");

const pageMessage =
  document.getElementById("pageMessage");


// ========================================
// PROFILE MODAL
// ========================================

const profileModal =
  document.getElementById("profileModal");

const editProfileBtn =
  document.getElementById("editProfileBtn");

const closeModal =
  document.getElementById("closeModal");

const profileForm =
  document.getElementById("profileForm");

const editBloodGroup =
  document.getElementById("editBloodGroup");

const editCity =
  document.getElementById("editCity");

const editLastDonation =
  document.getElementById("editLastDonation");

const profileMessage =
  document.getElementById("profileMessage");


// ========================================
// VARIABLES
// ========================================

let currentUser = null;
let donorProfile = null;


// ========================================
// MESSAGE FUNCTION
// ========================================

function showMessage(
  element,
  text,
  type = "error"
) {

  if (!element) return;

  element.textContent = text;

  element.className =
    `form-message ${type}`;

}


// ========================================
// MODAL CONTROL
// ========================================

function openProfileModal() {

  if (!profileModal) return;

  profileModal.classList.remove(
    "hidden"
  );

  profileModal.setAttribute(
    "aria-hidden",
    "false"
  );

  profileModal.style.display = "flex";

  document.body.style.overflow =
    "hidden";

}


function closeProfileModal() {

  if (!profileModal) return;

  profileModal.classList.add(
    "hidden"
  );

  profileModal.setAttribute(
    "aria-hidden",
    "true"
  );

  profileModal.style.display =
    "none";

  document.body.style.overflow =
    "";

}


// ========================================
// LOAD DASHBOARD
// ========================================

async function loadDashboard() {

  try {

    // ------------------------------------
    // GET CURRENT SESSION
    // ------------------------------------

    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();


    if (
      sessionError ||
      !session
    ) {

      location.href =
        "index.html";

      return;

    }


    currentUser =
      session.user;


    // ------------------------------------
    // LOAD MAIN PROFILE
    // ------------------------------------

    const {
      data: profile,
      error: profileError
    } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, mobile, role, status"
      )
      .eq(
        "id",
        currentUser.id
      )
      .single();


    if (profileError) {

      console.error(
        "PROFILE ERROR:",
        profileError
      );

      showMessage(
        pageMessage,
        "Could not load your account profile."
      );

      return;

    }


    // ------------------------------------
    // CHECK ACCOUNT
    // ------------------------------------

    if (
      !profile ||
      profile.status !== "active" ||
      profile.role !== "donor"
    ) {

      await supabase.auth.signOut();

      location.href =
        "index.html";

      return;

    }


    // ------------------------------------
    // SHOW USER INFORMATION
    // ------------------------------------

    if (donorName) {

      donorName.textContent =
        profile.full_name ||
        "Donor";

    }


    if (fullName) {

      fullName.textContent =
        profile.full_name ||
        "Not provided";

    }


    if (mobile) {

      mobile.textContent =
        profile.mobile ||
        "Not provided";

    }


    if (accountStatus) {

      accountStatus.textContent =
        profile.status ||
        "Active";

    }


    // ------------------------------------
    // LOAD DONOR PROFILE
    // ------------------------------------

    const {
      data: donor,
      error: donorError
    } = await supabase
      .from("donor_profiles")
      .select(`
        id,
        user_id,
        blood_group,
        city,
        availability,
        emergency_available,
        last_donation_date
      `)
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();


    if (donorError) {

      console.error(
        "DONOR PROFILE ERROR:",
        donorError
      );

      showMessage(
        pageMessage,
        `Donor profile error: ${donorError.message}`
      );

      return;

    }


    // ------------------------------------
    // CHECK DONOR PROFILE
    // ------------------------------------

    if (!donor) {

      showMessage(
        pageMessage,
        "Your donor profile has not been created yet."
      );

      return;

    }


    donorProfile =
      donor;


    // ------------------------------------
    // DISPLAY DONOR DATA
    // ------------------------------------

    updateDashboard();

  }

  catch (error) {

    console.error(
      "DASHBOARD ERROR:",
      error
    );

    showMessage(
      pageMessage,
      error.message ||
      "Something went wrong."
    );

  }

}


// ========================================
// UPDATE DASHBOARD
// ========================================

function updateDashboard() {

  if (!donorProfile) return;


  // ------------------------------------
  // BLOOD GROUP
  // ------------------------------------

  if (bloodGroup) {

    bloodGroup.textContent =
      donorProfile.blood_group ||
      "Not set";

  }


  // ------------------------------------
  // CITY
  // ------------------------------------

  if (city) {

    city.textContent =
      donorProfile.city ||
      "Not set";

  }


  // ------------------------------------
  // LAST DONATION
  // ------------------------------------

  if (lastDonation) {

    if (
      donorProfile.last_donation_date
    ) {

      const date =
        new Date(
          donorProfile.last_donation_date
        );

      lastDonation.textContent =
        date.toLocaleDateString(
          "en-IN",
          {
            day: "numeric",
            month: "short",
            year: "numeric"
          }
        );

    }

    else {

      lastDonation.textContent =
        "Not recorded";

    }

  }


  updateAvailabilityUI();

  updateEmergencyUI();

}


// ========================================
// AVAILABILITY UI
// ========================================

function updateAvailabilityUI() {

  if (
    !availabilityText ||
    !availabilityToggle
  ) return;


  const available =
    donorProfile?.availability === true;


  // ======================================
  // AVAILABLE
  // ======================================

  if (available) {

    availabilityText.textContent =
      "You are currently available to donate blood.";


    availabilityToggle.textContent =
      "🟢 Available";


    availabilityToggle.classList.add(
      "active"
    );


    // CHANGE ICON TO GREEN
    if (availabilityIcon) {

      availabilityIcon.textContent =
        "🟢";

    }

  }


  // ======================================
  // NOT AVAILABLE
  // ======================================

  else {

    availabilityText.textContent =
      "You are currently unavailable for donation.";


    availabilityToggle.textContent =
      "⚪ Not Available";


    availabilityToggle.classList.remove(
      "active"
    );


    // CHANGE ICON TO RED
    if (availabilityIcon) {

      availabilityIcon.textContent =
        "🔴";

    }

  }

}


// ========================================
// EMERGENCY UI
// ========================================

function updateEmergencyUI() {

  if (
    !emergencyText ||
    !emergencyToggle
  ) return;


  const emergency =
    donorProfile?.emergency_available === true;


  if (emergency) {

    emergencyText.textContent =
      "You can be contacted for emergency blood requests.";


    emergencyToggle.textContent =
      "🚨 Emergency ON";


    emergencyToggle.classList.add(
      "active"
    );

  }

  else {

    emergencyText.textContent =
      "Emergency requests are currently disabled.";


    emergencyToggle.textContent =
      "Emergency OFF";


    emergencyToggle.classList.remove(
      "active"
    );

  }

}


// ========================================
// CHANGE AVAILABILITY
// ========================================

if (availabilityToggle) {

  availabilityToggle.addEventListener(
    "click",
    async () => {

      if (
        !donorProfile ||
        !currentUser
      ) return;


      const newValue =
        !donorProfile.availability;


      availabilityToggle.disabled =
        true;


      const {
        error
      } = await supabase
        .from("donor_profiles")
        .update({

          availability:
            newValue,

          updated_at:
            new Date().toISOString()

        })
        .eq(
          "user_id",
          currentUser.id
        );


      availabilityToggle.disabled =
        false;


      if (error) {

        console.error(
          "AVAILABILITY ERROR:",
          error
        );

        alert(
          "Could not update availability.\n\n" +
          error.message
        );

        return;

      }


      // Update local value
      donorProfile.availability =
        newValue;


      // Update button + icon
      updateAvailabilityUI();

    }
  );

}


// ========================================
// CHANGE EMERGENCY AVAILABILITY
// ========================================

if (emergencyToggle) {

  emergencyToggle.addEventListener(
    "click",
    async () => {

      if (
        !donorProfile ||
        !currentUser
      ) return;


      const newValue =
        !donorProfile.emergency_available;


      emergencyToggle.disabled =
        true;


      const {
        error
      } = await supabase
        .from("donor_profiles")
        .update({

          emergency_available:
            newValue,

          updated_at:
            new Date().toISOString()

        })
        .eq(
          "user_id",
          currentUser.id
        );


      emergencyToggle.disabled =
        false;


      if (error) {

        console.error(
          "EMERGENCY ERROR:",
          error
        );

        alert(
          "Could not update emergency availability.\n\n" +
          error.message
        );

        return;

      }


      donorProfile.emergency_available =
        newValue;


      updateEmergencyUI();

    }
  );

}


// ========================================
// OPEN EDIT PROFILE
// ========================================

if (editProfileBtn) {

  editProfileBtn.addEventListener(
    "click",
    function (event) {

      event.preventDefault();


      if (!donorProfile) {

        console.error(
          "Donor profile is not loaded."
        );

        return;

      }


      if (editBloodGroup) {

        editBloodGroup.value =
          donorProfile.blood_group ||
          "";

      }


      if (editCity) {

        if (window.bdcSetCityValue) window.bdcSetCityValue("editCity", donorProfile.city || "");
        else editCity.value = donorProfile.city || "";

      }


      if (editLastDonation) {

        editLastDonation.value =
          donorProfile.last_donation_date ||
          "";

      }


      if (profileMessage) {

        profileMessage.textContent =
          "";

        profileMessage.className =
          "form-message";

      }


      openProfileModal();

    }
  );

}


// ========================================
// CLOSE PROFILE MODAL - X BUTTON
// ========================================

if (closeModal) {

  closeModal.addEventListener(
    "click",
    function (event) {

      event.preventDefault();

      event.stopPropagation();

      closeProfileModal();

    }
  );

}


// ========================================
// CLOSE MODAL - OUTSIDE CLICK
// ========================================

if (profileModal) {

  profileModal.addEventListener(
    "click",
    function (event) {

      if (
        event.target ===
        profileModal
      ) {

        closeProfileModal();

      }

    }
  );

}


// ========================================
// CLOSE MODAL - ESCAPE KEY
// ========================================

document.addEventListener(
  "keydown",
  function (event) {

    if (
      event.key === "Escape"
    ) {

      closeProfileModal();

    }

  }
);


// ========================================
// SAVE PROFILE
// ========================================

if (profileForm) {

  profileForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (
        !currentUser ||
        !donorProfile
      ) {

        showMessage(
          profileMessage,
          "Your donor profile is not ready yet."
        );

        return;

      }


      const newBloodGroup =
        editBloodGroup?.value ||
        "";

      const newCity =
        editCity?.value.trim() ||
        "";

      const newLastDonation =
        editLastDonation?.value ||
        null;


      // ----------------------------------
      // VALIDATION
      // ----------------------------------

      if (!newBloodGroup) {

        showMessage(
          profileMessage,
          "Please select your blood group."
        );

        return;

      }


      if (!newCity) {

        showMessage(
          profileMessage,
          "Please enter your city."
        );

        return;

      }


      // ----------------------------------
      // SAVING
      // ----------------------------------

      showMessage(
        profileMessage,
        "Saving changes...",
        "info"
      );


      const {
        data,
        error
      } = await supabase
        .from("donor_profiles")
        .update({

          blood_group:
            newBloodGroup,

          city:
            newCity,

          last_donation_date:
            newLastDonation,

          updated_at:
            new Date().toISOString()

        })
        .eq(
          "user_id",
          currentUser.id
        );


      // ----------------------------------
      // ERROR
      // ----------------------------------

      if (error) {

        console.error(
          "UPDATE PROFILE ERROR:",
          error
        );

        showMessage(
          profileMessage,
          error.message
        );

        return;

      }


      // ----------------------------------
      // UPDATE LOCAL DATA
      // ----------------------------------

      donorProfile =
        data;


      updateDashboard();


      // ----------------------------------
      // SUCCESS
      // ----------------------------------

      showMessage(
        profileMessage,
        "Profile updated successfully.",
        "success"
      );


      setTimeout(
        () => {

          closeProfileModal();

        },
        800
      );

    }
  );

}


// ========================================
// LOGOUT
// ========================================

if (logoutButton) {

  logoutButton.addEventListener(
    "click",
    async () => {

      logoutButton.disabled =
        true;


      const {
        error
      } = await supabase.auth.signOut();


      logoutButton.disabled =
        false;


      if (error) {

        console.error(
          "LOGOUT ERROR:",
          error
        );

        alert(
          "Logout failed: " +
          error.message
        );

        return;

      }


      location.href =
        "index.html";

    }
  );

}


// ========================================
// DONATION HISTORY
// ========================================

async function loadDonationHistory() {

  const box =
    document.getElementById(
      "donationHistory"
    );


  if (
    !box ||
    !currentUser
  ) return;


  const {
    data,
    error
  } = await supabase
    .from("donations")
    .select("*")
    .eq(
      "donor_id",
      currentUser.id
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    console.warn(
      "Donation history unavailable:",
      error.message
    );

    return;

  }


  if (
    !data ||
    !data.length
  ) {

    return;

  }


  box.innerHTML =
    data.map(
      (donation) => {

        const group =
          donation.blood_group ||
          donation.component ||
          "Donation";


        const date =
          donation.donation_date ||
          donation.created_at;


        const formattedDate =
          date
            ? new Date(date)
                .toLocaleDateString(
                  "en-IN",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  }
                )
            : "Date not recorded";


        return `
          <article class="request-card">

            <div>

              <strong>
                🩸 ${group}
              </strong>

              <p>
                ${formattedDate}
              </p>

            </div>

            <span class="request-status">
              Recorded
            </span>

          </article>
        `;

      }
    ).join("");

}


// ========================================
// START DASHBOARD
// ========================================

async function startDashboard() {

  await loadDashboard();

  await loadDonationHistory();

}


// ========================================
// START
// ========================================

startDashboard();