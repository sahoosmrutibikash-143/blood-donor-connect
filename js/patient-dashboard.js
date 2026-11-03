import { supabase } from "./supabase.js";



let user = null;



/* Patient's saved profile information */

let patientProfile = {

    blood_group: "",

    city: ""

};





/* =========================================================
   HELPERS
   ========================================================= */



const $ = (id) => document.getElementById(id);



const msg = (el, text, type = "error") => {

    if (!el) return;



    el.textContent = text;

    el.className = `form-message ${type}`;

};



const escapeHtml = (value) =>

    String(value ?? "").replace(/[&<>"']/g, (char) => ({

        "&": "&amp;",

        "<": "&lt;",

        ">": "&gt;",

        '"': "&quot;",

        "'": "&#39;"

    }[char]));





/* =========================================================
   VALID BLOOD GROUPS
   ========================================================= */



const validBloodGroups = [

    "A+",

    "A-",

    "B+",

    "B-",

    "AB+",

    "AB-",

    "O+",

    "O-"

];





/* =========================================================
   INITIALIZE PATIENT DASHBOARD
   ========================================================= */



async function init() {



    const {

        data: { session },

        error

    } = await supabase.auth.getSession();



    if (error || !session) {

        location.href = "index.html";

        return;

    }



    user = session.user;





    /* =====================================================
       LOAD BASIC PROFILE
       ===================================================== */



    const {

        data: profile,

        error: profileError

    } = await supabase

        .from("profiles")

        .select("full_name,mobile,role,status")

        .eq("id", user.id)

        .maybeSingle();





    /* =====================================================
       VERIFY PATIENT ACCOUNT
       ===================================================== */



    if (

        profileError ||

        !profile ||

        profile.role !== "patient" ||

        profile.status !== "active"

    ) {

        await supabase.auth.signOut();

        location.href = "index.html";

        return;

    }





    /* =====================================================
       DISPLAY BASIC PROFILE INFORMATION
       ===================================================== */



    if ($("patientName")) {

        $("patientName").textContent =

            profile.full_name || "Patient";

    }



    if ($("patientNameProfile")) {

        $("patientNameProfile").textContent =

            profile.full_name || "—";

    }



    if ($("mobile")) {

        $("mobile").textContent =

            profile.mobile || "—";

    }





    /* =====================================================
       LOAD PATIENT-SPECIFIC PROFILE

       Blood group and city are stored in:
       public.patient_profiles
       ===================================================== */



    const {

        data: savedPatientProfile,

        error: patientProfileError

    } = await supabase

        .from("patient_profiles")

        .select("blood_group,city")

        .eq("user_id", user.id)

        .maybeSingle();





    if (patientProfileError) {



        console.error(

            "Patient profile error:",

            patientProfileError

        );



        patientProfile = {

            blood_group: "",

            city: ""

        };



    } else {



        patientProfile = {

            blood_group:

                savedPatientProfile?.blood_group || "",



            city:

                savedPatientProfile?.city || ""

        };

    }





    /* =====================================================
       DISPLAY BLOOD GROUP + CITY
       ===================================================== */



    if ($("bloodGroup")) {

        $("bloodGroup").textContent =

            patientProfile.blood_group || "Not set";

    }



    if ($("city")) {

        $("city").textContent =

            patientProfile.city || "Not set";

    }





    /* =====================================================
       LOAD BLOOD REQUESTS
       ===================================================== */



    await loadRequests();

}





/* =========================================================
   LOAD PATIENT REQUESTS
   ========================================================= */



