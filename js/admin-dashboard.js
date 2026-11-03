import { supabase } from "./supabase.js";


// =========================================================
// HELPERS
// =========================================================

const $ = (id) =>
    document.getElementById(id);


const msg = (
    text,
    type = "error"
) => {

    const element =
        $("pageMessage");

    if (!element) return;

    element.textContent = text;

    element.className =
        `form-message ${type}`;
};


const esc = (value) =>

    String(value ?? "")
        .replace(
            /[&<>"']/g,
            (char) => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char])
        );


// =========================================================
// ADMIN DETAIL PANEL
// =========================================================

const detailPanel =
    $("adminDetailPanel");

const detailContent =
    $("adminDetailContent");

const detailTitle =
    $("detailTitle");

const detailEyebrow =
    $("detailEyebrow");


function openAdminDetail(
    title,
    eyebrow = "ADMIN MANAGEMENT"
) {

    if (!detailPanel) return;

    detailTitle.textContent =
        title;

    detailEyebrow.textContent =
        eyebrow;

    detailPanel.classList.add(
        "show"
    );

    detailPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


function closeAdminDetail() {

    if (!detailPanel) return;

    detailPanel.classList.remove(
        "show"
    );

    document
        .querySelectorAll(
            ".stats article"
        )
        .forEach((card) => {

            card.classList.remove(
                "active"
            );

        });
}


// =========================================================
// INITIALIZE ADMIN DASHBOARD
// =========================================================

async function init() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        location.href = "admin-login.html";
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,status")
        .eq("id", session.user.id)
        .maybeSingle();

    if (profileError || !profile || profile.role !== "admin" || profile.status !== "active") {
        await supabase.auth.signOut();
        location.href = "admin-login.html";
        return;
    }

    await Promise.all([loadStats(), loadRequests(), loadInventory()]);
}


// =========================================================
// DASHBOARD STATISTICS
// =========================================================

async function loadStats() {

    const {
        data,
        error
    } = await supabase.rpc(
        "admin_dashboard_stats"
    );


    if (error) {

        console.error(
            "Admin stats error:",
            error
        );


        if ($("statDonors")) {

            $("statDonors")
                .textContent = "—";

        }


        if ($("statPatients")) {

            $("statPatients")
                .textContent = "—";

        }


        if ($("statRequests")) {

            $("statRequests")
                .textContent = "—";

        }


        if ($("statEmergency")) {

            $("statEmergency")
                .textContent = "—";

        }


        msg(
            error.message,
            "error"
        );

        return;
    }


    const stats =
        data || {};


    if ($("statDonors")) {

        $("statDonors")
            .textContent =
            stats.donors ?? 0;

    }


    if ($("statPatients")) {

        $("statPatients")
            .textContent =
            stats.patients ?? 0;

    }


    if ($("statRequests")) {

        $("statRequests")
            .textContent =
            stats.requests ?? 0;

    }


    if ($("statEmergency")) {

        $("statEmergency")
            .textContent =
            stats.emergency ?? 0;

    }
}


// =========================================================
// DONOR RECORDS
// =========================================================

