/**
 * Bulletin scolaire – SYBEM Academia
 * Compatible avec BulletinGeneratorViewSet (backend actuel)
 */

const reportManager = {
    studentId: null,
    classId: null,
    apiData: null,

    async init() {
        const params = new URLSearchParams(window.location.search);
        this.studentId = params.get("student_id");
        this.classId = params.get("class_id");

        if (!this.studentId || !this.classId) {
            Swal.fire("Erreur", "Paramètres élève ou classe manquants", "error");
            return;
        }

        await this.loadGradingPeriods();
    },

    async loadGradingPeriods() {
        try {
            const periods = await fetchAPI("/api/academia/grading-periods/");
            const select = document.getElementById("periodSelect");

            if (!Array.isArray(periods)) {
                throw new Error("Liste des périodes invalide");
            }

            select.innerHTML = periods.map(p =>
                `<option value="${p.id}">${p.name}</option>`
            ).join("");

            await this.loadBulletinData();

        } catch (err) {
            console.error(err);
            Swal.fire("Erreur", "Impossible de charger les périodes", "error");
        }
    },

    async loadBulletinData() {
        const periodId = document.getElementById("periodSelect")?.value;
        if (!periodId) return;

        try {
            const url = `/api/academia/bulletins/generate/?class_id=${this.classId}&period_id=${periodId}`;
            const data = await fetchAPI(url);

            if (!data || !Array.isArray(data.bulletins)) {
                throw new Error("Réponse bulletin invalide");
            }

            this.apiData = data;

            const studentBulletin = data.bulletins.find(
                b => String(b.student_id) === String(this.studentId)
            );

            if (!studentBulletin) {
                Swal.fire(
                    "Aucun bulletin",
                    "Cet élève n'a pas de notes pour cette période",
                    "warning"
                );
                return;
            }

            this.render(studentBulletin, data);

        } catch (err) {
            console.error(err);
            Swal.fire("Erreur", "Impossible de charger le bulletin", "error");
        }
    },

    render(student, data) {
        /* ==============================
           EN-TÊTE OFFICIEL
        =============================== */

        document.getElementById("displaySchoolName").innerText =
            data.school?.name || "";

        document.getElementById("schoolProvince").innerText =
            data.school?.province || "";

        document.getElementById("displayPeriod").innerText =
            data.class_info?.period || "";

        /* ==============================
           INFOS ÉLÈVE
        =============================== */

        document.getElementById("studentFullName").innerText =
            student.name || "";

        document.getElementById("studentClass").innerText =
            data.class_info?.name || "";

        document.getElementById("studentID").innerText =
            student.student_id;

        /* ==============================
           TABLE DES NOTES
        =============================== */

        const tbody = document.getElementById("bulletinBody");
        tbody.innerHTML = "";

        student.courses.forEach(course => {
            const tr = document.createElement("tr");
            tr.className = "border-b border-black";

            tr.innerHTML = `
                <td class="p-2 font-bold uppercase border-r border-black">
                    ${course.course_name}
                </td>
                <td class="p-2 text-center border-r border-black">
                    ${course.max_score}
                </td>
                <td class="p-2 text-center border-r border-black ${
                    course.percentage < 50 ? "text-red-600 font-bold" : ""
                }">
                    ${course.score}
                </td>
                <td class="p-2 text-center border-r border-black ${
                    course.percentage < 50 ? "text-red-600 font-bold" : ""
                }">
                    ${course.percentage}%
                </td>
                <td class="p-2 text-center italic text-[10px]">
                    ${course.percentage >= 50 ? "Satisfaisant" : "Échec"}
                </td>
            `;
            tbody.appendChild(tr);
        });

        /* ==============================
           TOTAUX & RANG
        =============================== */

        document.getElementById("totalMax").innerText =
            student.total_max;

        document.getElementById("totalObtained").innerText =
            student.total_obtained;

        document.getElementById("totalPercent").innerText =
            student.average + "%";

        document.getElementById("finalPercentLabel").innerText =
            student.average;

        document.getElementById("studentRank").innerText =
            student.rank;

        document.getElementById("classSize").innerText =
            student.class_size;

        document.getElementById("finalObservation").innerText =
            student.average >= 50 ? "ADMIS" : "AJOURNÉ";
    }
};

/* ==============================
   BOOTSTRAP
================================ */

document.addEventListener("DOMContentLoaded", () => reportManager.init());
window.loadBulletinData = () => reportManager.loadBulletinData();