async function loadRequests() {



    const box = $("requestList");



    if (!box) return;



    box.innerHTML = `

        <div class="empty-state">

            <span>⏳</span>

            <div>

                <h3>Loading requests...</h3>

                <p>Please wait.</p>

            </div>

        </div>

    `;





    const {

        data,

        error

    } = await supabase

        .from("blood_requests")

        .select(`

            id,

            blood_group,

            units_required,

            hospital_name,

            city,

            priority,

            status,

            required_date,

            additional_notes,

            created_at

        `)

        .eq("patient_id", user.id)

        .order("created_at", {

            ascending: false

        });





    if (error) {



        console.error(

            "Load requests error:",

            error

        );



        box.innerHTML = `

            <div class="empty-state">

                <span>⚠️</span>

                <div>

                    <h3>Could not load requests</h3>

                    <p>

                        ${escapeHtml(error.message)}

                    </p>

                </div>

            </div>

        `;



        return;

    }





    if (!data || data.length === 0) {



        box.innerHTML = `

            <div class="empty-state">

                <span>🩸</span>

                <div>

                    <h3>No blood requests yet</h3>

                    <p>

                        Use Request Blood to create

                        your first request.

                    </p>

                </div>

            </div>

        `;



        return;

    }





    box.innerHTML = data

        .map((request) => {



            const hospital =

                request.hospital_name

                    ? ` • ${escapeHtml(

                        request.hospital_name

                    )}`

                    : "";



            const requiredDate =

                request.required_date ||

                "Not specified";



            const priority =

                request.priority ||

                "normal";



            const status =

                request.status ||

                "pending";



            const units =

                Number(request.units_required) || 0;



            const amount =

                units * 100;



            return `

                <article class="request-card">



                    <div>



                        <strong>

                            ${escapeHtml(

                                request.blood_group

                            )}



                            •



                            ${escapeHtml(

                                request.units_required

                            )}



                            unit(s)

                        </strong>



                        <p>

                            ${escapeHtml(

                                request.city ||

                                "City not specified"

                            )}



                            ${hospital}

                        </p>



                        <p>

                            Required:



                            ${escapeHtml(requiredDate)}



                            •



                            Priority:



                            <b>

                                ${escapeHtml(priority)}

                            </b>

                        </p>



                    </div>



                    <div>



                        <span class="request-status">

                            ${escapeHtml(status)}

                        </span>



                        ${

                            status === "accepted"

                                ? `

                                    <button

                                        type="button"

                                        class="primary-btn pay-request-btn"

                                        data-request-id="${escapeHtml(

                                            request.id

                                        )}"

                                        style="margin-top:10px;"

                                    >

                                        Pay ₹${amount}

                                    </button>

                                  `

                                : ""

                        }



                        ${

                            status === "processing"

                                ? `

                                    <p

                                        style="

                                            margin-top:10px;

                                            color:#198754;

                                        "

                                    >

                                        ✓ Payment completed —

                                        request is processing

                                    </p>

                                  `

                                : ""

                        }



                    </div>



                </article>

            `;

        })

        .join("");





    /* =========================================================
       PAYMENT BUTTON EVENTS
       ========================================================= */



    box

        .querySelectorAll(".pay-request-btn")

        .forEach((button) => {



            button.addEventListener(

                "click",

                () => {



                    const requestId =

                        button.dataset.requestId;



                    if (!requestId) return;



                    payForRequest(requestId);



                }

            );



        });

}





/* =========================================================
   RAZORPAY PAYMENT
   ========================================================= */



async function loadRazorpayScript() {



    if (window.Razorpay) {

        return true;

    }



    return new Promise((resolve) => {



        const script =

            document.createElement("script");



        script.src =

            "https://checkout.razorpay.com/v1/checkout.js";



        script.onload = () => {

            resolve(true);

        };



        script.onerror = () => {

            resolve(false);

        };



        document.body.appendChild(script);



    });

}





/* =========================================================
   PAY FOR BLOOD REQUEST
   ========================================================= */