async function loadDonorRecords() {

    if (!detailContent) return;


    detailContent.innerHTML = `

        <p class="muted">
            Loading donor records...
        </p>

    `;


    /*
        This uses a secure admin RPC.

        We will create this RPC in Supabase:
        admin_dashboard_donors
    */

    const {
        data,
        error
    } = await supabase.rpc(
        "admin_dashboard_donors"
    );


    if (error) {

        console.error(
            "Donor records error:",
            error
        );


        detailContent.innerHTML = `

            <p class="form-message error">

                Could not load donor records.

                <br><br>

                ${esc(error.message)}

            </p>

        `;

        return;
    }


    if (
        !data ||
        data.length === 0
    ) {

        detailContent.innerHTML = `

            <p class="muted">

                No donor records found.

            </p>

        `;

        return;
    }


    detailContent.innerHTML = `

        <p class="record-count">

            ${data.length}
            donor record(s) found.

        </p>


        <div class="admin-record-grid">

            ${data.map((donor) => {

                const available =
                    donor.availability === true;


                const emergency =
                    donor.emergency_available === true;


                return `

                    <article
                        class="admin-record-card"
                    >

                        <h3>

                            🩸
                            ${esc(
                                donor.full_name ||
                                "Unknown Donor"
                            )}

                        </h3>


                        <div class="record-row">

                            <span
                                class="record-label"
                            >
                                Blood Group
                            </span>

                            <strong
                                class="record-value"
                            >
                                ${esc(
                                    donor.blood_group ||
                                    "Not set"
                                )}
                            </strong>

                        </div>


                        <div class="record-row">

                            <span
                                class="record-label"
                            >
                                Mobile
                            </span>

                            <span
                                class="record-value"
                            >
                                ${esc(
                                    donor.mobile ||
                                    "Not available"
                                )}
                            </span>

                        </div>


                        <div class="record-row">

                            <span
                                class="record-label"
                            >
                                Email
                            </span>

                            <span
                                class="record-value"
                            >
                                ${esc(
                                    donor.email ||
                                    "Not available"
                                )}
                            </span>

                        </div>


                        <div class="record-row">

                            <span
                                class="record-label"
                            >
                                City
                            </span>

                            <span
                                class="record-value"
                            >
                                ${esc(
                                    donor.city ||
                                    "Not set"
                                )}
                            </span>

                        </div>


                        <div class="record-row">

                            <span
                                class="record-label"
                            >
                                Availability
                            </span>

                            <strong
                                class="record-value ${
                                    available
                                        ? "available-badge"
                                        : "unavailable-badge"
                                }"
                            >

                                ${
                                    available
                                        ? "● Available"
                                        : "● Not Available"
                                }

                            </strong>

                        </div>


                        <div class="record-row">

                            <span
                                class="record-label"
                            >
                                Emergency
                            </span>

                            <strong
                                class="record-value ${
                                    emergency
                                        ? "available-badge"
                                        : "unavailable-badge"
                                }"
                            >

                                ${
                                    emergency
                                        ? "🚨 Enabled"
                                        : "Disabled"
                                }

                            </strong>

                        </div>


                        <div class="record-row">

                            <span
                                class="record-label"
                            >
                                Last Donation
                            </span>

                            <span
                                class="record-value"
                            >

                                ${
                                    donor.last_donation_date
                                        ? esc(
                                            donor.last_donation_date
                                        )
                                        : "Not recorded"
                                }

                            </span>

                        </div>


                        <div class="record-row">

                            <span
                                class="record-label"
                            >
                                Account Status
                            </span>

                            <span
                                class="record-value"
                            >

                                ${esc(
                                    donor.status ||
                                    "Active"
                                )}

                            </span>

                        </div>

                    </article>

                `;

            }).join("")}

        </div>

    `;
}


// =========================================================
// DONOR STAT CARD
// =========================================================

$("donorsStatCard")?.addEventListener(
    "click",
    async () => {

        document
            .querySelectorAll(
                ".stats article"
            )
            .forEach((card) => {

                card.classList.remove(
                    "active"
                );

            });


        $("donorsStatCard")
            ?.classList.add(
                "active"
            );


        openAdminDetail(
            "Donor Records",
            "DONOR MANAGEMENT"
        );


        await loadDonorRecords();

    }
);


// Keyboard support

$("donorsStatCard")?.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {

            event.preventDefault();

            $("donorsStatCard").click();

        }

    }
);


// =========================================================
// PATIENT RECORDS
// =========================================================

async function loadPatientRecords() {
    if (!detailContent) return;
    detailContent.innerHTML = '<p class="muted">Loading patient records...</p>';
    const { data, error } = await supabase.rpc("admin_dashboard_patients");
    if (error) {
        detailContent.innerHTML = `<p class="form-message error">${esc(error.message)}</p>`;
        return;
    }
    if (!data?.length) {
        detailContent.innerHTML = '<p class="muted">No patient records found.</p>';
        return;
    }
    detailContent.innerHTML = `<p class="record-count">${data.length} patient record(s) found.</p><div class="admin-record-grid">${data.map(patient => `
      <article class="admin-record-card"><h3>👤 ${esc(patient.full_name || 'Patient')}</h3>
      <div class="record-row"><span class="record-label">Blood group</span><strong class="record-value">${esc(patient.blood_group || 'Not set')}</strong></div>
      <div class="record-row"><span class="record-label">Mobile</span><span class="record-value">${esc(patient.mobile || 'Not available')}</span></div>
      <div class="record-row"><span class="record-label">Email</span><span class="record-value">${esc(patient.email || 'Not available')}</span></div>
      <div class="record-row"><span class="record-label">City</span><span class="record-value">${esc(patient.city || 'Not set')}</span></div>
      <div class="record-row"><span class="record-label">Account status</span><span class="record-value">${esc(patient.status || '—')}</span></div></article>`).join('')}</div>`;
}