async function payForRequest(requestId) {



    try {



        msg(

            $("pageMessage"),

            "Creating Razorpay payment...",

            "info"

        );





        /* =========================================
           CREATE RAZORPAY ORDER
           ========================================= */



        const {

            data: orderData,

            error: orderError

        } = await supabase.functions.invoke(

            "razorpay-payment",

            {

                body: {

                    action: "create_order",

                    request_id: requestId

                }

            }

        );





        if (orderError) {



            console.error(

                "Razorpay order error:",

                orderError

            );



            msg(

                $("pageMessage"),

                orderError.message ||

                "Could not create payment."

            );



            return;

        }





        if (!orderData?.success) {



            msg(

                $("pageMessage"),

                orderData?.error ||

                "Could not create payment."

            );



            return;

        }





        /* =========================================
           ALREADY PAID
           ========================================= */



        if (orderData.already_paid) {



            msg(

                $("pageMessage"),

                "This request has already been paid.",

                "success"

            );



            await loadRequests();



            return;

        }





        /* =========================================
           LOAD RAZORPAY CHECKOUT
           ========================================= */



        const razorpayLoaded =

            await loadRazorpayScript();





        if (!razorpayLoaded) {



            msg(

                $("pageMessage"),

                "Could not load Razorpay Checkout."

            );



            return;

        }





        /* =========================================
           RAZORPAY CHECKOUT OPTIONS
           ========================================= */



        const options = {



            key:

                orderData.key_id,



            amount:

                orderData.amount,



            currency:

                orderData.currency,



            name:

                "Blood Donor Connect",



            description:

                "Blood Request Payment",



            order_id:

                orderData.order_id,





            prefill: {



                name:

                    $("patientName")?.textContent ||

                    "Patient",



                email:

                    user?.email ||

                    ""



            },





            theme: {



                color:

                    "#d62828"



            },





            /* =====================================
               SUCCESSFUL PAYMENT
               ===================================== */



            handler:

                async function (

                    paymentResponse

                ) {



                    msg(

                        $("pageMessage"),

                        "Verifying payment...",

                        "info"

                    );





                    const {

                        data: verifyData,

                        error: verifyError

                    } =

                        await supabase.functions.invoke(

                            "razorpay-payment",

                            {

                                body: {



                                    action:

                                        "verify_payment",



                                    request_id:

                                        requestId,



                                    razorpay_order_id:

                                        paymentResponse

                                            .razorpay_order_id,



                                    razorpay_payment_id:

                                        paymentResponse

                                            .razorpay_payment_id,



                                    razorpay_signature:

                                        paymentResponse

                                            .razorpay_signature



                                }

                            }

                        );





                    if (verifyError) {



                        console.error(

                            "Payment verification error:",

                            verifyError

                        );



                        msg(

                            $("pageMessage"),

                            "Payment verification failed."

                        );



                        return;

                    }





                    if (!verifyData?.success) {



                        msg(

                            $("pageMessage"),

                            verifyData?.error ||

                            "Payment verification failed."

                        );



                        return;

                    }





                    /* ===============================
                       PAYMENT SUCCESS
                       =============================== */



                    msg(

                        $("pageMessage"),

                        "Payment successful! Your request is now processing.",

                        "success"

                    );





                    await loadRequests();



                },





            /* =====================================
               CHECKOUT CLOSED
               ===================================== */



            modal: {



                ondismiss:

                    function () {



                        msg(

                            $("pageMessage"),

                            "Payment window closed."

                        );



                    }



            }



        };





        /* =========================================
           OPEN RAZORPAY
           ========================================= */



        const razorpay =

            new window.Razorpay(options);





        /* =========================================
           PAYMENT FAILED
           ========================================= */



        razorpay.on(

            "payment.failed",

            function (response) {



                console.error(

                    "Razorpay payment failed:",

                    response.error

                );



                msg(

                    $("pageMessage"),

                    response.error?.description ||

                    "Payment failed."

                );



            }

        );





        razorpay.open();





    } catch (error) {



        console.error(

            "Payment error:",

            error

        );



        msg(

            $("pageMessage"),

            error.message ||

            "Something went wrong while starting payment."

        );



    }

}