async function loadRequestDetails(emergencyOnly) {
    if (!detailContent) return;
    detailContent.innerHTML = '<p class="muted">Loading requests...</p>';
    const { data, error } = await supabase.rpc("admin_dashboard_requests");
    if (error) {
        detailContent.innerHTML = `<p class="form-message error">${esc(error.message)}</p>`;
        return;
    }
    const rows = (data || []).filter(r => !emergencyOnly || r.priority === 'emergency');
    if (!rows.length) {
        detailContent.innerHTML = `<p class="muted">No ${emergencyOnly ? 'emergency ' : ''}requests found in the latest 20 records.</p>`;
        return;
    }
    detailContent.innerHTML = `<p class="record-count">Showing ${rows.length} ${emergencyOnly ? 'emergency ' : ''}request(s) from the latest 20.</p><div class="admin-record-grid">${rows.map(r => `
      <article class="admin-record-card"><h3>🩸 ${esc(r.blood_group)} · ${esc(r.units_required)} unit(s)</h3>
      <div class="record-row"><span class="record-label">City / Hospital</span><span class="record-value">${esc(r.city)}${r.hospital_name ? ' · ' + esc(r.hospital_name) : ''}</span></div>
      <div class="record-row"><span class="record-label">Priority</span><strong class="record-value">${esc(r.priority)}</strong></div>
      <div class="record-row"><span class="record-label">Status</span><strong class="record-value">${esc(r.status)}</strong></div>
      <div class="record-row"><span class="record-label">Required date</span><span class="record-value">${esc(r.required_date || 'Not specified')}</span></div></article>`).join('')}</div>`;
}


// =========================================================
// PATIENT STAT CARD
// =========================================================

$("patientsStatCard")?.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(
                ".stats article"
            )
            .forEach((card) => {

                card.classList.remove(
                    "active"
                );

            });


        $("patientsStatCard")
            ?.classList.add(
                "active"
            );


        openAdminDetail(
            "Patient Records",
            "PATIENT MANAGEMENT"
        );


        loadPatientRecords();

    }
);


// =========================================================
// REQUEST STAT CARD
// =========================================================

$("requestsStatCard")?.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(
                ".stats article"
            )
            .forEach((card) => {

                card.classList.remove(
                    "active"
                );

            });


        $("requestsStatCard")
            ?.classList.add(
                "active"
            );


        openAdminDetail(
            "All Blood Requests",
            "REQUEST MANAGEMENT"
        );


        loadRequestDetails(false);

    }
);


// =========================================================
// EMERGENCY STAT CARD
// =========================================================

$("emergencyStatCard")?.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(
                ".stats article"
            )
            .forEach((card) => {

                card.classList.remove(
                    "active"
                );

            });


        $("emergencyStatCard")
            ?.classList.add(
                "active"
            );


        openAdminDetail(
            "Emergency Requests",
            "EMERGENCY MANAGEMENT"
        );


        loadRequestDetails(true);

    }
);


// =========================================================
// CLOSE DETAIL PANEL
// =========================================================

$("closeDetail")?.addEventListener(
    "click",
    closeAdminDetail
);


// =========================================================
// LOAD BLOOD REQUESTS
// =========================================================