/* =========================================================
   OPEN REQUEST MODAL
   ========================================================= */



function openModal(priority = "normal") {



    const modal =

        $("requestModal");



    if (!modal) return;





    /* =====================================================
       SET PRIORITY
       ===================================================== */



    if ($("requestPriority")) {

        $("requestPriority").value =

            priority;

    }





    /* =====================================================
       CLEAR OLD MESSAGE
       ===================================================== */



    if ($("requestMessage")) {



        $("requestMessage").textContent =

            "";



        $("requestMessage").className =

            "form-message";

    }





    /* =====================================================
       AUTO-FILL PATIENT BLOOD GROUP
       ===================================================== */



    const bloodInput =

        $("requestBloodGroup");



    if (

        bloodInput &&

        patientProfile.blood_group &&

        validBloodGroups.includes(

            patientProfile.blood_group

        )

    ) {



        bloodInput.value =

            patientProfile.blood_group;

    }





    /* =====================================================
       AUTO-FILL PATIENT CITY
       ===================================================== */



    const cityInput =

        $("requestCity");



    if (

        cityInput &&

        patientProfile.city

    ) {



        cityInput.value =

            patientProfile.city;

    }





    /* =====================================================
       SET REQUIRED DATE
       ===================================================== */



    const dateInput =

        $("requiredDate");





    if (dateInput) {



        const today =

            new Date();



        today.setMinutes(

            today.getMinutes() -

            today.getTimezoneOffset()

        );





        const todayString =

            today.toISOString()

                .slice(0, 10);





        dateInput.min =

            todayString;





        if (!dateInput.value) {



            dateInput.value =

                todayString;

        }

    }





    /* =====================================================
       OPEN MODAL
       ===================================================== */



    modal.classList.remove(

        "hidden"

    );

}





/* =========================================================
   CLOSE REQUEST MODAL
   ========================================================= */



function closeRequestModal() {



    $("requestModal")

        ?.classList

        .add("hidden");

}





/* =========================================================
   REQUEST BLOOD BUTTON
   ========================================================= */



$("requestBloodBtn")?.addEventListener(

    "click",

    () => {



        openModal("normal");



    }

);





/* =========================================================
   EMERGENCY REQUEST BUTTON
   ========================================================= */



$("emergencyBtn")?.addEventListener(

    "click",

    () => {



        openModal("emergency");



    }

);





/* =========================================================
   CLOSE MODAL BUTTON
   ========================================================= */



$("closeRequestModal")?.addEventListener(

    "click",

    closeRequestModal

);





/* =========================================================
   CLICK OUTSIDE MODAL TO CLOSE
   ========================================================= */



$("requestModal")?.addEventListener(

    "click",

    (event) => {



        if (

            event.target ===

            $("requestModal")

        ) {



            closeRequestModal();



        }



    }

);





/* =========================================================
   FIND BLOOD MODAL
   ========================================================= */

const findBloodModal =
    $("findBloodModal");

const findBloodForm =
    $("findBloodForm");

const findBloodGroup =
    $("findBloodGroup");

const findBloodCity =
    $("findBloodCity");

const findBloodModalMessage =
    $("findBloodModalMessage");


/* =========================================================
   OPEN FIND BLOOD MODAL
   ========================================================= */

function openFindBloodModal() {

    if (!findBloodModal) return;


    /*
       If the patient already has saved information,
       automatically fill it into the popup.
    */

    if (
        findBloodGroup &&
        patientProfile.blood_group &&
        validBloodGroups.includes(
            patientProfile.blood_group
        )
    ) {

        findBloodGroup.value =
            patientProfile.blood_group;

    } else if (findBloodGroup) {

        findBloodGroup.value = "";

    }


    if (
        findBloodCity &&
        patientProfile.city
    ) {

        if (window.bdcSetCityValue) window.bdcSetCityValue("findBloodCity", patientProfile.city);
        else findBloodCity.value = patientProfile.city;

    } else if (findBloodCity) {

        findBloodCity.value = "";

    }


    if (findBloodModalMessage) {

        findBloodModalMessage.textContent = "";

        findBloodModalMessage.className =
            "form-message";

    }


    findBloodModal.classList.remove(
        "hidden"
    );

}


/* =========================================================
   CLOSE FIND BLOOD MODAL
   ========================================================= */

function closeFindBloodModal() {

    findBloodModal
        ?.classList
        .add("hidden");

}


/* =========================================================
   FIND BLOOD BUTTON
   ========================================================= */

$("findBloodBtn")?.addEventListener(

    "click",

    () => {

        openFindBloodModal();

    }

);


/* =========================================================
   CLOSE BUTTON
   ========================================================= */

$("closeFindBloodModal")?.addEventListener(

    "click",

    closeFindBloodModal

);


/* =========================================================
   CANCEL BUTTON
   ========================================================= */

$("cancelFindBlood")?.addEventListener(

    "click",

    closeFindBloodModal

);


/* =========================================================
   CLICK OUTSIDE MODAL
   ========================================================= */

findBloodModal?.addEventListener(

    "click",

    (event) => {

        if (
            event.target ===
            findBloodModal
        ) {

            closeFindBloodModal();

        }

    }

);


/* =========================================================
   SUBMIT FIND BLOOD FORM
   ========================================================= */

findBloodForm?.addEventListener(

    "submit",

    async (event) => {

        event.preventDefault();


        let bloodGroup =
            findBloodGroup?.value
                ?.trim()
                .toUpperCase();

        let cityName =
    $("findBloodCity")?.value
        ?.trim();


        /* =================================================
           VALIDATE BLOOD GROUP
           ================================================= */

        if (
            !validBloodGroups.includes(
                bloodGroup
            )
        ) {

            msg(
                findBloodModalMessage,
                "Please select a valid blood group."
            );

            return;

        }


        /* =================================================
           VALIDATE CITY
           ================================================= */

        if (!cityName) {

            msg(
                findBloodModalMessage,
                "Please enter a city."
            );

            return;

        }


        /* =================================================
           SEARCH MESSAGE
           ================================================= */

        msg(
            findBloodModalMessage,
            "Searching donors with the same recorded blood group...",
            "info"
        );


        msg(
            $("pageMessage"),
            "Searching available donors...",
            "info"
        );


        /* =================================================
           SEARCH DATABASE
           ================================================= */

        const {

            data,

            error

        } = await supabase.rpc(

            "find_available_donors",

            {

                p_blood_group:
                    bloodGroup,

                p_city:
                    cityName

            }

        );


        /* =================================================
           HANDLE ERROR
           ================================================= */

        if (error) {

            console.error(
                "Find donor error:",
                error
            );


            msg(
                findBloodModalMessage,
                error.message
            );


            msg(
                $("pageMessage"),
                error.message
            );


            return;

        }


        /* =================================================
           CLOSE MODAL
           ================================================= */

        closeFindBloodModal();


        /* =================================================
           SHOW RESULTS
           ================================================= */

        const box =
            $("findBloodResult");


        if (!box) return;


        if (
            data &&
            data.length > 0
        ) {

            box.innerHTML = `

                <div class="result-box">

                    <b>

                        ${data.length}

                        potentially matching donor record(s) found.

                    </b>


                    <p>

                        Requested blood group (exact match):

                        ${escapeHtml(
                            bloodGroup
                        )}

                    </p>


                    <p>

                        City:

                        ${escapeHtml(
                            cityName
                        )}

                    </p>


                    <p>

                        Donor contact details are kept private. This is a preliminary same-group search, not confirmation that blood is suitable or available for transfusion. An authorised blood bank must verify compatibility, eligibility, screening and stock.

                    </p>

                </div>

            `;

        } else {

            box.innerHTML = `

                <div class="result-box">

                    <b>

                        No matching donor records found.

                    </b>


                    <p>

                        No available donors were

                        found for

                        ${escapeHtml(
                            bloodGroup
                        )}

                        in

                        ${escapeHtml(
                            cityName
                        )}.

                    </p>


                    <p>

                        You can submit a blood

                        request instead.

                    </p>

                </div>

            `;

        }


        /* =================================================
           SCROLL TO RESULT
           ================================================= */

        box.scrollIntoView({

            behavior: "smooth",

            block: "center"

        });


        msg(
            $("pageMessage"),
            ""
        );

    }

);
/* =========================================================
   SUBMIT BLOOD REQUEST
   ========================================================= */