async function loadRequests() {

    const box =
        $("adminRequests");


    if (!box) return;


    box.innerHTML = `

        <p class="muted">

            Loading blood requests...

        </p>

    `;


    const {
        data,
        error
    } = await supabase.rpc(
        "admin_dashboard_requests"
    );


    if (error) {

        console.error(
            "Admin request loading error:",
            error
        );


        box.innerHTML = `

            <p class="form-message error">

                ${esc(error.message)}

            </p>

        `;

        return;
    }


    if (
        !data ||
        data.length === 0
    ) {

        box.innerHTML = `

            <p class="muted">

                No blood requests yet.

            </p>

        `;

        return;
    }


    box.innerHTML = data
        .map((request) => {

            const bloodGroup =
                request.blood_group ||
                "—";


            const units =
                request.units_required ??
                "—";


            const city =
                request.city ||
                "—";


            const hospital =
                request.hospital_name ||
                "";


            const priority =
                request.priority ||
                "normal";


            const status =
                request.status ||
                "pending";


            const requiredDate =
                request.required_date ||
                "Not specified";


            const createdDate =
                request.created_at
                    ? new Date(
                        request.created_at
                    ).toLocaleString()
                    : "—";


            return `

                <article
                    class="request-card"
                >

                    <div>

                        <strong>

                            🩸
                            ${esc(bloodGroup)}
                            •
                            ${esc(units)}
                            unit(s)

                        </strong>


                        <p>

                            ${esc(city)}

                            ${
                                hospital
                                    ? ` • ${esc(hospital)}`
                                    : ""
                            }

                        </p>


                        <small>

                            Priority:
                            ${esc(priority)}

                            • Required:
                            ${esc(requiredDate)}

                        </small>


                        <br>


                        <small>

                            Created:
                            ${esc(createdDate)}

                        </small>

                    </div>


                    <select
                        class="status-select"
                        data-id="${esc(
                            request.id
                        )}"
                        aria-label="Update request status"
                    >

                        <option
                            value="pending"
                            ${
                                status === "pending"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Pending
                        </option>


                        <option
                            value="accepted"
                            ${
                                status === "accepted"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Accepted
                        </option>


                        <option
                            value="processing"
                            ${
                                status === "processing"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Processing
                        </option>


                        <option
                            value="fulfilled"
                            ${
                                status === "fulfilled"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Fulfilled
                        </option>


                        <option
                            value="rejected"
                            ${
                                status === "rejected"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Rejected
                        </option>


                        <option
                            value="cancelled"
                            ${
                                status === "cancelled"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Cancelled
                        </option>

                    </select>

                </article>

            `;

        })
        .join("");


    box
        .querySelectorAll(
            ".status-select"
        )
        .forEach((select) => {

            select.addEventListener(
                "change",
                () =>
                    updateRequestStatus(
                        select
                    )
            );

        });
}


// =========================================================
// UPDATE REQUEST STATUS
// =========================================================

async function updateRequestStatus(
    select
) {

    const requestId =
        select.dataset.id;


    const newStatus =
        select.value;


    if (
        !requestId ||
        !newStatus
    ) {
        return;
    }


    select.disabled = true;


    msg(
        "Updating request status...",
        "info"
    );


    const {
        data,
        error
    } = await supabase.rpc(
        "admin_update_request_status",
        {
            p_request_id:
                requestId,

            p_status:
                newStatus
        }
    );


    select.disabled = false;


    if (error) {

        console.error(
            "Request status update error:",
            error
        );


        msg(
            error.message,
            "error"
        );


        await loadRequests();

        return;
    }


    if (data !== true) {

        msg(
            "The request status could not be updated.",
            "error"
        );


        await loadRequests();

        return;
    }


    msg(
        "Request status updated successfully.",
        "success"
    );


    await Promise.all([

        loadRequests(),

        loadStats()

    ]);
}


// =========================================================
// LOAD BLOOD INVENTORY
// =========================================================

async function loadInventory() {

    const box =
        $("inventory");


    if (!box) return;


    box.innerHTML = `

        <p class="muted">

            Loading inventory...

        </p>

    `;


    const {
        data,
        error
    } = await supabase.rpc(
        "admin_dashboard_inventory"
    );


    if (error) {

        console.error(
            "Inventory loading error:",
            error
        );


        box.innerHTML = `

            <p class="form-message error">

                Inventory could not be loaded:

                ${esc(error.message)}

            </p>

        `;

        return;
    }


    if (
        !data ||
        data.length === 0
    ) {

        box.innerHTML = `

            <p class="muted">

                No inventory records yet.

            </p>

        `;

        return;
    }


    box.innerHTML = data
        .map((item) => {

            const bloodGroup =
                item.blood_group ||
                "Unknown";


            const available =
                item.units_available ??
                0;


            const reserved =
                item.units_reserved ??
                0;


            const updated =
                item.last_updated
                    ? new Date(
                        item.last_updated
                    ).toLocaleString()
                    : "—";


            return `

                <div
                    class="inventory-row"
                >

                    <div>

                        <b>

                            🩸
                            ${esc(
                                bloodGroup
                            )}

                        </b>


                        <small>

                            Updated:
                            ${esc(updated)}

                        </small>

                    </div>


                    <div>

                        <strong>

                            ${esc(
                                available
                            )}
                            available

                        </strong>


                        <span>

                            ${esc(
                                reserved
                            )}
                            reserved

                        </span>

                    </div>

                </div>

            `;

        })
        .join("");
}


// =========================================================
// LOGOUT
// =========================================================

$("logout")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "index.html";
});


// =========================================================
// START
// =========================================================

init();