$("requestForm")?.addEventListener(

    "submit",

    async (event) => {



        event.preventDefault();





        const requestMsg =

            $("requestMessage");





        msg(

            requestMsg,

            "Submitting request...",

            "info"

        );





        /* =================================================
           READ FORM VALUES
           ================================================= */



        const blood =

            $("requestBloodGroup")

                ?.value;



        const units =

            Number(

                $("requestUnits")

                    ?.value

            );





        const city =

            $("requestCity")

                ?.value

                .trim();





        const priority =

            $("requestPriority")

                ?.value;





        const requiredDate =

            $("requiredDate")

                ?.value;





        const hospital =

            $("requestHospital")

                ?.value

                .trim();





        const notes =

            $("additionalNotes")

                ?.value

                .trim();





        /* =================================================
           VALIDATION
           ================================================= */



        if (

            !blood ||

            !Number.isInteger(units) ||

            units < 1 ||

            units > 20 ||

            !city ||

            !requiredDate

        ) {



            msg(

                requestMsg,

                "Please complete all required fields."

            );



            return;

        }





        const selectedDate = new Date(`${requiredDate}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (Number.isNaN(selectedDate.getTime()) || selectedDate < today) {
            msg(requestMsg, "Required date cannot be in the past.");
            return;
        }


        if (

            !validBloodGroups.includes(

                blood

            )

        ) {



            msg(

                requestMsg,

                "Please select a valid blood group."

            );



            return;

        }





        /* =================================================
           INSERT BLOOD REQUEST
           ================================================= */



        const {

            error

        } = await supabase

            .from("blood_requests")

            .insert({



                patient_id:

                    user.id,



                blood_group:

                    blood,



                units_required:

                    units,



                hospital_name:

                    hospital || null,



                city:

                    city,



                priority:

                    priority || "normal",



                status:

                    "pending",



                required_date:

                    requiredDate,



                additional_notes:

                    notes || null



            });





        if (error) {



            console.error(

                "Blood request insert error:",

                error

            );



            msg(

                requestMsg,

                error.message

            );



            return;

        }





        /* =================================================
           SUCCESS
           ================================================= */



        msg(

            requestMsg,

            "Blood request submitted successfully.",

            "success"

        );





        /* Refresh request history */



        await loadRequests();





        /* =================================================
           CLOSE MODAL
           ================================================= */



        setTimeout(() => {



            $("requestModal")

                ?.classList

                .add("hidden");





            $("requestForm")

                ?.reset();





            if ($("requestPriority")) {



                $("requestPriority").value =

                    "normal";

            }





            /*

                Restore saved patient information

                after resetting the form.

            */



            if (

                $("requestBloodGroup") &&

                patientProfile.blood_group

            ) {



                $("requestBloodGroup").value =

                    patientProfile.blood_group;

            }





            if (

                $("requestCity") &&

                patientProfile.city

            ) {



                $("requestCity").value =

                    patientProfile.city;

            }



        }, 900);



    }

);





/* =========================================================
   LOGOUT
   ========================================================= */



$("logout")?.addEventListener(

    "click",

    async () => {



        await supabase.auth.signOut();



        location.href =

            "index.html";

    }

);





/* =========================================================
   START
   ========================================================= */



init();
